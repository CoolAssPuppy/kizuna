set search_path to public, tap, extensions;
-- Guest age-bracket pricing + the guard_guest_profile_completion gate.
--
-- Covers:
--   1. guest_fee_for_bracket() returns the launch tiers exactly.
--   2. set_guest_fee_amount() trigger stamps fee_amount on insert
--      (additional_guests AND guest_invitations BIU triggers).
--   3. additional_guests rejects age_bracket = 'adult'.
--   4. guest_profiles rejects age_bracket != 'adult'.
--   5. Gate blocks legal_name when the sponsor still has unpaid fees.
--   6. Gate releases legal_name once every guest's payment_status is
--      'paid' (or 'waived').
--   7. Gate blocks the row's OWN unpaid status (not just siblings).
begin;
select plan(10);

-- =====================================================================
-- 1. Pricing
-- =====================================================================
select is(
  public.guest_fee_for_bracket('under_12'),
  200.00::numeric,
  'under_12 bracket prices at $200'
);
select is(
  public.guest_fee_for_bracket('teen'),
  500.00::numeric,
  'teen bracket prices at $500'
);
select is(
  public.guest_fee_for_bracket('adult'),
  950.00::numeric,
  'adult bracket prices at $950'
);


-- =====================================================================
-- 2. Sponsor + minor row triggers fee_amount via the BIU trigger.
-- =====================================================================
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000001100', 'sponsor-fee@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000001100', 'sponsor-fee@example.com', 'employee', 'h_sponsor_fee', 'sso');

insert into public.additional_guests (id, sponsor_id, first_name, last_name, age_bracket, fee_amount)
values (
  '00000000-0000-0000-0000-000000001110',
  '00000000-0000-0000-0000-000000001100',
  'Tiny',
  'Human',
  'under_12',
  -- The BIU trigger overwrites this; pass an obviously wrong number to
  -- prove the fee tier always wins.
  0.00
);

select is(
  (select fee_amount from public.additional_guests where id = '00000000-0000-0000-0000-000000001110'),
  200.00::numeric,
  'set_guest_fee_amount trigger stamps the bracket price on insert'
);

-- Same trigger fires on guest_invitations: passing in a wrong fee at
-- the SQL boundary must be overwritten by the bracket price (covers
-- set_guest_invitation_fee_biu specifically).
insert into public.guest_invitations (
  id, sponsor_id, guest_email, first_name, last_name, age_bracket, fee_amount, signed_token, expires_at
) values (
  '00000000-0000-0000-0000-000000001112',
  '00000000-0000-0000-0000-000000001100',
  'invitee-fee@example.com',
  'Adult',
  'Invitee',
  'adult',
  -- Pass an under-quoted fee. The trigger should overwrite to the
  -- adult bracket price ($950) before the row lands.
  1.00,
  'pgtap-token-1112',
  now() + interval '7 days'
);

select is(
  (select fee_amount from public.guest_invitations where id = '00000000-0000-0000-0000-000000001112'),
  950.00::numeric,
  'set_guest_invitation_fee_biu stamps adult bracket price on insert'
);


-- =====================================================================
-- 3. additional_guests CHECK rejects adult.
-- =====================================================================
prepare insert_adult_minor as
insert into public.additional_guests (sponsor_id, first_name, last_name, age_bracket, fee_amount)
values (
  '00000000-0000-0000-0000-000000001100',
  'Should',
  'Fail',
  'adult',
  950.00
);
select throws_ok(
  'execute insert_adult_minor',
  '23514',
  null,
  'additional_guests rejects age_bracket = adult via CHECK constraint'
);


-- =====================================================================
-- 4. Gate blocks legal_name while a sibling fee is unpaid.
--    First insert a paid guest_profile so the row exists, then
--    introduce an unpaid additional_guests row, then attempt to update
--    the guest_profile's legal_name.
-- =====================================================================
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000001120', 'guest-adult@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider)
values (
  '00000000-0000-0000-0000-000000001120',
  'guest-adult@example.com',
  'guest',
  null,
  '00000000-0000-0000-0000-000000001100',
  'email_password'
);

-- Mark the existing minor row paid so the first guest_profiles insert
-- below isn't blocked by it.
update public.additional_guests
   set payment_status = 'paid'
 where id = '00000000-0000-0000-0000-000000001110';

insert into public.guest_profiles (id, user_id, sponsor_id, first_name, last_name, legal_name, relationship, fee_amount, payment_status)
values (
  '00000000-0000-0000-0000-000000001130',
  '00000000-0000-0000-0000-000000001120',
  '00000000-0000-0000-0000-000000001100',
  'Adult',
  'Guest',
  'Adult Guest',
  'partner',
  950.00,
  'paid'
);

-- Now add a NEW unpaid minor and try to bump the existing guest's
-- legal_name. The trigger should refuse because the new minor's fee is
-- pending.
insert into public.additional_guests (id, sponsor_id, first_name, last_name, age_bracket)
values (
  '00000000-0000-0000-0000-000000001140',
  '00000000-0000-0000-0000-000000001100',
  'Brand New',
  'Minor',
  'teen'
);

prepare update_locked as
update public.guest_profiles
   set legal_name = 'Adult Guest Updated'
 where id = '00000000-0000-0000-0000-000000001130';
select throws_ok(
  'execute update_locked',
  '42501',
  null,
  'gate blocks legal_name update while a sibling additional_guest is unpaid'
);


-- =====================================================================
-- 5. Settle the new minor; the same update should now succeed.
-- =====================================================================
update public.additional_guests
   set payment_status = 'paid'
 where id = '00000000-0000-0000-0000-000000001140';

update public.guest_profiles
   set legal_name = 'Adult Guest Updated'
 where id = '00000000-0000-0000-0000-000000001130';

select is(
  (select legal_name from public.guest_profiles where id = '00000000-0000-0000-0000-000000001130'),
  'Adult Guest Updated',
  'gate releases legal_name once every sponsor fee is paid'
);


-- =====================================================================
-- 6. guest_profiles rejects non-adult age_bracket.
-- =====================================================================
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000001150', 'should-fail@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider)
values (
  '00000000-0000-0000-0000-000000001150',
  'should-fail@example.com',
  'guest',
  null,
  '00000000-0000-0000-0000-000000001100',
  'email_password'
);

prepare insert_minor_in_adult_table as
insert into public.guest_profiles (
  user_id, sponsor_id, first_name, last_name, legal_name, relationship, age_bracket, fee_amount, payment_status
) values (
  '00000000-0000-0000-0000-000000001150',
  '00000000-0000-0000-0000-000000001100',
  'Minor', 'Person', 'Minor Person',
  'family',
  'teen',
  500.00,
  'paid'
);
select throws_ok(
  'execute insert_minor_in_adult_table',
  '23514',
  null,
  'guest_profiles rejects age_bracket != adult via CHECK constraint'
);


-- =====================================================================
-- 7. Gate also blocks the row's OWN unpaid status (not just siblings).
--    A new guest_profile inserted with payment_status='pending' and a
--    legal_name set must fail even when no other sibling rows exist.
-- =====================================================================
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000001160', 'own-unpaid@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-000000001160', 'own-unpaid@example.com', 'guest', null, '00000000-0000-0000-0000-000000001100', 'email_password');

prepare insert_self_unpaid as
insert into public.guest_profiles (
  user_id, sponsor_id, first_name, last_name, legal_name, relationship, fee_amount, payment_status
) values (
  '00000000-0000-0000-0000-000000001160',
  '00000000-0000-0000-0000-000000001100',
  'Own', 'Unpaid', 'Own Unpaid Legal',
  'partner',
  950.00,
  'pending'
);
select throws_ok(
  'execute insert_self_unpaid',
  '42501',
  'guest_profile_locked_until_paid',
  'gate blocks legal_name when the row''s own payment_status is pending'
);

select * from finish();
rollback;
