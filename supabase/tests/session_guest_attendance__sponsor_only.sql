set search_path to public, tap, extensions;
-- Sponsor + admin can read/write a guest's per-session attendance row;
-- a stranger cannot. Mirrors the additional_guests RLS shape so the
-- admin agenda aggregation stays accurate even when the SPA forgets
-- to send a sponsor_id on a write path.
begin;
select plan(4);

-- Test event so the session has a place to live.
insert into public.events (id, name, type, start_date, end_date, time_zone, location, is_active)
values ('00000000-0000-0000-0000-00000000aa10', 'pgTAP Guest Attendance', 'supafest',
        current_date, current_date + 5, 'UTC', 'pgtap', false);

insert into public.sessions (id, event_id, type, audience, status, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-00000000aa10',
        'activity', 'all', 'active', 'pgTAP Activity',
        now() + interval '1 day', now() + interval '1 day' + interval '1 hour');

-- Sponsor + their guest.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000005f1', 'pgtap.sponsor@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000005f1', 'pgtap.sponsor@example.com', 'employee', 'hibob_pgtap_sponsor', 'sso');

insert into public.additional_guests (id, sponsor_id, first_name, last_name, age_bracket, fee_amount)
values ('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000005f1',
        'Mini', 'Sponsor', 'under_12', 0);

-- A second sponsor whose guest the first sponsor must NOT be able to write to.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000005f3', 'pgtap.outsider@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000005f3', 'pgtap.outsider@example.com', 'employee', 'hibob_pgtap_outsider', 'sso');
insert into public.additional_guests (id, sponsor_id, first_name, last_name, age_bracket, fee_amount)
values ('00000000-0000-0000-0000-0000000005f4', '00000000-0000-0000-0000-0000000005f3',
        'Other', 'Kid', 'teen', 0);

-- ---------------------------------------------------------------------
-- Sponsor can insert + read attendance for their own guest.
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005f1","role":"authenticated","app_role":"employee","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000005f1';

insert into public.session_guest_attendance (session_id, additional_guest_id)
values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005f2');

select is(
  (select count(*)::int from public.session_guest_attendance
   where additional_guest_id = '00000000-0000-0000-0000-0000000005f2'),
  1,
  'sponsor can insert + read attendance for their own guest'
);

-- ---------------------------------------------------------------------
-- Sponsor cannot read another sponsor's row.
-- ---------------------------------------------------------------------
reset role;
insert into public.session_guest_attendance (session_id, additional_guest_id)
values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005f4');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005f1","role":"authenticated","app_role":"employee","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000005f1';

select is(
  (select count(*)::int from public.session_guest_attendance
   where additional_guest_id = '00000000-0000-0000-0000-0000000005f4'),
  0,
  'sponsor cannot read another sponsor''s guest attendance row'
);

-- ---------------------------------------------------------------------
-- Sponsor cannot insert against another sponsor's guest.
-- ---------------------------------------------------------------------
prepare cross_sponsor_insert as
  insert into public.session_guest_attendance (session_id, additional_guest_id)
  values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005f4');
select throws_ok(
  'execute cross_sponsor_insert',
  null,
  null,
  'sponsor cannot insert attendance for someone else''s guest'
);
deallocate cross_sponsor_insert;

-- ---------------------------------------------------------------------
-- Admin reads everything for the aggregation.
-- ---------------------------------------------------------------------
reset role;
update public.users set role = 'admin' where id = '00000000-0000-0000-0000-0000000005f1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005f1","role":"authenticated","app_role":"admin","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000005f1';

select is(
  (select count(*)::int from public.session_guest_attendance
   where session_id = '00000000-0000-0000-0000-0000000005e1'),
  2,
  'admin reads every guest-attendance row for aggregation'
);

select * from finish();
rollback;
