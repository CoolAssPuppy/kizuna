set search_path to public, tap, extensions;
-- When flights.arrival_at changes, linked transport_requests are flagged for review.
begin;
select plan(2);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000020', 'flyer@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000020', 'flyer@example.com', 'employee', 'hibob_flyer', 'sso');

insert into public.flights (id, user_id, direction, origin, destination, departure_at, departure_tz, arrival_at, arrival_tz, source)
values ('00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-000000000020',
        'inbound', 'SFO', 'YYC',
        '2027-04-01 10:00:00+00', 'America/Los_Angeles',
        '2027-04-01 13:00:00+00', 'America/Edmonton',
        'manual_obs');

insert into public.transport_requests (id, user_id, flight_id, direction, pickup_datetime, pickup_tz, passenger_count)
values ('00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-0000000000f1',
        'arrival',
        '2027-04-01 13:30:00+00', 'America/Edmonton',
        1);

-- Baseline: needs_review false
select is(
  (select needs_review from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  false,
  'transport_request starts with needs_review = false'
);

-- Update flight arrival
update public.flights set arrival_at = '2027-04-01 14:00:00+00'
where id = '00000000-0000-0000-0000-0000000000f1';

select is(
  (select needs_review from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  true,
  'arrival_at change cascades to needs_review = true'
);

select * from finish();
rollback;
