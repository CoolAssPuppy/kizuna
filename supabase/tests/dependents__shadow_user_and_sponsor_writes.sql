set search_path to public, tap, extensions;
-- Dependents = under-18 additional_guests. The schema mints a SHADOW
-- public.users row for each dependent (role='dependent', no
-- auth.users counterpart) so per-section tables keyed on user_id work
-- for them too. The sponsor (and admins) can write into the
-- dependent's per-section data via the relaxed is_self_or_admin()
-- helper.
begin;
select plan(5);

-- Setup: sponsoring employee.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000d0001', 'sponsor.dep@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000d0001', 'sponsor.dep@example.com', 'employee', 'h_dep_sponsor', 'sso');

-- 1. additional_guests insert mints a public.users shadow row.
insert into public.additional_guests (sponsor_id, full_name, age_bracket, fee_amount)
values ('00000000-0000-0000-0000-0000000d0001', 'Tiny Dep', 'under_12', 0)
returning id, user_id \gset

select isnt(
  :'user_id'::uuid,
  null::uuid,
  'additional_guests insert populates user_id via the shadow trigger'
);

-- 2. The shadow public.users row exists with role='dependent'.
select is(
  (select role::text from public.users where id = :'user_id'::uuid),
  'dependent',
  'shadow user row is role=dependent'
);

-- 3. Sponsor of the dependent can write into a per-section table that
--    uses is_self_or_admin (e.g. dietary_preferences).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000d0001","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select lives_ok(
  format(
    $sql$ insert into public.dietary_preferences (user_id, restrictions, allergies)
          values ('%s', array['vegetarian'], array[]::text[]) $sql$,
    :'user_id'
  ),
  'sponsor can write dietary_preferences for their dependent'
);

reset role;
select is(
  (select restrictions[1] from public.dietary_preferences where user_id = :'user_id'::uuid),
  'vegetarian',
  'dependent dietary row landed under the dependent user_id'
);

-- 4. An UNRELATED employee cannot write into the dependent's data.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000d0002', 'rando.dep@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000d0002', 'rando.dep@example.com', 'employee', 'h_dep_rando', 'sso');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000d0002","role":"authenticated","app_role":"employee","aud":"authenticated"}';

prepare insert_unrelated as
  insert into public.dietary_preferences (user_id, restrictions, allergies)
  values ('00000000-0000-0000-0000-0000000d0001', array['vegan'], array[]::text[]);

-- An unrelated employee is blocked by RLS WITH CHECK. Postgres returns
-- 42501 (insufficient_privilege) when the WITH CHECK clause fails.
-- Note: we attempt to write under the SPONSOR's user_id; for the
-- dependent's user_id the rando isn't the sponsor either, so the same
-- block applies.
select throws_ok(
  'execute insert_unrelated',
  '42501',
  null,
  'unrelated employee cannot write dietary_preferences for someone else'
);

select * from finish();
rollback;
