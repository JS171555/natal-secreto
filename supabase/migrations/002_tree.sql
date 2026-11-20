-- Etapa 2: expõe apenas o id do administrador (para o ornamento REI). Não revela e-mail nem outros dados.
create or replace function public.get_admin_id() returns uuid language sql stable security definer set search_path = public as $$
  select value::uuid from public.app_settings where key = 'admin_user_id'
$$;
revoke all on function public.get_admin_id() from public, anon;
grant execute on function public.get_admin_id() to authenticated;
