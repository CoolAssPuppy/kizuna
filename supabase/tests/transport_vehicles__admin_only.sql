set search_path to public, tap, extensions;
-- transport_vehicles is the fleet roster used by the Ground Transport
-- admin tool. Admins manage the rows; passengers (employees, guests)
-- never see vehicle metadata directly — they see their assignment via
-- transport_requests.assigned_vehicle_id which the admin sets.
begin;
select plan(4);

insert into public.events (id, name, type, location, start_date, end_date, time_zone) values
  ('00000000-0000-0000-0000-cb00cb00cb01', 'Vehicles RLS', 'team_offsite', 'Banff', '2027-01-10', '2027-01-12', 'America/Edmonton');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-cb00cb00cb10', 'admin@vehi.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-cb00cb00cb11', 'employee@vehi.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-cb00cb00cb10', 'admin@vehi.test',    'admin',    'h_vehi_admin', null, 'sso'),
  ('00000000-0000-0000-0000-cb00cb00cb11', 'employee@vehi.test', 'employee', 'h_vehi_emp',   null, 'sso');

set local role authenticated;

-- Admin can insert.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cb00cb00cb10","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.transport_vehicles
      (id, event_id, vehicle_name, direction, pickup_at, pickup_tz, capacity_passengers, capacity_bags, provider)
    values
      ('00000000-0000-0000-0000-cb00cb001001',
       '00000000-0000-0000-0000-cb00cb00cb01',
       'Coach 1',
       'arrival',
       '2027-01-10 16:00:00+00',
       'America/Edmonton',
       45, 60, 'Banff Sprinters')$$,
  'admin can insert a transport vehicle'
);

-- Admin can read it back.
select is(
  (select vehicle_name from public.transport_vehicles where id = '00000000-0000-0000-0000-cb00cb001001'),
  'Coach 1',
  'admin can read transport vehicles'
);

-- Employee cannot read the vehicle list.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-cb00cb00cb11","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.transport_vehicles),
  0,
  'employee cannot read transport_vehicles'
);

-- Employee write blocked.
select throws_ok(
  $$insert into public.transport_vehicles
      (event_id, vehicle_name, direction, pickup_at, pickup_tz, capacity_passengers, capacity_bags)
    values ('00000000-0000-0000-0000-cb00cb00cb01', 'Imposter', 'arrival',
            '2027-01-10 16:00:00+00', 'America/Edmonton', 1, 1)$$,
  '42501',
  null,
  'employee cannot insert transport vehicles'
);

select * from finish();
rollback;
