set search_path to public, tap, extensions;
-- Guests with syncs_with_sponsor=true can read the sponsoring
-- employee's itinerary_items rows. Without that flag, the row stays
-- invisible — the guest only sees their own items.
begin;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000070', 'sponsor@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000071', 'guest@example.com',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000072', 'rando@example.com',   'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-000000000070', 'sponsor@example.com', 'employee', 'h_sponsor', null, 'sso'),
  ('00000000-0000-0000-0000-000000000071', 'guest@example.com',   'guest',    null,        '00000000-0000-0000-0000-000000000070', 'email_password'),
  ('00000000-0000-0000-0000-000000000072', 'rando@example.com',   'employee', 'h_rando',   null, 'sso');

-- payment_status='paid' so the guard_guest_profile_completion trigger
-- (which blocks legal_name from landing until the sponsor's fees are
-- settled) does not interfere with this itinerary-sync test.
insert into public.guest_profiles (user_id, sponsor_id, full_name, legal_name, relationship, fee_amount, payment_status, syncs_with_sponsor)
values (
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000070',
  'Sample Guest', 'Sample Guest', 'partner', 950.00, 'paid', false
);

-- Reuse the active supafest event seeded by 2027-supafest.sql so we
-- don't trip the events_one_active_supafest_idx partial unique.
insert into public.itinerary_items (
  user_id, event_id, item_type, source, title, starts_at, starts_tz
)
select
  '00000000-0000-0000-0000-000000000070',
  e.id,
  'flight',
  'assigned',
  'Sponsor flight',
  '2027-01-12T08:00:00Z',
  e.time_zone
from public.events e
where e.is_active and e.type = 'supafest'
limit 1;

-- Guest with sync OFF: cannot see sponsor's row
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000071","role":"authenticated","app_role":"guest","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.itinerary_items
    where user_id = '00000000-0000-0000-0000-000000000070'
  ),
  0,
  'guest with sync OFF cannot read sponsor itinerary'
);

-- Flip sync ON via the postgres role (bypasses RLS) so we can test the
-- read path independently of the write path.
reset role;
update public.guest_profiles
   set syncs_with_sponsor = true
 where user_id = '00000000-0000-0000-0000-000000000071';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000071","role":"authenticated","app_role":"guest","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.itinerary_items
    where user_id = '00000000-0000-0000-0000-000000000070'
  ),
  1,
  'guest with sync ON can read sponsor itinerary'
);

-- An unrelated employee never sees the sponsor's rows via this path.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000072","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (
    select count(*)::int from public.itinerary_items
    where user_id = '00000000-0000-0000-0000-000000000070'
  ),
  0,
  'unrelated employee does not gain access via the guest-sync policy'
);

select * from finish();
rollback;
