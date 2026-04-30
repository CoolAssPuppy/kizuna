set search_path to public, tap, extensions;
-- A user can SELECT their own registration row. Other users cannot.
begin;
select plan(2);

-- Arrange: two employees, each with their own registration.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', 'employee', 'hibob_alice', 'sso'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com', 'employee', 'hibob_bob', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active)
values ('00000000-0000-0000-0000-00000000ee01', 'Test Event', 'supafest', current_date, current_date + 7, false);

insert into public.registrations (user_id, event_id, status)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000ee01', 'started'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000ee01', 'started');

-- Act + assert: as alice, only alice's registration is visible.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select is(
  (select count(*)::int from public.registrations),
  1,
  'alice sees exactly one registration row'
);

select is(
  (select user_id::text from public.registrations),
  '00000000-0000-0000-0000-000000000001',
  'and that row is alice''s'
);

select * from finish();
rollback;
