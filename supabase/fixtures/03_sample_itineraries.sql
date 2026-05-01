-- Sample travel itineraries.
--
-- For every seeded employee EXCEPT Jean-Luc Picard (the lone super_admin
-- who anchors the empty-itinerary state for QA), this fixture creates:
--   * inbound flight from their nearest IATA on 2027-01-11
--   * outbound flight back home on 2027-01-15
--
-- Flights are designed for the Ground Transport Tool demo:
--   * 12 distinct inbound flights and 12 distinct outbound flights.
--   * Arrival times are spread across 9 different 30-min windows so the
--     window-bucket UI shows real diversity.
--   * Multiple cities map to the SAME flight tuple (airline + flight_number
--     + arrival_at) so within a window the screen can sub-group same-flight
--     passengers — exactly the case admins need to see when assigning a
--     single shuttle to one inbound flight.
--
-- Accommodation and ground transport are intentionally NOT seeded — the
-- admin Ground Transport Tool drives those assignments from this flight
-- data, and the Room Assignment Tool is being built in a parallel workstream.
--
-- The flights triggers materialise rows into itinerary_items automatically.
-- Idempotent: re-running is safe (we don't set perk_booking_ref).
--
-- Storage is canonical UTC (Postgres `timestamptz` always stores UTC). The
-- `*_tz` companion columns are how the SPA knows which IANA zone to render
-- each row in.

begin;

-- =====================================================================
-- City -> route lookup. One row per seeded base_city, mapping it to:
--   * the user's home IATA + tz (origin on inbound, destination on outbound)
--   * a SHARED inbound flight tuple (airline, flight_number, departure_at,
--     arrival_at) — multiple cities can resolve to the same flight so
--     several seeded users end up "on the same flight".
--   * a SHARED outbound flight tuple, same pattern.
--
-- All timestamps stored as UTC literals. The departure_tz column on
-- flights renders origin-local on screen.
-- =====================================================================
create temp table _route_for_city (
  city                  text primary key,
  iata                  text not null,
  tz                    text not null,
  -- Inbound (home -> YYC, 2027-01-11)
  inbound_airline       text not null,
  inbound_flight_number text not null,
  inbound_departure_at  timestamptz not null,
  inbound_arrival_at    timestamptz not null,
  -- Outbound (YYC -> home, 2027-01-15 / -16)
  outbound_airline       text not null,
  outbound_flight_number text not null,
  outbound_departure_at  timestamptz not null,
  outbound_arrival_at    timestamptz not null
) on commit drop;

-- Window legend (UTC -> Mountain Time at YYC):
--   16:00 UTC = 09:00 MT  -- early morning bucket
--   18:30 UTC = 11:30 MT  -- late morning bucket
--   19:00 UTC = 12:00 MT  -- noon bucket
--   20:30 UTC = 13:30 MT  -- early afternoon bucket
--   21:00 UTC = 14:00 MT  -- mid afternoon bucket
--   22:30 UTC = 15:30 MT  -- late afternoon bucket
--   00:00+1 UTC = 17:00 MT -- early evening bucket
--   01:30+1 UTC = 18:30 MT -- evening bucket
--   03:00+1 UTC = 20:00 MT -- night bucket
insert into _route_for_city (city, iata, tz,
  inbound_airline, inbound_flight_number, inbound_departure_at, inbound_arrival_at,
  outbound_airline, outbound_flight_number, outbound_departure_at, outbound_arrival_at) values
  -- ===== West coast cluster -> Air Canada 101 (arr 21:00 UTC = 14:00 MT) =====
  ('San Francisco',  'SFO', 'America/Los_Angeles', 'Air Canada','101', '2027-01-11 17:30:00+00', '2027-01-11 21:00:00+00', 'Air Canada','102', '2027-01-15 23:00:00+00', '2027-01-16 02:30:00+00'),
  ('Los Angeles',    'LAX', 'America/Los_Angeles', 'Air Canada','101', '2027-01-11 17:30:00+00', '2027-01-11 21:00:00+00', 'Air Canada','102', '2027-01-15 23:00:00+00', '2027-01-16 02:30:00+00'),
  ('Seattle',        'SEA', 'America/Los_Angeles', 'Air Canada','101', '2027-01-11 17:30:00+00', '2027-01-11 21:00:00+00', 'Air Canada','102', '2027-01-15 23:00:00+00', '2027-01-16 02:30:00+00'),
  ('Portland',       'PDX', 'America/Los_Angeles', 'Air Canada','101', '2027-01-11 17:30:00+00', '2027-01-11 21:00:00+00', 'Air Canada','102', '2027-01-15 23:00:00+00', '2027-01-16 02:30:00+00'),
  -- ===== SoCal/Vegas cluster -> WestJet 220 (arr 19:00 UTC = 12:00 MT) =====
  ('Las Vegas',      'LAS', 'America/Los_Angeles', 'WestJet',   '220', '2027-01-11 16:00:00+00', '2027-01-11 19:00:00+00', 'WestJet',   '221', '2027-01-15 21:30:00+00', '2027-01-16 00:30:00+00'),
  ('San Diego',      'SAN', 'America/Los_Angeles', 'WestJet',   '220', '2027-01-11 16:00:00+00', '2027-01-11 19:00:00+00', 'WestJet',   '221', '2027-01-15 21:30:00+00', '2027-01-16 00:30:00+00'),
  ('Phoenix',        'PHX', 'America/Phoenix',     'WestJet',   '220', '2027-01-11 16:00:00+00', '2027-01-11 19:00:00+00', 'WestJet',   '221', '2027-01-15 21:30:00+00', '2027-01-16 00:30:00+00'),
  -- ===== Mountain time -> Air Canada 311 (arr 18:30 UTC = 11:30 MT) =====
  ('Denver',         'DEN', 'America/Denver',      'Air Canada','311', '2027-01-11 16:30:00+00', '2027-01-11 18:30:00+00', 'Air Canada','312', '2027-01-15 21:00:00+00', '2027-01-15 23:00:00+00'),
  ('Albuquerque',    'ABQ', 'America/Denver',      'Air Canada','311', '2027-01-11 16:30:00+00', '2027-01-11 18:30:00+00', 'Air Canada','312', '2027-01-15 21:00:00+00', '2027-01-15 23:00:00+00'),
  -- ===== Texas cluster -> WestJet 408 (arr 22:30 UTC = 15:30 MT) =====
  ('Austin',         'AUS', 'America/Chicago',     'WestJet',   '408', '2027-01-11 19:00:00+00', '2027-01-11 22:30:00+00', 'WestJet',   '409', '2027-01-15 18:00:00+00', '2027-01-15 21:30:00+00'),
  ('Dallas',         'DFW', 'America/Chicago',     'WestJet',   '408', '2027-01-11 19:00:00+00', '2027-01-11 22:30:00+00', 'WestJet',   '409', '2027-01-15 18:00:00+00', '2027-01-15 21:30:00+00'),
  ('Houston',        'IAH', 'America/Chicago',     'WestJet',   '408', '2027-01-11 19:00:00+00', '2027-01-11 22:30:00+00', 'WestJet',   '409', '2027-01-15 18:00:00+00', '2027-01-15 21:30:00+00'),
  -- ===== Midwest cluster -> Air Canada 525 (arr 20:30 UTC = 13:30 MT) =====
  ('Chicago',        'ORD', 'America/Chicago',     'Air Canada','525', '2027-01-11 17:00:00+00', '2027-01-11 20:30:00+00', 'Air Canada','526', '2027-01-15 22:00:00+00', '2027-01-16 01:30:00+00'),
  ('Minneapolis',    'MSP', 'America/Chicago',     'Air Canada','525', '2027-01-11 17:00:00+00', '2027-01-11 20:30:00+00', 'Air Canada','526', '2027-01-15 22:00:00+00', '2027-01-16 01:30:00+00'),
  ('New Orleans',    'MSY', 'America/Chicago',     'Air Canada','525', '2027-01-11 17:00:00+00', '2027-01-11 20:30:00+00', 'Air Canada','526', '2027-01-15 22:00:00+00', '2027-01-16 01:30:00+00'),
  ('Springfield',    'SPI', 'America/Chicago',     'Air Canada','525', '2027-01-11 17:00:00+00', '2027-01-11 20:30:00+00', 'Air Canada','526', '2027-01-15 22:00:00+00', '2027-01-16 01:30:00+00'),
  ('Bloomington',    'IND', 'America/Indiana/Indianapolis', 'Air Canada','525', '2027-01-11 17:00:00+00', '2027-01-11 20:30:00+00', 'Air Canada','526', '2027-01-15 22:00:00+00', '2027-01-16 01:30:00+00'),
  -- ===== East coast cluster -> Air Canada 712 (arr 16:00 UTC = 09:00 MT) =====
  ('Atlanta',        'ATL', 'America/New_York',    'Air Canada','712', '2027-01-11 12:00:00+00', '2027-01-11 16:00:00+00', 'Air Canada','713', '2027-01-15 17:00:00+00', '2027-01-15 21:00:00+00'),
  ('Miami',          'MIA', 'America/New_York',    'Air Canada','712', '2027-01-11 12:00:00+00', '2027-01-11 16:00:00+00', 'Air Canada','713', '2027-01-15 17:00:00+00', '2027-01-15 21:00:00+00'),
  ('Boston',         'BOS', 'America/New_York',    'Air Canada','712', '2027-01-11 12:00:00+00', '2027-01-11 16:00:00+00', 'Air Canada','713', '2027-01-15 17:00:00+00', '2027-01-15 21:00:00+00'),
  ('New York',       'JFK', 'America/New_York',    'Air Canada','712', '2027-01-11 12:00:00+00', '2027-01-11 16:00:00+00', 'Air Canada','713', '2027-01-15 17:00:00+00', '2027-01-15 21:00:00+00'),
  -- ===== Toronto solo -> WestJet 808 (arr 00:00+1 UTC = 17:00 MT) =====
  ('Toronto',        'YYZ', 'America/Toronto',     'WestJet',   '808', '2027-01-11 21:00:00+00', '2027-01-12 00:00:00+00', 'WestJet',   '809', '2027-01-15 19:30:00+00', '2027-01-15 22:30:00+00'),
  -- ===== Mexico City solo -> AeroMexico 904 (arr 21:00 UTC = 14:00 MT) =====
  ('Mexico City',    'MEX', 'America/Mexico_City', 'AeroMexico','904', '2027-01-11 16:00:00+00', '2027-01-11 21:00:00+00', 'AeroMexico','905', '2027-01-15 22:00:00+00', '2027-01-16 03:00:00+00'),
  -- ===== UK cluster -> British Airways 103 (arr 01:30+1 UTC = 18:30 MT) =====
  ('London',         'LHR', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Manchester',     'MAN', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Edinburgh',      'EDI', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Birmingham',     'BHX', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Cardiff',        'CWL', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Bristol',        'BRS', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Cambridge',      'STN', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Devon',          'EXT', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Forest of Dean', 'BRS', 'Europe/London',           'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Mould-on-the-Wold', 'BHX', 'Europe/London',        'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Godric''s Hollow', 'BHX', 'Europe/London',         'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  ('Ottery St Catchpole', 'EXT', 'Europe/London',      'British Airways','103', '2027-01-11 11:00:00+00', '2027-01-12 01:30:00+00', 'British Airways','104', '2027-01-15 17:00:00+00', '2027-01-16 06:30:00+00'),
  -- ===== CET cluster -> Lufthansa 470 (arr 03:00+1 UTC = 20:00 MT) =====
  ('Paris',          'CDG', 'Europe/Paris',  'Lufthansa','470', '2027-01-11 11:30:00+00', '2027-01-12 03:00:00+00', 'Lufthansa','471', '2027-01-15 18:30:00+00', '2027-01-16 09:00:00+00'),
  ('Berlin',         'BER', 'Europe/Berlin', 'Lufthansa','470', '2027-01-11 11:30:00+00', '2027-01-12 03:00:00+00', 'Lufthansa','471', '2027-01-15 18:30:00+00', '2027-01-16 09:00:00+00'),
  ('Naboo',          'FCO', 'Europe/Rome',   'Lufthansa','470', '2027-01-11 11:30:00+00', '2027-01-12 03:00:00+00', 'Lufthansa','471', '2027-01-15 18:30:00+00', '2027-01-16 09:00:00+00'),
  ('Lisbon',         'LIS', 'Europe/Lisbon', 'Lufthansa','470', '2027-01-11 11:30:00+00', '2027-01-12 03:00:00+00', 'Lufthansa','471', '2027-01-15 18:30:00+00', '2027-01-16 09:00:00+00'),
  -- ===== Asia / Oceania solos: distinct flights to spread the late windows =====
  ('Bengaluru',      'BLR', 'Asia/Kolkata',     'Air India',       '188', '2027-01-11 14:00:00+00', '2027-01-12 03:00:00+00', 'Air India',       '189', '2027-01-15 19:00:00+00', '2027-01-16 12:00:00+00'),
  ('Hong Kong',      'HKG', 'Asia/Hong_Kong',   'Cathay Pacific',  '888', '2027-01-11 13:00:00+00', '2027-01-12 01:30:00+00', 'Cathay Pacific',  '889', '2027-01-15 18:00:00+00', '2027-01-16 11:30:00+00'),
  ('Sydney',         'SYD', 'Australia/Sydney', 'Qantas',          '007', '2027-01-11 06:00:00+00', '2027-01-11 22:30:00+00', 'Qantas',          '008', '2027-01-15 17:00:00+00', '2027-01-16 14:00:00+00');


-- =====================================================================
-- Inbound (home -> YYC) for everyone except Picard.
-- =====================================================================
insert into public.flights (
  user_id, direction, origin, destination,
  departure_at, departure_tz, arrival_at, arrival_tz,
  airline, flight_number, source, is_confirmed
)
select
  u.id,
  'inbound',
  r.iata,
  'YYC',
  r.inbound_departure_at,
  r.tz,
  r.inbound_arrival_at,
  'America/Edmonton',
  r.inbound_airline,
  r.inbound_flight_number,
  'manual_obs',
  true
from public.users u
join public.employee_profiles ep on ep.user_id = u.id
join _route_for_city r on r.city = ep.base_city
where u.id <> 'a0000000-0000-0000-0000-000000000001'
  and u.role <> 'guest';


-- =====================================================================
-- Outbound (YYC -> home) for everyone except Picard.
-- =====================================================================
insert into public.flights (
  user_id, direction, origin, destination,
  departure_at, departure_tz, arrival_at, arrival_tz,
  airline, flight_number, source, is_confirmed
)
select
  u.id,
  'outbound',
  'YYC',
  r.iata,
  r.outbound_departure_at,
  'America/Edmonton',
  r.outbound_arrival_at,
  r.tz,
  r.outbound_airline,
  r.outbound_flight_number,
  'manual_obs',
  true
from public.users u
join public.employee_profiles ep on ep.user_id = u.id
join _route_for_city r on r.city = ep.base_city
where u.id <> 'a0000000-0000-0000-0000-000000000001'
  and u.role <> 'guest';


-- =====================================================================
-- Spread ground_transport_need across the seeded attendee_profiles so
-- the Ground Transport Tool surface has a representative mix:
--   * id ending 0/4/8 -> 'both'
--   * id ending 1/5/9 -> 'arrival'
--   * id ending 2/6   -> 'departure'
--   * id ending 3/7   -> 'none'
-- The remaining users keep the schema default of 'none'.
-- =====================================================================
update public.attendee_profiles ap
set ground_transport_need = case (right(ap.user_id::text, 1))
  when '0' then 'both'::ground_transport_need
  when '4' then 'both'::ground_transport_need
  when '8' then 'both'::ground_transport_need
  when '1' then 'arrival'::ground_transport_need
  when '5' then 'arrival'::ground_transport_need
  when '9' then 'arrival'::ground_transport_need
  when '2' then 'departure'::ground_transport_need
  when '6' then 'departure'::ground_transport_need
  else 'none'::ground_transport_need
end;


commit;
