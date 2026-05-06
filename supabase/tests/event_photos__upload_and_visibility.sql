set search_path to public, tap, extensions;
-- Photo gallery RLS:
--   - registered attendees + admins SELECT non-deleted rows for their event
--   - uploader inserts their own row
--   - uploader OR admin updates (incl. soft delete via deleted_at)
--   - hashtag trigger parses #tags from caption (lower-cased, deduped)
--   - tags are readable to attendees, writable by uploader/admin
begin;
select plan(8);

-- Two attendees, one outsider
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000200', 'photo-alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000201', 'photo-bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000202', 'photo-eve@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000203', 'photo-admin@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-000000000200', 'photo-alice@example.com', 'employee', 'h_pa', null, 'sso'),
  ('00000000-0000-0000-0000-000000000201', 'photo-bob@example.com',   'employee', 'h_pb', null, 'sso'),
  ('00000000-0000-0000-0000-000000000202', 'photo-eve@example.com',   'employee', 'h_pe', null, 'sso'),
  ('00000000-0000-0000-0000-000000000203', 'photo-admin@example.com', 'admin',    'h_pad',null, 'sso');

insert into public.events (id, name, type, start_date, end_date, time_zone, is_active, invite_all_employees) values
  ('00000000-0000-0000-0000-0000000000aa', 'Photo Test 2027', 'company_offsite', '2027-08-01', '2027-08-05', 'UTC', false, false);

-- Alice + Bob registered; Eve is not.
insert into public.registrations (user_id, event_id, status) values
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-0000000000aa', 'started'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000aa', 'started');

-- Alice uploads a photo with a caption containing two hashtags.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000200","role":"authenticated","app_role":"employee","aud":"authenticated"}';

insert into public.event_photos (id, event_id, uploader_id, storage_prefix, width, height, caption) values
  (
    '00000000-0000-0000-0000-0000000000bb',
    '00000000-0000-0000-0000-0000000000aa',
    '00000000-0000-0000-0000-000000000200',
    '00000000-0000-0000-0000-0000000000aa/gallery/00000000-0000-0000-0000-000000000200/00000000-0000-0000-0000-0000000000bb',
    1920, 1080,
    'Sunset over Banff #Banff #PowDay #banff and a duplicate'
  );

select is(
  (select count(*)::int from public.event_photo_hashtags where photo_id = '00000000-0000-0000-0000-0000000000bb'),
  2,
  'hashtag trigger parses + dedupes case-insensitively'
);

select is(
  (select array_agg(hashtag order by hashtag)::text from public.event_photo_hashtags where photo_id = '00000000-0000-0000-0000-0000000000bb'),
  '{banff,powday}',
  'hashtags lower-cased and stored without the leading #'
);

-- Uploader can tag bob.
insert into public.event_photo_tags (photo_id, tagged_user_id) values
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000201');

-- Alice still sees her own photo.
select is(
  (select count(*)::int from public.event_photos where id = '00000000-0000-0000-0000-0000000000bb'),
  1,
  'uploader sees their own photo via SELECT policy'
);

-- Bob (registered) sees the photo and the tag.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.event_photos where id = '00000000-0000-0000-0000-0000000000bb'),
  1,
  'registered attendee sees the photo'
);

select is(
  (select count(*)::int from public.event_photo_tags where photo_id = '00000000-0000-0000-0000-0000000000bb'),
  1,
  'tag is readable to registered attendee'
);

-- Eve (NOT registered) cannot see the photo.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.event_photos where id = '00000000-0000-0000-0000-0000000000bb'),
  0,
  'outsider does not see photos for events they are not registered for'
);

-- Bob cannot insert a row pretending to be alice.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select throws_ok(
  $$
    insert into public.event_photos (event_id, uploader_id, storage_prefix)
    values ('00000000-0000-0000-0000-0000000000aa',
            '00000000-0000-0000-0000-000000000200',
            '00000000-0000-0000-0000-0000000000aa/gallery/00000000-0000-0000-0000-000000000200/spoof')
  $$,
  'new row violates row-level security policy for table "event_photos"',
  'cannot insert a photo claiming someone else as uploader'
);

-- Soft delete by alice (via SECURITY DEFINER helper — direct UPDATE is
-- blocked by Postgres because it would make the row invisible to the
-- caller's SELECT policy).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000200","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select public.soft_delete_event_photo('00000000-0000-0000-0000-0000000000bb');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.event_photos where id = '00000000-0000-0000-0000-0000000000bb'),
  0,
  'soft-deleted photo is hidden from non-admin readers'
);

select * from finish();
rollback;
