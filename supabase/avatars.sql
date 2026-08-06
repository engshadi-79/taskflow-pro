-- TaskFlow Pro — user avatar uploads.
-- Run this after schema.sql, rls.sql and storage.sql.
--
-- Upload convention: files are stored at "<user_id>/<file_name>" inside the
-- 'avatars' bucket, so policies can recover the owner from the object path.
-- The bucket is public (read) because an avatar is not sensitive and needs to
-- render in <img> tags across the app without a signed URL.

alter table public.users
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_storage_select on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
