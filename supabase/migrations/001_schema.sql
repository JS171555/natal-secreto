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
