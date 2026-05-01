set search_path to public, tap, extensions;
-- Channels are public to authenticated users. DMs (dm:a:b) are still
-- visible only to the two participants, even though the UI doesn't
-- expose them today.
begin;
select plan(5);

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

-- The seed already created the public 'general' and 'guests' channels.
insert into public.messages (sender_id, channel, body) values
  ('00000000-0000-0000-0000-000000000050', 'general', 'hi everyone'),
  ('00000000-0000-0000-0000-000000000050', 'dm:00000000-0000-0000-0000-000000000051', 'hi bob, just for you'),
  ('00000000-0000-0000-0000-000000000054', 'guests', 'guest-only chatter');

-- General visible to alice (authenticated employee). We count only the
-- message we inserted ourselves in this test so the fixture seed
-- doesn't interfere.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000050","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.messages
    where channel = 'general'
      and sender_id = '00000000-0000-0000-0000-000000000050'
  ),
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

-- Public 'guests' channel visible to any authenticated user. Filter to
-- the message we inserted in this test rather than relying on the
-- fixture's count.
select is(
  (
    select count(*)::int from public.messages
    where channel = 'guests'
      and sender_id = '00000000-0000-0000-0000-000000000054'
  ),
  1,
  'guests channel readable by any authenticated user'
);

-- Channel that does NOT exist in public.channels is invisible regardless
-- of role: this guards against a stale slug or typo flooding the rest of
-- the app with messages no one can moderate.
select is(
  (
    select count(*)::int from public.messages
    where channel = 'no-such-channel'
  ),
  0,
  'unknown channel slug yields no rows'
);

select * from finish();
rollback;
