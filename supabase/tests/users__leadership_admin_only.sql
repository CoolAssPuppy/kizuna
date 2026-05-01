set search_path to public, tap, extensions;
-- is_leadership can only be flipped by admins.
-- Approach: we don't rely on an actual JWT; we simulate the two paths by
-- arranging the BEFORE UPDATE trigger's check (`public.is_admin()`) to
-- return either false (regular user, claim missing + users row not admin)
-- or true (admin path via the admin RPC public.set_user_leadership).
begin;
select plan(4);

-- Two real users in auth + public to exercise the trigger and RPC.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000000050', 'lead-test-admin@example.com',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000051', 'lead-test-victim@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, is_leadership, hibob_id, auth_provider)
values
  ('00000000-0000-0000-0000-000000000050', 'lead-test-admin@example.com',  'admin',    false, 'hibob_lead_admin',  'sso'),
  ('00000000-0000-0000-0000-000000000051', 'lead-test-victim@example.com', 'employee', false, 'hibob_lead_victim', 'sso');

-- Sanity: starting state.
select is(
  (select is_leadership from public.users where id = '00000000-0000-0000-0000-000000000051'),
  false,
  'victim starts with is_leadership=false'
);

-- Path A: a non-admin tries to flip the flag through a normal UPDATE.
-- The trigger inspects public.is_admin(), which returns false because
-- the request.jwt.claims setting carries no app_role and the test session
-- has no auth.uid() row mapping to an admin.
select throws_ok(
  $$update public.users
       set is_leadership = true
     where id = '00000000-0000-0000-0000-000000000051'$$,
  '42501',
  'only admins can change is_leadership',
  'guard rejects non-admin attempting to flip is_leadership'
);

-- Path B: simulate an admin caller by injecting an app_role JWT claim.
-- public.is_admin() checks the claim first, so the trigger sees admin=true
-- and lets the update through.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000050","app_role":"admin"}';

select lives_ok(
  $$update public.users
       set is_leadership = true
     where id = '00000000-0000-0000-0000-000000000051'$$,
  'guard allows admin to flip is_leadership directly'
);

reset request.jwt.claims;

select is(
  (select is_leadership from public.users where id = '00000000-0000-0000-0000-000000000051'),
  true,
  'admin update persisted'
);

select * from finish();
rollback;
