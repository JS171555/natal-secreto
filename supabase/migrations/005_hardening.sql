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
