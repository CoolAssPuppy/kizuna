-- Sample travel itineraries.
--
-- For every seeded employee EXCEPT Jean-Luc Picard (the lone super_admin
-- who anchors the empty-itinerary state for QA), this fixture creates:
--   * inbound flight from their nearest IATA on 2027-01-11
--   * outbound flight back home on 2027-01-15
--
-- Accommodation and ground transport are intentionally NOT seeded — the
-- admin "Arrivals" screen drives those assignments from the flight data.
-- (Self-imported hotel + transfer rows still work end-to-end via the
-- itinerary import dialog for users with long layovers.)
--
-- The flights triggers materialise rows into itinerary_items
-- automatically. Idempotent — re-running is safe (no perk_booking_ref
-- conflict because we don't set one).
--
-- Storage is canonical UTC (Postgres `timestamptz` always stores UTC).
-- The `*_tz` companion columns are how the SPA knows which IANA zone to
-- render each row in: a SFO→YYC flight stores both timestamps in UTC and
-- shows departure in PT, arrival in MT.

begin;

-- =====================================================================
-- City + IATA + IANA timezone lookup. Reused below as a CTE so the
-- mapping lives in exactly one place.
-- =====================================================================
create temp table _airport_for_city (city text primary key, iata text, tz text) on commit drop;
insert into _airport_for_city (city, iata, tz) values
  -- North America
  ('San Francisco',  'SFO', 'America/Los_Angeles'),
  ('Los Angeles',    'LAX', 'America/Los_Angeles'),
  ('Las Vegas',      'LAS', 'America/Los_Angeles'),
  ('Seattle',        'SEA', 'America/Los_Angeles'),
  ('Portland',       'PDX', 'America/Los_Angeles'),
  ('San Diego',      'SAN', 'America/Los_Angeles'),
  ('Phoenix',        'PHX', 'America/Phoenix'),
  ('Denver',         'DEN', 'America/Denver'),
  ('Albuquerque',    'ABQ', 'America/Denver'),
  ('Austin',         'AUS', 'America/Chicago'),
  ('Dallas',         'DFW', 'America/Chicago'),
  ('Houston',        'IAH', 'America/Chicago'),
  ('Chicago',        'ORD', 'America/Chicago'),
  ('Minneapolis',    'MSP', 'America/Chicago'),
  ('New Orleans',    'MSY', 'America/Chicago'),
  ('Springfield',    'SPI', 'America/Chicago'),
  ('Bloomington',    'IND', 'America/Indiana/Indianapolis'),
  ('Atlanta',        'ATL', 'America/New_York'),
  ('Miami',          'MIA', 'America/New_York'),
  ('Boston',         'BOS', 'America/New_York'),
  ('New York',       'JFK', 'America/New_York'),
  ('Toronto',        'YYZ', 'America/Toronto'),
  ('Mexico City',    'MEX', 'America/Mexico_City'),
  -- Europe
  ('London',         'LHR', 'Europe/London'),
  ('Manchester',     'MAN', 'Europe/London'),
  ('Edinburgh',      'EDI', 'Europe/London'),
  ('Birmingham',     'BHX', 'Europe/London'),
  ('Cardiff',        'CWL', 'Europe/London'),
  ('Bristol',        'BRS', 'Europe/London'),
  ('Cambridge',      'STN', 'Europe/London'),
  ('Devon',          'EXT', 'Europe/London'),
  ('Forest of Dean', 'BRS', 'Europe/London'),
  ('Mould-on-the-Wold', 'BHX', 'Europe/London'),
  ('Godric''s Hollow',  'BHX', 'Europe/London'),
  ('Ottery St Catchpole','EXT', 'Europe/London'),
  ('Paris',          'CDG', 'Europe/Paris'),
  ('Berlin',         'BER', 'Europe/Berlin'),
  ('Naboo',          'FCO', 'Europe/Rome'),
  ('Lisbon',         'LIS', 'Europe/Lisbon'),
  -- Asia / Oceania
  ('Bengaluru',      'BLR', 'Asia/Kolkata'),
  ('Hong Kong',      'HKG', 'Asia/Hong_Kong'),
  ('Sydney',         'SYD', 'Australia/Sydney');


-- =====================================================================
-- Flight times — anchor everything to UTC literals.
--
-- Inbound: 2027-01-11 13:00 UTC departs (close to 06:00 PT/MT, 14:00
-- in London/CET, 18:30 IST), arrives YYC 21:00 UTC = 14:00 MT.
-- Outbound: 2027-01-15 18:00 UTC departs YYC = 11:00 MT, arrives
-- 06:00 UTC the next day = 12 hours later. Arrival > departure under
-- every timezone permutation.
-- =====================================================================

-- Inbound (home → YYC) for everyone except Picard.
insert into public.flights (
  user_id, direction, origin, destination,
  departure_at, departure_tz, arrival_at, arrival_tz,
  airline, flight_number, source, is_confirmed
)
select
  u.id,
  'inbound',
  a.iata,
  'YYC',
  '2027-01-11 13:00:00+00'::timestamptz,
  a.tz,
  '2027-01-11 21:00:00+00'::timestamptz,
  'America/Edmonton',
  case when a.tz like 'America/%' then 'Air Canada' else 'WestJet' end,
  to_char((abs(hashtext(u.id::text)) % 1500) + 100, 'FM999'),
  'manual_obs',
  true
from public.users u
join public.employee_profiles ep on ep.user_id = u.id
join _airport_for_city a on a.city = ep.base_city
where u.id <> 'a0000000-0000-0000-0000-000000000001'
  and u.role <> 'guest';


-- Outbound (YYC → home) for everyone except Picard.
insert into public.flights (
  user_id, direction, origin, destination,
  departure_at, departure_tz, arrival_at, arrival_tz,
  airline, flight_number, source, is_confirmed
)
select
  u.id,
  'outbound',
  'YYC',
  a.iata,
  '2027-01-15 18:00:00+00'::timestamptz,
  'America/Edmonton',
  '2027-01-16 06:00:00+00'::timestamptz,
  a.tz,
  case when a.tz like 'America/%' then 'Air Canada' else 'WestJet' end,
  to_char((abs(hashtext(u.id::text || 'out')) % 1500) + 100, 'FM999'),
  'manual_obs',
  true
from public.users u
join public.employee_profiles ep on ep.user_id = u.id
join _airport_for_city a on a.city = ep.base_city
where u.id <> 'a0000000-0000-0000-0000-000000000001'
  and u.role <> 'guest';


commit;
