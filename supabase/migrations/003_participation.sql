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
