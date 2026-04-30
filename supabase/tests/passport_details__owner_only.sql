set search_path to public, tap, extensions;
-- Passport details are visible only to the owning user. Admins cannot SELECT.
begin;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a001', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a002', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000a003', 'admin@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-00000000a001', 'alice@example.com', 'employee', 'hibob_a1', 'sso'),
  ('00000000-0000-0000-0000-00000000a002', 'bob@example.com', 'employee', 'hibob_b1', 'sso'),
  ('00000000-0000-0000-0000-00000000a003', 'admin@example.com', 'admin', 'hibob_a3', 'sso');

-- Insert as superuser bypassing RLS
insert into public.passport_details (user_id, passport_name, passport_number_encrypted, issuing_country, expiry_date)
values
  ('00000000-0000-0000-0000-00000000a001', 'ALICE A', '\xdeadbeef', 'US', '2030-01-01'),
  ('00000000-0000-0000-0000-00000000a002', 'BOB B',   '\xfeed', 'US', '2030-01-01');

-- As alice, exactly one row visible (her own)
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is((select count(*)::int from public.passport_details), 1, 'alice sees only her passport');

-- As bob, exactly one row visible (his own)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is((select count(*)::int from public.passport_details), 1, 'bob sees only his passport');

-- As admin, ZERO rows visible (admins are blocked from passport_details entirely)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is((select count(*)::int from public.passport_details), 0, 'admin cannot see any passport rows');

select * from finish();
rollback;
