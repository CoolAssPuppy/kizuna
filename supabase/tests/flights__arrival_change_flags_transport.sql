set search_path to public, tap, extensions;
-- When flights change materially, linked transport_requests are flagged for
-- review AND any previously assigned vehicle is unassigned. The admin must
-- then reassign through the Ground Transport Tool.
begin;
select plan(4);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000020', 'flyer@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000020', 'flyer@example.com', 'employee', 'hibob_flyer', 'sso');

-- Event for the vehicle row's event_id FK. Not active so we don't trip the
-- one-active-supafest unique index against any seeded event.
insert into public.events (id, name, type, location, time_zone, start_date, end_date)
values ('00000000-0000-0000-0000-0000000000e1', 'Test 2027', 'company_offsite', 'Calgary',
        'America/Edmonton', '2027-04-01', '2027-04-05');

insert into public.transport_vehicles (id, event_id, vehicle_name, direction, pickup_at, pickup_tz, capacity_passengers, capacity_bags)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
        'Shuttle A', 'arrival', '2027-04-01 13:30:00+00', 'America/Edmonton', 8, 12);

insert into public.flights (id, user_id, direction, origin, destination, departure_at, departure_tz, arrival_at, arrival_tz, source, airline, flight_number)
values ('00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-000000000020',
        'inbound', 'SFO', 'YYC',
        '2027-04-01 10:00:00+00', 'America/Los_Angeles',
        '2027-04-01 13:00:00+00', 'America/Edmonton',
        'manual_obs', 'Air Canada', '123');

insert into public.transport_requests (id, user_id, flight_id, direction, pickup_at, pickup_tz, passenger_count, assigned_vehicle_id, needs_review)
values ('00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-0000000000f1',
        'arrival',
        '2027-04-01 13:30:00+00', 'America/Edmonton',
        1,
        '00000000-0000-0000-0000-0000000000d1',
        false);

-- Baseline: assigned with needs_review false
select is(
  (select needs_review from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  false,
  'transport_request starts with needs_review = false'
);
select is(
  (select assigned_vehicle_id from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'transport_request starts with vehicle assigned'
);

-- Update flight arrival -> trigger fires
update public.flights set arrival_at = '2027-04-01 14:00:00+00'
where id = '00000000-0000-0000-0000-0000000000f1';

select is(
  (select needs_review from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  true,
  'arrival_at change cascades to needs_review = true'
);
select is(
  (select assigned_vehicle_id from public.transport_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  null::uuid,
  'arrival_at change clears assigned_vehicle_id so admin must reassign'
);

select * from finish();
rollback;
