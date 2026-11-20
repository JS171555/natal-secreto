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
