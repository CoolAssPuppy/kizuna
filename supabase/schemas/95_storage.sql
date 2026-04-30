-- Storage buckets and policies.
--
-- Each user can read and write their own avatar (path: <user_id>/<filename>).
-- The bucket is private; clients use createSignedUrl to display.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Drop and recreate policies idempotently.
drop policy if exists avatars_self_read on storage.objects;
drop policy if exists avatars_self_write on storage.objects;
drop policy if exists avatars_self_update on storage.objects;

create policy avatars_self_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_self_write on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_self_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
