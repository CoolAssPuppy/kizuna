-- Storage buckets, layout, and RLS.
--
-- Convention (the one place to land changes):
--
--   * Identity content lives in `avatars`, keyed on the user — same person
--     across many events. Path: <user_id>/<file>.
--
--   * Every other bucket is event-scoped via path prefix, NOT bucket-per-
--     event. Object names start with the event_id; RLS enforces that the
--     caller has a registration row for that event (or is an admin).
--
--   * Three event-scoped buckets:
--       - event-content     admin-managed branding + editorial (logo,
--                           hero, feed)
--       - documents         admin-uploaded PDFs (waiver, code of conduct)
--       - community-media   user-uploaded chat media + photo gallery
--
-- Object name shapes the app MUST honour:
--
--   avatars/<user_id>/avatar.<ext>
--
--   event-content/<event_id>/about/logo.<ext>
--   event-content/<event_id>/about/cover.<ext>
--   event-content/<event_id>/feed/<feed_item_id>/<file>
--
--   documents/<event_id>/<document_id>.pdf
--
--   community-media/<event_id>/chats/<channel_slug>/<message_id>/<file>
--   community-media/<event_id>/gallery/<user_id>/<media_item_id>/<file>
--
-- All buckets stay private; clients use createSignedUrl for display.
-- Adding a new bucket? Mirror the helper + policy block below and update
-- README.md, CLAUDE.md, AGENTS.md so the convention spreads cleanly.

-- ---------------------------------------------------------------------
-- Helper: extract the event_id (first path segment) and check that the
-- caller is registered for that event. SECURITY DEFINER keeps the inner
-- joins bypass-free; the function only ever returns true/false and is
-- granted to authenticated only — anon callers are never reading any of
-- the event-scoped buckets.
-- ---------------------------------------------------------------------
create or replace function public.storage_caller_can_read_event(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_first text;
  v_event_id uuid;
  v_caller uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return false;
  end if;

  -- The leading path segment must be a UUID. Pre-check with a regex so
  -- malformed paths bail without paying for a subtransaction (an
  -- EXCEPTION-on-cast block opens a savepoint per row, which is
  -- measurably expensive on the storage SELECT hot path).
  v_first := (storage.foldername(object_name))[1];
  if v_first is null or v_first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_event_id := v_first::uuid;

  -- Single source of truth: defer to the eligibility helper. is_admin
  -- is checked there too, but the early return preserves the perf win
  -- on the storage SELECT hot path (admins skip the helper's plpgsql).
  if public.is_admin() then
    return true;
  end if;

  return public.user_eligible_for_event(v_caller, v_event_id);
end
$$;

revoke all on function public.storage_caller_can_read_event(text) from public;
grant execute on function public.storage_caller_can_read_event(text) to authenticated;

comment on function public.storage_caller_can_read_event(text) is
  'Storage RLS helper. Pulls the event_id from a leading <event_id>/... object path and returns true when the caller is admin or registered for that event.';


-- ---------------------------------------------------------------------
-- Avatars: each user owns a folder named after their auth.uid().
-- This bucket stays IDENTITY-scoped (cross-event) on purpose.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists avatars_self_read on storage.objects;
drop policy if exists avatars_self_write on storage.objects;
drop policy if exists avatars_self_update on storage.objects;
drop policy if exists avatars_self_delete on storage.objects;

create policy avatars_self_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_self_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- ---------------------------------------------------------------------
-- event-content: admin-managed branding + editorial assets (logo, cover,
-- feed images) scoped per event by leading path segment.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-content', 'event-content', false)
on conflict (id) do nothing;

drop policy if exists event_content_event_read on storage.objects;
drop policy if exists event_content_admin_write on storage.objects;
drop policy if exists event_content_admin_update on storage.objects;
drop policy if exists event_content_admin_delete on storage.objects;

create policy event_content_event_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-content'
    and public.storage_caller_can_read_event(name)
  );

create policy event_content_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-content' and public.is_admin());

create policy event_content_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'event-content' and public.is_admin());

create policy event_content_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-content' and public.is_admin());


-- ---------------------------------------------------------------------
-- documents: admin-uploaded PDFs (waiver, code of conduct, etc).
-- Object names: <event_id>/<document_id>.pdf
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_event_read on storage.objects;
drop policy if exists documents_admin_write on storage.objects;
drop policy if exists documents_admin_update on storage.objects;
drop policy if exists documents_admin_delete on storage.objects;

create policy documents_event_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_caller_can_read_event(name)
  );

create policy documents_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());

create policy documents_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_admin());

create policy documents_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());


-- ---------------------------------------------------------------------
-- community-media: user-uploaded chat media + future photo gallery,
-- scoped per event in path. Writers must own the user_id in the chat
-- subpath (chats/<channel>/<message_id>/...) or in the gallery subpath
-- (gallery/<user_id>/...).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', false)
on conflict (id) do nothing;

drop policy if exists community_media_event_read on storage.objects;
drop policy if exists community_media_self_write on storage.objects;
drop policy if exists community_media_self_update on storage.objects;
drop policy if exists community_media_self_delete on storage.objects;

create policy community_media_event_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-media'
    and public.storage_caller_can_read_event(name)
  );

-- Writers must be registered for the event AND the gallery subpath must
-- match auth.uid(). For chat messages the message_id is generated server
-- side and the user owns the message via messages.sender_id, so we just
-- require event registration. The chat sender check is enforced by the
-- messages table RLS, not here.
create policy community_media_self_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and public.storage_caller_can_read_event(name)
    and (
      -- gallery subpath: <event_id>/gallery/<user_id>/...
      (storage.foldername(name))[2] = 'chats'
      or (
        (storage.foldername(name))[2] = 'gallery'
        and (storage.foldername(name))[3] = (select auth.uid())::text
      )
    )
  );

create policy community_media_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-media'
    and public.storage_caller_can_read_event(name)
    and (
      (storage.foldername(name))[2] = 'chats'
      or (storage.foldername(name))[3] = (select auth.uid())::text
    )
  );

-- Delete: gallery owner can delete their own; admins can delete any.
create policy community_media_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-media'
    and (
      public.is_admin()
      or (
        public.storage_caller_can_read_event(name)
        and (storage.foldername(name))[2] = 'gallery'
        and (storage.foldername(name))[3] = (select auth.uid())::text
      )
    )
  );


-- ---------------------------------------------------------------------
-- Cleanup: previous incarnation had a `feed-images` bucket and an
-- `event-covers` bucket. Drop them here so a re-applied schema converges
-- on the four-bucket layout above.
--
-- Hosted Supabase installs a `storage.protect_delete()` trigger that
-- blocks raw DELETE on storage.objects (admins are nudged to use the
-- Storage API). When that fires, we skip the cleanup gracefully — the
-- legacy buckets stay empty + unreferenced and the rest of the schema
-- applies cleanly. Local dev doesn't have that trigger, so the
-- cleanup completes there.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from storage.buckets where id = 'feed-images') then
    begin
      delete from storage.objects where bucket_id = 'feed-images';
      delete from storage.buckets where id = 'feed-images';
    exception when others then
      raise notice 'feed-images bucket cleanup skipped (likely storage.protect_delete trigger): %', sqlerrm;
    end;
  end if;
  if exists (select 1 from storage.buckets where id = 'event-covers') then
    begin
      delete from storage.objects where bucket_id = 'event-covers';
      delete from storage.buckets where id = 'event-covers';
    exception when others then
      raise notice 'event-covers bucket cleanup skipped (likely storage.protect_delete trigger): %', sqlerrm;
    end;
  end if;
end
$$;
