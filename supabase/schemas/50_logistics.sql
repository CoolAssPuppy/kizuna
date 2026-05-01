-- Logistics tables
--
-- Flights are sourced from Perk (CSV in Phase 1, API later) plus manual
-- bookings for off-broadcast travel. Accommodations are admin-managed.
-- transport_requests link flights to vehicle assignments. Swag selections
-- close the loop on per-attendee inventory.

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
  check_in date not null,
  check_out date not null check (check_out > check_in),
  special_requests text,
  confirmed_by_hotel boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.accommodations is
  'Hotel room assignments. Multiple properties per event supported (Supafest uses two).';

create index accommodations_event_id_idx on public.accommodations(event_id);


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
  capacity_passengers int not null check (capacity_passengers > 0),
  capacity_bags int not null check (capacity_bags >= 0),
  handles_special_equipment text[] not null default '{}',
  provider text,
  notes text
);

comment on table public.transport_vehicles is
  'Vehicle fleet for airport transfers. handles_special_equipment limits which transport_requests can be assigned.';


create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  flight_id uuid references public.flights(id) on delete set null,
  direction transport_direction not null,
  pickup_datetime timestamptz not null,
  pickup_tz text not null default 'America/Edmonton',
  passenger_count int not null check (passenger_count > 0),
  bag_count int not null default 0 check (bag_count >= 0),
  special_equipment text[] not null default '{}',
  assigned_vehicle_id uuid references public.transport_vehicles(id) on delete set null,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on column public.transport_requests.pickup_datetime is
  'Calculated from linked flight arrival + buffer. Updated by trigger when flight changes.';
comment on column public.transport_requests.needs_review is
  'Set true when linked flight is updated. Must be cleared by admin before manifest export.';

create index transport_requests_flight_id_idx on public.transport_requests(flight_id) where flight_id is not null;
create index transport_requests_assigned_vehicle_id_idx
  on public.transport_requests(assigned_vehicle_id) where assigned_vehicle_id is not null;
create index transport_requests_needs_review_idx
  on public.transport_requests(needs_review) where needs_review;


create table public.swag_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  audience swag_audience not null default 'all',
  requires_sizing boolean not null default false,
  has_fit_options boolean not null default false,
  sizing_guide_url text,
  available_sizes text[] not null default '{}',
  description text,
  display_order int not null default 0
);

comment on column public.swag_items.has_fit_options is
  'True for gender-cut items where fit_preference (fitted | relaxed) is collected.';
comment on column public.swag_items.audience is
  'Who can select this item. Children swag is offered separately so it does not clutter the adult menu.';

create index swag_items_event_id_idx on public.swag_items(event_id);


create table public.swag_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  swag_item_id uuid not null references public.swag_items(id) on delete cascade,
  opted_in boolean not null default true,
  size text,
  fit_preference text check (fit_preference is null or fit_preference in ('fitted', 'relaxed')),
  fulfilled boolean not null default false,
  exchange_notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, swag_item_id)
);

-- Swag for additional_guests (children, dependents). They aren't full
-- Kizuna users so selections live in their own table keyed off the
-- additional_guests row instead of users.
create table public.additional_guest_swag_selections (
  id uuid primary key default gen_random_uuid(),
  additional_guest_id uuid not null references public.additional_guests(id) on delete cascade,
  swag_item_id uuid not null references public.swag_items(id) on delete cascade,
  opted_in boolean not null default true,
  size text,
  fit_preference text check (fit_preference is null or fit_preference in ('fitted', 'relaxed')),
  fulfilled boolean not null default false,
  exchange_notes text,
  updated_at timestamptz not null default now(),
  unique (additional_guest_id, swag_item_id)
);

create index additional_guest_swag_selections_guest_idx
  on public.additional_guest_swag_selections(additional_guest_id);

comment on column public.swag_selections.fulfilled is
  'Set true when the swag bag is QR-scanned and packed at check-in.';
