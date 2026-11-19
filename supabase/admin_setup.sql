-- Defina o administrador (REI) UMA vez, depois de criar sua conta no app.
insert into public.app_settings (key, value)
values ('admin_user_id', (select id::text from auth.users where email = 'SEU-EMAIL@exemplo.com'))
on conflict (key) do update set value = excluded.value;
