-- Storage buckets and policies.
--
-- Convention: bucket-level helpers `is_admin()` and `auth.uid()` gate writes.
-- All buckets stay private; clients use createSignedUrl for display.
-- A small `_public_bucket_read` exception lets authenticated users read from
-- buckets that hold globally-visible content (event covers, feed images,
-- documents) without per-row signed URLs — convenient for the home feed and
-- documents tab while still requiring an authenticated session.

-- ---------------------------------------------------------------------
-- Avatars: each user owns a folder named after their auth.uid().
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists avatars_self_read on storage.objects;
drop policy if exists avatars_self_write on storage.objects;
drop policy if exists avatars_self_update on storage.objects;
drop policy if exists avatars_self_delete on storage.objects;

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

create policy avatars_self_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- Feed images: admin-managed editorial assets shown on the home screen.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('feed-images', 'feed-images', false)
on conflict (id) do nothing;

drop policy if exists feed_images_authenticated_read on storage.objects;
drop policy if exists feed_images_admin_write on storage.objects;
drop policy if exists feed_images_admin_update on storage.objects;
drop policy if exists feed_images_admin_delete on storage.objects;

create policy feed_images_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'feed-images');

create policy feed_images_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feed-images' and public.is_admin());

create policy feed_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'feed-images' and public.is_admin());

create policy feed_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'feed-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- Event covers and logos: admin-managed branding assets per event.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', false)
on conflict (id) do nothing;

drop policy if exists event_covers_authenticated_read on storage.objects;
drop policy if exists event_covers_admin_write on storage.objects;
drop policy if exists event_covers_admin_update on storage.objects;
drop policy if exists event_covers_admin_delete on storage.objects;

create policy event_covers_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'event-covers');

create policy event_covers_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-covers' and public.is_admin());

create policy event_covers_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'event-covers' and public.is_admin());

create policy event_covers_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-covers' and public.is_admin());

-- ---------------------------------------------------------------------
-- Community media: any authenticated attendee can drop an image into a
-- channel message. Files live under <auth.uid()>/<filename> so it's easy
-- to revoke an individual user's uploads later.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', false)
on conflict (id) do nothing;

drop policy if exists community_media_authenticated_read on storage.objects;
drop policy if exists community_media_self_write on storage.objects;
drop policy if exists community_media_self_update on storage.objects;
drop policy if exists community_media_self_delete on storage.objects;

create policy community_media_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'community-media');

create policy community_media_self_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy community_media_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy community_media_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );


-- ---------------------------------------------------------------------
-- Documents: admin-uploaded PDFs (waiver, code of conduct, etc).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_authenticated_read on storage.objects;
drop policy if exists documents_admin_write on storage.objects;
drop policy if exists documents_admin_update on storage.objects;
drop policy if exists documents_admin_delete on storage.objects;

create policy documents_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

create policy documents_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());

create policy documents_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_admin());

create policy documents_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
