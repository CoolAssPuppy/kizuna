set search_path to public, tap, extensions;
-- Storage RLS: confirms the event-id path-prefix scoping holds across
-- the four buckets. Every assertion exercises the same helper
-- (storage_caller_can_read_event) plus a per-bucket policy so a regression
-- in either layer surfaces here.
--
-- Pattern: switch role to authenticated, set request.jwt.claim.sub to
-- the user being impersonated, then poke storage.objects via plain
-- INSERT/SELECT. Storage's per-statement RLS evaluation is the same
-- one the SDK hits at runtime.

begin;
select plan(12);

-- ---------------------------------------------------------------------
-- Setup: two events, an admin, an employee registered for event A,
-- a guest registered for event A, and a stranger registered for nothing.
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a001', 'storage.admin@example.com',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a002', 'storage.emp@example.com',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a003', 'storage.guest@example.com',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a004', 'storage.outsider@example.com','authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a005', 'storage.empA@example.com',   'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider, sponsor_id) values
  ('00000000-0000-0000-0000-00000000a001', 'storage.admin@example.com',  'admin',    'h_storage_admin',     'sso',    null),
  ('00000000-0000-0000-0000-00000000a002', 'storage.emp@example.com',    'employee', 'h_storage_emp',       'sso',    null),
  ('00000000-0000-0000-0000-00000000a005', 'storage.empA@example.com',   'employee', 'h_storage_empA',      'sso',    null),
  ('00000000-0000-0000-0000-00000000a003', 'storage.guest@example.com',  'guest',    null,                  'email_password', '00000000-0000-0000-0000-00000000a002'),
  ('00000000-0000-0000-0000-00000000a004', 'storage.outsider@example.com','employee','h_storage_outsider', 'sso',    null);

-- Two events: A is private (registration-gated), B is invite-all (the
-- @example.com domain matches every fixture user, so the storage RLS
-- helper grants those active employees access without a registration).
insert into public.events
  (id, name, type, start_date, end_date, invite_all_employees, allowed_domains)
values
  ('00000000-0000-0000-0000-0000000eee01', 'Storage Test A', 'team_offsite',
   '2027-06-01', '2027-06-03', false, '{}'),
  ('00000000-0000-0000-0000-0000000eee02', 'Storage Test B', 'team_offsite',
   '2027-07-01', '2027-07-03', true, ARRAY['example.com']);

insert into public.registrations (user_id, event_id, status) values
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000eee01', 'started'),
  ('00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-0000000eee01', 'started'),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-0000000eee01', 'started');

-- Admin seeds one event-content object per event so the read tests
-- have something to look at. Admin runs as service-role-equivalent
-- via the postgres role for these inserts (pre-RLS fixture data).
insert into storage.objects (bucket_id, name, owner) values
  ('event-content', '00000000-0000-0000-0000-0000000eee01/about/logo.png',  '00000000-0000-0000-0000-00000000a001'),
  ('event-content', '00000000-0000-0000-0000-0000000eee02/about/logo.png',  '00000000-0000-0000-0000-00000000a001'),
  ('documents',     '00000000-0000-0000-0000-0000000eee01/doc-1.pdf',       '00000000-0000-0000-0000-00000000a001');


-- ---------------------------------------------------------------------
-- 1. Helper returns false for malformed paths (no 500 on signed-URL).
-- ---------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a002';

select is(
  public.storage_caller_can_read_event('not-a-uuid/anything.png'),
  false,
  'helper returns false on a malformed leading segment, never raises'
);


-- ---------------------------------------------------------------------
-- 2. Registered employee can read event-content for event A.
-- ---------------------------------------------------------------------
select is(
  (select count(*) from storage.objects
   where bucket_id = 'event-content'
     and name = '00000000-0000-0000-0000-0000000eee01/about/logo.png'),
  1::bigint,
  'event-content: registered employee reads their event'
);


-- ---------------------------------------------------------------------
-- 3. Same employee can read invite-all event B even without registration.
-- ---------------------------------------------------------------------
select is(
  (select count(*) from storage.objects
   where bucket_id = 'event-content'
     and name = '00000000-0000-0000-0000-0000000eee02/about/logo.png'),
  1::bigint,
  'event-content: active employee reads invite_all_employees event without registration row'
);


-- ---------------------------------------------------------------------
-- 4. Outsider (employee not registered for A, but B is invite-all) can
--    read B but NOT A.
-- ---------------------------------------------------------------------
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a004';

select is(
  (select count(*) from storage.objects
   where bucket_id = 'event-content'
     and name = '00000000-0000-0000-0000-0000000eee02/about/logo.png'),
  1::bigint,
  'event-content: invite-all employee reads B'
);
select is(
  (select count(*) from storage.objects
   where bucket_id = 'event-content'
     and name = '00000000-0000-0000-0000-0000000eee01/about/logo.png'),
  0::bigint,
  'event-content: non-registered employee canNOT read private event A'
);


-- ---------------------------------------------------------------------
-- 5. Non-admin write fails on event-content.
-- ---------------------------------------------------------------------
prepare emp_write_event_content as
insert into storage.objects (bucket_id, name, owner)
values ('event-content', '00000000-0000-0000-0000-0000000eee01/about/cover.png', auth.uid());
select throws_ok(
  'execute emp_write_event_content',
  '42501',
  null,
  'event-content: non-admin write rejected by RLS'
);


-- ---------------------------------------------------------------------
-- 6. Admin can write event-content under any event.
-- ---------------------------------------------------------------------
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a001';
insert into storage.objects (bucket_id, name, owner)
values ('event-content', '00000000-0000-0000-0000-0000000eee02/about/cover.png', auth.uid());
select is(
  (select count(*) from storage.objects
   where bucket_id = 'event-content'
     and name = '00000000-0000-0000-0000-0000000eee02/about/cover.png'),
  1::bigint,
  'event-content: admin write accepted'
);


-- ---------------------------------------------------------------------
-- 7. Documents bucket: same registration-gate as event-content.
-- ---------------------------------------------------------------------
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a002';
select is(
  (select count(*) from storage.objects
   where bucket_id = 'documents'
     and name = '00000000-0000-0000-0000-0000000eee01/doc-1.pdf'),
  1::bigint,
  'documents: registered employee reads doc'
);

set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a004';
select is(
  (select count(*) from storage.objects
   where bucket_id = 'documents'
     and name = '00000000-0000-0000-0000-0000000eee01/doc-1.pdf'),
  0::bigint,
  'documents: outsider canNOT read doc for an event they are not registered to'
);


-- ---------------------------------------------------------------------
-- 8. community-media gallery write: must include caller's auth.uid()
--    in the gallery/<user_id>/ subpath AND caller must be registered.
-- ---------------------------------------------------------------------
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a002';

-- Allowed: own folder, registered event.
insert into storage.objects (bucket_id, name, owner)
values (
  'community-media',
  '00000000-0000-0000-0000-0000000eee01/gallery/00000000-0000-0000-0000-00000000a002/m-1/photo.jpg',
  auth.uid()
);
select is(
  (select count(*) from storage.objects
   where bucket_id = 'community-media'
     and name = '00000000-0000-0000-0000-0000000eee01/gallery/00000000-0000-0000-0000-00000000a002/m-1/photo.jpg'),
  1::bigint,
  'community-media gallery: caller writes their own folder under their event'
);

-- Rejected: gallery folder for a different user.
prepare emp_write_other_gallery as
insert into storage.objects (bucket_id, name, owner)
values (
  'community-media',
  '00000000-0000-0000-0000-0000000eee01/gallery/00000000-0000-0000-0000-00000000a005/m-x/photo.jpg',
  auth.uid()
);
select throws_ok(
  'execute emp_write_other_gallery',
  '42501',
  null,
  'community-media gallery: caller canNOT write into another user folder'
);


-- ---------------------------------------------------------------------
-- 9. avatars bucket stays identity-scoped — caller writes their own
--    folder, not someone else's.
-- ---------------------------------------------------------------------
prepare emp_write_other_avatar as
insert into storage.objects (bucket_id, name, owner)
values (
  'avatars',
  '00000000-0000-0000-0000-00000000a005/avatar.png',
  auth.uid()
);
select throws_ok(
  'execute emp_write_other_avatar',
  '42501',
  null,
  'avatars: caller canNOT write into another user folder'
);


select * from finish();
rollback;
