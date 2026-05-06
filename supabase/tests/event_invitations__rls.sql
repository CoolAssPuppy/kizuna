set search_path to public, tap, extensions;
-- event_invitations: admin manages; the invited person can read their
-- own row; everyone else sees nothing.
begin;
select plan(5);

insert into public.events (id, name, type, start_date, end_date, invite_all_employees) values
  ('00000000-0000-0000-0000-1a51a51a51a5', 'Invitations RLS', 'team_offsite', '2027-06-01', '2027-06-03', false);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-1a51a51a51d1', 'admin@inv.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-1a51a51a51d2', 'invitee@inv.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-1a51a51a51d3', 'stranger@inv.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-1a51a51a51d1', 'admin@inv.test',    'admin',    'h_inv_admin',    null, 'sso'),
  ('00000000-0000-0000-0000-1a51a51a51d2', 'invitee@inv.test',  'employee', 'h_inv_invitee',  null, 'sso'),
  ('00000000-0000-0000-0000-1a51a51a51d3', 'stranger@inv.test', 'employee', 'h_inv_stranger', null, 'sso');

set local role authenticated;

-- Admin inserts an invitation.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-1a51a51a51d1","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.event_invitations (event_id, email, first_name, last_name, invited_by)
    values ('00000000-0000-0000-0000-1a51a51a51a5',
            'invitee@inv.test', 'Invitee', 'Tester',
            '00000000-0000-0000-0000-1a51a51a51d1')$$,
  'admin can insert an invitation'
);

-- Admin reads everything.
select is(
  (select count(*)::int from public.event_invitations
    where event_id = '00000000-0000-0000-0000-1a51a51a51a5'),
  1,
  'admin can read invitations'
);

-- Invitee reads their own row (citext + email match).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-1a51a51a51d2","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.event_invitations
    where event_id = '00000000-0000-0000-0000-1a51a51a51a5'),
  1,
  'invitee sees their own invitation row'
);

-- Stranger reads nothing.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-1a51a51a51d3","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.event_invitations
    where event_id = '00000000-0000-0000-0000-1a51a51a51a5'),
  0,
  'unrelated employee sees no invitation rows'
);

-- Stranger cannot insert.
select throws_ok(
  $$insert into public.event_invitations (event_id, email)
    values ('00000000-0000-0000-0000-1a51a51a51a5', 'imposter@inv.test')$$,
  '42501',
  null,
  'non-admin cannot insert invitations'
);

select * from finish();
rollback;
