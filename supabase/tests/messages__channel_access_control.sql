set search_path to public, tap, extensions;
-- Direct messages between users are visible only to participants.
-- General channel is visible to all authenticated users.
-- Guest-only channel is hidden from regular employees.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000050', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000051', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000052', 'carol@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000053', 'sponsor@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000054', 'guest@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-000000000050', 'alice@example.com', 'employee', 'h_a', null, 'sso'),
  ('00000000-0000-0000-0000-000000000051', 'bob@example.com', 'employee', 'h_b', null, 'sso'),
  ('00000000-0000-0000-0000-000000000052', 'carol@example.com', 'employee', 'h_c', null, 'sso'),
  ('00000000-0000-0000-0000-000000000053', 'sponsor@example.com', 'employee', 'h_s', null, 'sso'),
  ('00000000-0000-0000-0000-000000000054', 'guest@example.com', 'guest', null, '00000000-0000-0000-0000-000000000053', 'email_password');

-- Seed messages
insert into public.messages (sender_id, channel, body) values
  ('00000000-0000-0000-0000-000000000050', 'general', 'hi everyone'),
  ('00000000-0000-0000-0000-000000000050', 'dm:00000000-0000-0000-0000-000000000051', 'hi bob, just for you'),
  ('00000000-0000-0000-0000-000000000054', 'guests', 'guest-only chatter');

-- General visible to alice (authenticated employee)
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000050","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.messages where channel = 'general'),
  1,
  'general channel visible to employee alice'
);

-- DM visible to bob (recipient)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.messages where channel = 'dm:00000000-0000-0000-0000-000000000051'),
  1,
  'DM channel visible to recipient bob'
);

-- DM NOT visible to carol (not a participant)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.messages where channel = 'dm:00000000-0000-0000-0000-000000000051'),
  0,
  'DM channel hidden from non-participant carol'
);

-- Guests channel NOT visible to plain employee carol (not guest, not admin)
select is(
  (select count(*)::int from public.messages where channel = 'guests'),
  0,
  'guests-only channel hidden from regular employee'
);

select * from finish();
rollback;
