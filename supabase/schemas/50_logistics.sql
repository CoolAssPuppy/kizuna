-- Logistics tables
--
-- Flights are sourced from Perk (CSV in Phase 1, API later) plus manual
-- bookings for off-broadcast travel. Accommodations are admin-managed.
-- transport_requests link flights to vehicle assignments. The swag
-- catalogue (swag_items + swag_selections) drives the ops team's
-- ordering spreadsheet.

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
  'IATA airport code (3 letters). Per-event the active hub is events.airport_iata; arrivals match that, departures originate from it.';
comment on column public.flights.departure_tz is
  'IANA timezone name for the origin airport (e.g. America/Los_Angeles). Drives local-time rendering.';
comment on column public.flights.arrival_tz is
  'IANA timezone name for the destination airport. Sourced from the active event row when staging Perk imports.';
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
  -- IANA tz of the pickup wall-clock. Callers pass the active event's
  -- time_zone so a Banff event uses America/Edmonton and (e.g.) a
  -- Lisbon event uses Europe/Lisbon. No default — wrong default is
  -- worse than a NOT NULL violation surfacing the bug at insert time.
  pickup_tz text not null,
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
  -- IANA tz, mirrors transport_vehicles.pickup_tz: every caller (Perk
  -- import, attendee profile screen, admin tool) supplies the active
  -- event's time_zone explicitly.
  pickup_tz text not null,
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


-- Swag catalogue
--
-- Per-event admin-curated catalogue. Each row is one piece of swag the
-- ops team plans to order: a t-shirt, a hoodie, a pair of slippers. Each
-- item carries its own size list so a t-shirt and a sneaker can coexist
-- with very different size scales. Hidden items are admin previews and
-- never reach the attendee picker. allows_opt_out controls whether the
-- attendee form lets people decline a specific item.
create table public.swag_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  -- Storage paths in the event-content bucket. Convention is
  -- '<event_id>/swag/<item_id>/cover.<ext>' and '.../sizing.<ext>',
  -- enforced by the admin uploader and the storage RLS policy below.
  image_path text,
  size_image_path text,
  is_hidden boolean not null default false,
  allows_opt_out boolean not null default true,
  -- Free-form size labels. Admin UI offers templates (XS..5XL, US shoe,
  -- EU shoe) but ultimately stores whatever the admin curates.
  sizes text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.swag_items is
  'Per-event swag catalogue. One row per orderable item; sizes is a free-form list so t-shirts and shoes can share the same table.';

create index swag_items_event_id_idx on public.swag_items(event_id);


-- Per-attendee selection per item.
-- Polymorphic owner mirrors the old swag_sizes shape so a sponsor can
-- save sizes on behalf of their additional_guests (children, partners).
-- size is null when opted_out is true; the check below enforces the pair.
create table public.swag_selections (
  id uuid primary key default gen_random_uuid(),
  swag_item_id uuid not null references public.swag_items(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  additional_guest_id uuid references public.additional_guests(id) on delete cascade,
  size text,
  opted_out boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint swag_selections_owner check (
    (user_id is not null and additional_guest_id is null)
    or (user_id is null and additional_guest_id is not null)
  ),
  constraint swag_selections_size_or_optout check (
    (opted_out and size is null) or (not opted_out and size is not null)
  ),
  unique (swag_item_id, user_id),
  unique (swag_item_id, additional_guest_id)
);

comment on table public.swag_selections is
  'One row per attendee per swag item. opted_out + null size means the attendee chose not to receive this item. Locking is enforced at the RPC level (set_swag_selections checks events.swag_locked_at).';

create index swag_selections_owner_idx on public.swag_selections(user_id, additional_guest_id);
create index swag_selections_swag_item_idx on public.swag_selections(swag_item_id);
