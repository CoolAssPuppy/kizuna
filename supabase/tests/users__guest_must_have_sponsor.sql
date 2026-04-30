set search_path to public, tap, extensions;
-- Guest role requires a sponsor; non-guest must not have one.
begin;
select plan(2);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000000040', 'sponsor@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000041', 'orphan@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000040', 'sponsor@example.com', 'employee', 'hibob_sp', 'sso');

-- Inserting a guest without sponsor should fail
select throws_ok(
  $$insert into public.users (id, email, role, sponsor_id, auth_provider)
    values ('00000000-0000-0000-0000-000000000041', 'orphan@example.com', 'guest', null, 'email_password')$$,
  '23514',
  null,
  'guest without sponsor is rejected by check constraint'
);

-- Inserting an employee with a sponsor should fail
select throws_ok(
  format(
    $$insert into public.users (id, email, role, sponsor_id, auth_provider)
      values ('00000000-0000-0000-0000-000000000042', 'imposter@example.com', 'employee', %L, 'sso')$$,
    '00000000-0000-0000-0000-000000000040'
  ),
  '23514',
  null,
  'employee with sponsor is rejected by check constraint'
);

select * from finish();
rollback;
