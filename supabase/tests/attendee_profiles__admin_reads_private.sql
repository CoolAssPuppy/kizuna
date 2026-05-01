set search_path to public, tap, extensions;
-- Admins must be able to read every attendee_profiles row, including
-- ones the owner marked visibility = 'private'. The Ground Transport
-- Tool, dietary report, and room assignment all join through
-- attendee_profiles, and silently filtering private users would mean
-- they vanish from manifests.
begin;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000002000', 'admin-x@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000002001', 'private-user@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000002002', 'peer@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-000000002000', 'admin-x@example.com',     'admin',    'h_admin_x',  'sso'),
  ('00000000-0000-0000-0000-000000002001', 'private-user@example.com', 'employee', 'h_private',  'sso'),
  ('00000000-0000-0000-0000-000000002002', 'peer@example.com',         'employee', 'h_peer',     'sso');

insert into public.attendee_profiles (user_id, bio, visibility) values
  ('00000000-0000-0000-0000-000000002001', 'Private bio', 'private');

-- Peer (regular employee) cannot see the private profile.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000002002","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.attendee_profiles
    where user_id = '00000000-0000-0000-0000-000000002001'
  ),
  0,
  'a peer employee cannot read a private attendee_profiles row'
);

-- The owner can always see their own row.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000002001","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.attendee_profiles
    where user_id = '00000000-0000-0000-0000-000000002001'
  ),
  1,
  'the owner reads their own private attendee_profiles row'
);

-- Admin reads it via the new attendee_profiles_admin_read policy.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000002000","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.attendee_profiles
    where user_id = '00000000-0000-0000-0000-000000002001'
  ),
  1,
  'admin reads any attendee_profiles row including private ones'
);

select * from finish();
rollback;
