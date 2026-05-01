-- Logistics tables
--
-- Flights are sourced from Perk (CSV in Phase 1, API later) plus manual
-- bookings for off-broadcast travel. Accommodations are admin-managed.
-- transport_requests link flights to vehicle assignments. swag_sizes
-- captures the per-attendee t-shirt and shoe sizes the events team
-- orders against.

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  perk_booking_ref text,
  direction flight_direction not null,
  origin text not null check (length(origin) = 3),
  destination text not null check (length(destination) = 3),
  departure_at timestamptz not null,
  departure_tz text not null,
  arrival_at timestamptz not null check (arrival_at > departure_at),
  arrival_tz text not null,
  airline text,
  flight_number text,
  source flight_source_type not null,
  cost numeric(10, 2),
  is_confirmed boolean not null default false,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on column public.flights.origin is
  'IATA airport code (3 letters).';
comment on column public.flights.destination is
  'IATA airport code. Typically YYC for arrivals.';
comment on column public.flights.departure_tz is
  'IANA timezone name for the origin airport (e.g. America/Los_Angeles). Drives local-time rendering.';
comment on column public.flights.arrival_tz is
  'IANA timezone name for the destination airport (e.g. America/Edmonton).';
comment on column public.flights.is_confirmed is
  'False = tentative. Excluded from transport manifests until confirmed.';

create index flights_user_id_direction_idx on public.flights(user_id, direction);
create index flights_arrival_at_idx on public.flights(arrival_at);


create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  hotel_name text not null,
  room_number text,
  room_type text not null check (room_type in ('standard', 'suite', 'accessible', 'family')),
  -- Hotel-supplied marketing description ("Mountain-view king", "Two-
  -- bedroom executive suite"). Free-form text; the Room Assignment
  -- Tool surfaces it on each row so admins can match guests to the
  -- right space.
  description text,
  -- Floor area in square metres. Rules engine prefers larger rooms for
  -- earliest-registered guests; we store the metric value so the same
  -- column works whether the hotel sheet uses sqm or sqft (the import
  -- step converts).
  size_sqm numeric(6, 1) check (size_sqm is null or size_sqm > 0),
  is_suite boolean not null default false,
  -- How many people the room comfortably sleeps. Drives the auto-
  -- assign rules engine. CSV import infers this from is_suite when not
  -- provided (suite -> 2, otherwise 1).
  capacity int not null default 1 check (capacity > 0),
  check_in date not null,
  check_out date not null check (check_out > check_in),
  special_requests text,
  confirmed_by_hotel boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.accommodations is
  'Hotel room assignments. Multiple properties per event supported (Supafest uses two). description / size_sqm / is_suite drive the Room Assignment Tool import + auto-rules engine.';

create index accommodations_event_id_idx on public.accommodations(event_id);
create index accommodations_event_suite_idx on public.accommodations(event_id, is_suite);


create table public.accommodation_occupants (
  id uuid primary key default gen_random_uuid(),
  accommodation_id uuid not null references public.accommodations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  is_primary boolean not null default false,
  unique (accommodation_id, user_id)
);

comment on table public.accommodation_occupants is
  'Junction table for room ↔ occupants. Enables clean RLS and bidirectional queries.';

create index accommodation_occupants_user_id_idx on public.accommodation_occupants(user_id);
create unique index accommodation_occupants_one_primary_idx
  on public.accommodation_occupants(accommodation_id) where is_primary;


create table public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vehicle_name text not null,
  direction transport_direction not null,
  pickup_at timestamptz not null,
  pickup_tz text not null default 'America/Edmonton',
  capacity_passengers int not null check (capacity_passengers > 0),
  capacity_bags int not null check (capacity_bags >= 0),
  handles_special_equipment text[] not null default '{}',
  provider text,
  notes text
);

comment on table public.transport_vehicles is
  'Vehicle fleet for airport transfers. direction + pickup_at scope each vehicle to one trip; the Ground Transport Tool only suggests vehicles that match the passenger leg and time window.';
comment on column public.transport_vehicles.pickup_at is
  'Scheduled pickup moment (UTC). Used by the auto-suggest scorer in Ground Transport Tool — closer matches rank higher.';

create index transport_vehicles_event_direction_pickup_idx
  on public.transport_vehicles(event_id, direction, pickup_at);


create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  flight_id uuid references public.flights(id) on delete set null,
  direction transport_direction not null,
  pickup_at timestamptz not null,
  pickup_tz text not null default 'America/Edmonton',
  passenger_count int not null check (passenger_count > 0),
  bag_count int not null default 0 check (bag_count >= 0),
  special_equipment text[] not null default '{}',
  -- Free-form note from the attendee surfaced to ground-transport
  -- ops ("car seat needed", "departing 30 min earlier than the
  -- group", etc.). Editable from the itinerary edit dialog.
  special_requests text,
  assigned_vehicle_id uuid references public.transport_vehicles(id) on delete set null,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on column public.transport_requests.pickup_at is
  'Calculated from linked flight arrival + buffer. Updated by trigger when flight changes.';
comment on column public.transport_requests.needs_review is
  'Set true when linked flight is updated. Must be cleared by admin before manifest export.';

create index transport_requests_flight_id_idx on public.transport_requests(flight_id) where flight_id is not null;
create index transport_requests_assigned_vehicle_id_idx
  on public.transport_requests(assigned_vehicle_id) where assigned_vehicle_id is not null;
create index transport_requests_needs_review_idx
  on public.transport_requests(needs_review) where needs_review;


-- Swag sizes
--
-- Single, simple table. We don't run a swag catalogue — for Phase 1 every
-- attendee just tells us their t-shirt size and shoe size and the events
-- team orders centrally. The row is polymorphic on (user_id,
-- additional_guest_id) so the same shape covers employees, guests, and
-- additional_guests (children, partners) on a sponsor's registration.
--
-- Shoe size is stored in canonical EU units (numeric so 38.5, 39, 39.5
-- all fit). The UI offers US/EU input and converts on save so the kitchen
-- spreadsheet always reads one unit.
create table public.swag_sizes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  additional_guest_id uuid references public.additional_guests(id) on delete cascade,
  tshirt_size text,
  shoe_size_eu numeric(4,1) check (shoe_size_eu is null or shoe_size_eu > 0),
  updated_at timestamptz not null default now(),
  constraint swag_sizes_owner check (
    (user_id is not null and additional_guest_id is null)
    or (user_id is null and additional_guest_id is not null)
  ),
  unique (user_id),
  unique (additional_guest_id)
);

comment on table public.swag_sizes is
  'One row per attendee with their t-shirt and shoe sizes. Polymorphic on (user_id, additional_guest_id) so employees, guests, and accompanying additional_guests share the same table.';
comment on column public.swag_sizes.shoe_size_eu is
  'Canonical EU shoe size. UI accepts US or EU and converts on save.';
