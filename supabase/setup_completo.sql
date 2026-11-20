-- NATAL SECRETO — Etapa 1: tabelas, restrições, índices e RLS.
-- Execute no Supabase > SQL Editor.

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  user_id uuid primary key references public.profiles(id) on delete cascade, -- 1 participação por usuário
  photo_path text not null check (char_length(photo_path) between 5 and 300),
  confirmed_at timestamptz not null default now()
);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'completed' check (status in ('pending', 'completed')),
  drawn_by uuid references public.profiles(id) on delete set null,
  drawn_at timestamptz not null default now()
);
-- No máximo um sorteio concluído por evento.
create unique index draws_single_completed on public.draws ((true)) where status = 'completed';

create table public.draw_assignments (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  giver_id uuid not null references public.participants(user_id) on delete cascade,
  receiver_id uuid not null references public.participants(user_id) on delete cascade,
  revealed_at timestamptz,
  constraint no_self_draw check (giver_id <> receiver_id),
  constraint one_target_per_giver unique (draw_id, giver_id),
  constraint one_giver_per_receiver unique (draw_id, receiver_id)
);
create index draw_assignments_giver_idx on public.draw_assignments (giver_id);

-- Triggers
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id) select id from auth.users on conflict do nothing; -- usuários já existentes

-- Administrador: definido só no banco (app_settings), nunca pelo navegador.
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_settings where key = 'admin_user_id' and value = auth.uid()::text)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Permissões mínimas + RLS
revoke all on all tables in schema public from anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select, insert on public.participants to authenticated;
grant select on public.draws, public.draw_assignments to authenticated;

alter table public.app_settings enable row level security;      -- sem policies: ninguém acessa pelo cliente
alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.draws enable row level security;
alter table public.draw_assignments enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy participants_select on public.participants for select to authenticated using (true);
create policy participants_insert_own on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.display_name is not null)
  and not exists (select 1 from public.draws d where d.status = 'completed')
);

create policy draws_select on public.draws for select to authenticated using (true);
-- Cada pessoa vê somente o próprio par. Escrita: apenas Edge Function (service role), Etapa 4.
create policy assignments_select_own on public.draw_assignments for select to authenticated using (giver_id = auth.uid());
-- Etapa 2: expõe apenas o id do administrador (para o ornamento REI). Não revela e-mail nem outros dados.
create or replace function public.get_admin_id() returns uuid language sql stable security definer set search_path = public as $$
  select value::uuid from public.app_settings where key = 'admin_user_id'
$$;
revoke all on function public.get_admin_id() from public, anon;
grant execute on function public.get_admin_id() to authenticated;
-- Etapa 3: bucket de fotos, políticas de Storage, regra de participação e Realtime.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('participant-photos', 'participant-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- Cada usuário só envia para a própria pasta (<uid>/<uuid>.jpg), uma única vez, e não há update:
-- uma foto enviada nunca é sobrescrita. Nomes aleatórios impedem colisões.
create policy photos_select on storage.objects for select to authenticated using (bucket_id = 'participant-photos');
create policy photos_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'participant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.participants p where p.user_id = auth.uid())
  and not exists (select 1 from public.draws d where d.status = 'completed')
);
-- Só é possível apagar arquivo próprio que ainda não virou participação (limpeza de upload órfão).
create policy photos_delete_orphan on storage.objects for delete to authenticated using (
  bucket_id = 'participant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.participants p where p.photo_path = name)
);

-- A participação só aceita foto da própria pasta.
drop policy participants_insert_own on public.participants;
create policy participants_insert_own on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and photo_path like auth.uid()::text || '/%'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.display_name is not null)
  and not exists (select 1 from public.draws d where d.status = 'completed')
);

-- Realtime (respeita RLS).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants') then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
-- Etapa 4: sorteio atômico, revelação individual e status. Os pares NUNCA saem do servidor,
-- exceto o par do próprio usuário (policy assignments_select_own da migração 001 + reveal_my_result).

-- Defesa extra: ninguém entra na árvore depois do sorteio (vale mesmo em corrida de requisições).
create function public.block_participation_after_draw() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.draws where status = 'completed') then raise exception 'draw_done' using errcode = '42501'; end if;
  return new;
end $$;
create trigger participants_block_after_draw before insert on public.participants
  for each row execute function public.block_participation_after_draw();

-- Grava sorteio + todos os pares em UMA transação. Só a Edge Function (service_role) executa.
create function public.perform_draw(p_admin uuid, p_givers uuid[], p_receivers uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_draw uuid; v_n int := coalesce(array_length(p_givers, 1), 0);
begin
  perform pg_advisory_xact_lock(hashtext('natal-secreto-draw'));
  if exists (select 1 from draws where status = 'completed') then raise exception 'already_done'; end if;
  lock table participants in share mode;                      -- ninguém entra durante a gravação
  if v_n < 2 or v_n <> coalesce(array_length(p_receivers, 1), 0) then raise exception 'invalid_input'; end if;
  if (select count(*) from participants) <> v_n
     or exists (select 1 from participants p where not p.user_id = any (p_givers)) then raise exception 'participants_changed'; end if;
  if (select count(distinct g) from unnest(p_givers) g) <> v_n
     or (select count(distinct r) from unnest(p_receivers) r) <> v_n
     or exists (select 1 from unnest(p_receivers) r where not r = any (p_givers))
     or exists (select 1 from unnest(p_givers, p_receivers) as t(g, r) where g = r) then raise exception 'invalid_input'; end if;
  insert into draws (status, drawn_by) values ('completed', p_admin) returning id into v_draw;
  insert into draw_assignments (draw_id, giver_id, receiver_id) select v_draw, g, r from unnest(p_givers, p_receivers) as t(g, r);
  return v_draw;
end $$;
revoke all on function public.perform_draw(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.perform_draw(uuid, uuid[], uuid[]) to service_role;

-- Marca "revelado" e devolve APENAS o par de quem chama (idempotente: pode consultar de novo).
create function public.reveal_my_result() returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  update draw_assignments set revealed_at = coalesce(revealed_at, now()) where giver_id = auth.uid() returning receiver_id into v;
  return v;
end $$;
revoke all on function public.reveal_my_result() from public, anon;
grant execute on function public.reveal_my_result() to authenticated;

-- Status geral. Contagens só para o administrador; nenhum par individual.
create function public.get_draw_status() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'completed', exists (select 1 from draws where status = 'completed'),
    'drawn_at', (select drawn_at from draws where status = 'completed'),
    'participants', (select count(*) from participants)
  ) || case when public.is_admin() then jsonb_build_object(
    'assignments', (select count(*) from draw_assignments),
    'revealed', (select count(*) from draw_assignments where revealed_at is not null)
  ) else '{}'::jsonb end
$$;
revoke all on function public.get_draw_status() from public, anon;
grant execute on function public.get_draw_status() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draws') then
    alter publication supabase_realtime add table public.draws;
  end if;
end $$;
-- Etapa 5: endurecimento de segurança.

-- 1) A participação só aceita o caminho exato <uid>/<uuid>.jpg (bloqueia "../" e fotos de terceiros).
drop policy participants_insert_own on public.participants;
create policy participants_insert_own on public.participants for insert to authenticated with check (
  user_id = auth.uid()
  and photo_path ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.display_name is not null)
  and not exists (select 1 from public.draws d where d.status = 'completed')
);

-- 2) No máximo 3 arquivos por usuário no bucket (evita lotar o armazenamento com uploads órfãos).
drop policy photos_insert_own on storage.objects;
create policy photos_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'participant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (select 1 from public.participants p where p.user_id = auth.uid())
  and not exists (select 1 from public.draws d where d.status = 'completed')
  and (select count(*) from storage.objects o where o.bucket_id = 'participant-photos' and (storage.foldername(o.name))[1] = auth.uid()::text) < 3
);

-- 3) O nome "REI" pertence ao administrador: ninguém mais pode se chamar assim.
create function public.guard_reserved_name() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is not null and lower(btrim(new.display_name)) = 'rei'
     and not exists (select 1 from public.app_settings where key = 'admin_user_id' and value = new.id::text) then
    raise exception 'reserved_name' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger profiles_guard_name before insert or update of display_name on public.profiles
  for each row execute function public.guard_reserved_name();
