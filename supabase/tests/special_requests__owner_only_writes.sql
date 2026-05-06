set search_path to public, tap, extensions;
-- The two SECURITY DEFINER RPCs that back the itinerary edit dialog
-- (update_accommodation_special_requests + update_transport_request_special_requests)
-- must accept writes from the row owner and reject everyone else.
-- Without these guards a guest could edit a stranger's hotel notes.
begin;
select plan(8);

-- Two attendees, two unrelated rows: alice owns a hotel + a transport
-- request, bob is a bystander on the same event. We exercise both the
-- happy path (owner can write) and the failure path (bystander 42501s).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000005a1', 'pgtap.alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005b0', 'pgtap.bob@example.com',   'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-0000000005a1', 'pgtap.alice@example.com', 'employee', 'h_alice', 'sso'),
  ('00000000-0000-0000-0000-0000000005b0', 'pgtap.bob@example.com',   'employee', 'h_bob',   'sso');

-- Reuse the active supafest event seeded by 2027-supafest.sql.
with e as (
  select id from public.events where is_active and type = 'company_offsite' limit 1
)
insert into public.accommodations (
  id, event_id, hotel_name, room_type, capacity, check_in, check_out
) values (
  '00000000-0000-0000-0000-00000000acc1',
  (select id from e),
  'Fairmont Banff Springs',
  'standard',
  2,
  '2027-01-12',
  '2027-01-15'
);

insert into public.accommodation_occupants (accommodation_id, user_id, is_primary) values
  ('00000000-0000-0000-0000-00000000acc1', '00000000-0000-0000-0000-0000000005a1', true);

insert into public.transport_requests (
  id, user_id, direction, pickup_at, pickup_tz, passenger_count
) values (
  '00000000-0000-0000-0000-00000000777a',
  '00000000-0000-0000-0000-0000000005a1',
  'arrival',
  '2027-01-12T15:00:00Z',
  'America/Edmonton',
  1
);

-- ALICE (owner) updates her hotel note: success + value lands.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select lives_ok(
  $$ select public.update_accommodation_special_requests(
       '00000000-0000-0000-0000-00000000acc1'::uuid,
       'Need a crib in the room'
     ) $$,
  'occupant can update accommodation special_requests'
);

select lives_ok(
  $$ select public.update_transport_request_special_requests(
       '00000000-0000-0000-0000-00000000777a'::uuid,
       'Departing 30 min earlier than group'
     ) $$,
  'requester can update transport_request special_requests'
);

-- Reset role so the readback bypasses RLS — we're verifying the
-- function wrote the column, not the SELECT policies (which have
-- their own coverage elsewhere).
reset role;
select is(
  (select special_requests from public.accommodations where id = '00000000-0000-0000-0000-00000000acc1'),
  'Need a crib in the room',
  'accommodation special_requests written by owner'
);
select is(
  (select special_requests from public.transport_requests where id = '00000000-0000-0000-0000-00000000777a'),
  'Departing 30 min earlier than group',
  'transport_request special_requests written by owner'
);

-- Whitespace-only input should null-out the column (mirrors the trim+nullif).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select public.update_accommodation_special_requests(
  '00000000-0000-0000-0000-00000000acc1'::uuid,
  '   '
);
reset role;
select is(
  (select special_requests from public.accommodations where id = '00000000-0000-0000-0000-00000000acc1'),
  null::text,
  'whitespace-only input clears accommodation special_requests'
);

-- BOB (not an occupant, not the requester) is rejected on both RPCs.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005b0","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select throws_ok(
  $$ select public.update_accommodation_special_requests(
       '00000000-0000-0000-0000-00000000acc1'::uuid,
       'i should not be able to write this'
     ) $$,
  '42501',
  'not an occupant',
  'non-occupant rejected from accommodation update'
);

select throws_ok(
  $$ select public.update_transport_request_special_requests(
       '00000000-0000-0000-0000-00000000777a'::uuid,
       'i should not be able to write this either'
     ) $$,
  '42501',
  'not the requester',
  'non-requester rejected from transport_request update'
);

-- Anonymous (no JWT) is rejected on both RPCs.
reset role;
set local request.jwt.claims to '';
select throws_ok(
  $$ select public.update_accommodation_special_requests(
       '00000000-0000-0000-0000-00000000acc1'::uuid, 'x'
     ) $$,
  '42501',
  'unauthenticated',
  'anonymous caller rejected from accommodation update'
);

select * from finish();
rollback;
