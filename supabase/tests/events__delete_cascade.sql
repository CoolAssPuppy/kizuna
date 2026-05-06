set search_path to public, tap, extensions;
-- delete_event_cascade hard-deletes all event-scoped rows in one shot.
-- Verify that:
--   1. A non-admin caller is rejected.
--   2. An admin caller succeeds AND every event-scoped row is removed.
--   3. User-scoped data (employee_profiles, additional_guests) survives.
begin;
select plan(5);

-- ===== Setup =====
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000003001', 'cascade-admin@example.com',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000003002', 'cascade-emp@example.com',    'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider, is_leadership) values
  ('00000000-0000-0000-0000-000000003001', 'cascade-admin@example.com', 'admin',    'h_cascade_admin', 'sso', true),
  ('00000000-0000-0000-0000-000000003002', 'cascade-emp@example.com',   'employee', 'h_cascade_emp',   'sso', false);

-- Create a brand-new event so we don't disturb the seeded supafest.
insert into public.events (id, name, type, location, time_zone, start_date, end_date)
values ('00000000-0000-0000-0000-000000003100', 'Cascade Test', 'team_offsite',
        'Test City', 'UTC', '2027-06-01', '2027-06-03');

insert into public.registrations (id, user_id, event_id)
values ('00000000-0000-0000-0000-000000003200',
        '00000000-0000-0000-0000-000000003002',
        '00000000-0000-0000-0000-000000003100');

insert into public.accommodations (id, event_id, hotel_name, room_type, check_in, check_out)
values ('00000000-0000-0000-0000-000000003300',
        '00000000-0000-0000-0000-000000003100',
        'Test Inn', 'standard', '2027-06-01', '2027-06-03');

insert into public.employee_profiles (user_id, preferred_name)
values ('00000000-0000-0000-0000-000000003002', 'Surviving Employee')
on conflict (user_id) do nothing;

-- ===== 1. Non-admin caller is rejected =====
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003002","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select throws_ok(
  $$ select public.delete_event_cascade('00000000-0000-0000-0000-000000003100'::uuid) $$,
  '42501',
  null,
  'non-admin caller is rejected with 42501'
);

-- ===== 2. Admin caller succeeds =====
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003001","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  public.delete_event_cascade('00000000-0000-0000-0000-000000003100'::uuid),
  true,
  'admin caller returns true on success'
);

-- ===== 3. Event row gone =====
reset role;
select is(
  (select count(*)::int from public.events where id = '00000000-0000-0000-0000-000000003100'),
  0,
  'event row is gone after cascade'
);

-- ===== 4. Event-scoped rows cascaded =====
select is(
  (select count(*)::int from public.registrations where event_id = '00000000-0000-0000-0000-000000003100')
    + (select count(*)::int from public.accommodations where event_id = '00000000-0000-0000-0000-000000003100'),
  0,
  'registrations + accommodations cascaded with the event'
);

-- ===== 5. User-scoped survives =====
select is(
  (select count(*)::int from public.employee_profiles where user_id = '00000000-0000-0000-0000-000000003002'),
  1,
  'employee_profiles survives the cascade — it is user-scoped, not event-scoped'
);

select * from finish();
rollback;
