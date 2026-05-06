set search_path to public, tap, extensions;
-- user_eligible_for_event: 5 truth paths.
--   1. admin / super_admin (always)
--   2. invite_all_employees + allowed_domains
--   3. event_invitations row
--   4. guest follows sponsor's eligibility
--   5. existing registration preserves access
begin;
select plan(8);

-- Two events:
--   E1: invite_all=true, allowed_domains=['kizuna.dev']
--   E2: invite-only (no domain shortcut)
insert into public.events
  (id, name, type, start_date, end_date, invite_all_employees, allowed_domains)
values
  ('00000000-0000-0000-0000-e11ee11ee101', 'E1 open', 'company_offsite',
   '2027-06-01', '2027-06-03', true, ARRAY['elig.test']),
  ('00000000-0000-0000-0000-e11ee11ee102', 'E2 invite-only', 'team_offsite',
   '2027-07-01', '2027-07-03', false, '{}');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-e11ee11ee010', 'admin@elig.test',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee011', 'employee@elig.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee012', 'outsider@elsewhere.io','authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee013', 'invitee@elsewhere.io', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee014', 'sponsor@elig.test',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee015', 'guest@elsewhere.io',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-e11ee11ee016', 'former@elig.test',    'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider, is_active) values
  ('00000000-0000-0000-0000-e11ee11ee010', 'admin@elig.test',     'admin',    'h_e1_admin',  null,                                                       'sso',            true),
  ('00000000-0000-0000-0000-e11ee11ee011', 'employee@elig.test',  'employee', 'h_e1_emp',    null,                                                       'sso',            true),
  ('00000000-0000-0000-0000-e11ee11ee012', 'outsider@elsewhere.io','employee', 'h_e1_out',    null,                                                       'sso',            true),
  ('00000000-0000-0000-0000-e11ee11ee013', 'invitee@elsewhere.io', 'employee', 'h_e1_inv',    null,                                                       'sso',            true),
  ('00000000-0000-0000-0000-e11ee11ee014', 'sponsor@elig.test',   'employee', 'h_e1_spon',   null,                                                       'sso',            true),
  ('00000000-0000-0000-0000-e11ee11ee015', 'guest@elsewhere.io',   'guest',    null,          '00000000-0000-0000-0000-e11ee11ee014',                     'email_password', true),
  ('00000000-0000-0000-0000-e11ee11ee016', 'former@elig.test',    'employee', 'h_e1_for',    null,                                                       'sso',            true);

-- Path 1: admin always eligible
select ok(
  public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee010',
    '00000000-0000-0000-0000-e11ee11ee102'
  ),
  'admin is eligible for an invite-only event with no rows'
);

-- Path 2: open-to-domains
select ok(
  public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee011',
    '00000000-0000-0000-0000-e11ee11ee101'
  ),
  'employee with matching email domain is eligible for invite_all event'
);

-- Path 2 negative: outsider domain
select ok(
  not public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee012',
    '00000000-0000-0000-0000-e11ee11ee101'
  ),
  'employee with non-matching domain is NOT eligible for invite_all event'
);

-- Path 3: explicit invitation
insert into public.event_invitations (event_id, email, invited_by) values
  ('00000000-0000-0000-0000-e11ee11ee102', 'invitee@elsewhere.io', '00000000-0000-0000-0000-e11ee11ee010');
select ok(
  public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee013',
    '00000000-0000-0000-0000-e11ee11ee102'
  ),
  'employee with an event_invitations row is eligible for invite-only event'
);

-- Path 3 negative: no invitation row
select ok(
  not public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee012',
    '00000000-0000-0000-0000-e11ee11ee102'
  ),
  'employee without an invitation is NOT eligible for invite-only event'
);

-- Path 4: guest follows sponsor (sponsor matches by domain on E1)
select ok(
  public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee015',
    '00000000-0000-0000-0000-e11ee11ee101'
  ),
  'guest is eligible when their sponsor is eligible'
);

-- Path 5: existing registration preserves eligibility after a domain
-- removal. Set up a registration on E1 for the "former" employee, then
-- empty the allowed_domains. The user should still be eligible.
insert into public.registrations (user_id, event_id, status) values
  ('00000000-0000-0000-0000-e11ee11ee016', '00000000-0000-0000-0000-e11ee11ee101', 'started');
update public.events
   set allowed_domains = '{}'
 where id = '00000000-0000-0000-0000-e11ee11ee101';
select ok(
  public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee016',
    '00000000-0000-0000-0000-e11ee11ee101'
  ),
  'existing registration preserves eligibility after domain removal'
);

-- And the original employee (no registration) is no longer eligible.
select ok(
  not public.user_eligible_for_event(
    '00000000-0000-0000-0000-e11ee11ee011',
    '00000000-0000-0000-0000-e11ee11ee101'
  ),
  'employee without registration loses eligibility when the matching domain is removed'
);

select * from finish();
rollback;
