-- Events, sessions, and personal itinerary tables
--
-- events is the top-level container. Sessions belong to one event. Each user
-- has zero-or-one registration per event, and zero-or-many session_registrations.
-- itinerary_items is a denormalised materialised table populated by triggers
-- so the offline cache reads from a single fast source.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  type event_type not null,
  location text,
  -- IATA code for the event's gateway airport. Drives the Ground
  -- Transport Tool: arrival tab is scoped to flights.destination =
  -- airport_iata, departure tab to flights.origin = airport_iata.
  -- Three letters per IATA spec. Null pre-launch; set when an event is
  -- finalised.
  airport_iata text check (airport_iata is null or length(airport_iata) = 3),
  time_zone text not null default 'UTC',
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reg_opens_at timestamptz,
  reg_closes_at timestamptz check (reg_closes_at is null or reg_opens_at is null or reg_closes_at > reg_opens_at),
  is_active boolean not null default false,
  hero_image_url text check (hero_image_url is null or hero_image_url ~ '^https?://'),
  logo_url text check (logo_url is null or logo_url ~ '^https?://'),
  invite_all_employees boolean not null default false
);

comment on column public.events.hero_image_url is
  'Background image used on the welcome screen and admin event header.';
comment on column public.events.logo_url is
  'Event logo (small square or wordmark). Renders next to the event name in admin and home.';
comment on column public.events.invite_all_employees is
  'When true, every active employee is implicitly invited (RLS extends visibility to role=employee). When false, only users with a registrations row see the event.';

comment on column public.events.time_zone is
  'IANA timezone for the event venue (e.g. America/Edmonton for Banff). Used as the default render timezone for sessions and accommodations.';

comment on table public.events is
  'Top-level event container. Multiple events can coexist (Supafest 2027, Select SF, ...).';
comment on column public.events.is_active is
  'Controls app welcome screen routing. Only one supafest event should be active at a time.';

create unique index events_one_active_supafest_idx
  on public.events ((1)) where is_active and type = 'supafest';
create index events_type_active_idx on public.events(type) where is_active;


create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  subtitle text,
  type session_type not null,
  audience session_audience not null default 'all',
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location text,
  capacity int check (capacity is null or capacity > 0),
  is_mandatory boolean not null default false,
  abstract text,
  speaker_email text,
  updated_at timestamptz not null default now()
);

comment on column public.sessions.audience is
  'Determines who sees the session: everyone, employees only, guests only, or opt-in only.';
comment on column public.sessions.is_mandatory is
  'When true, the session is auto-added to every relevant attendee itinerary.';
comment on column public.sessions.subtitle is
  'Single-line subtitle shown under the title in agenda cards.';
comment on column public.sessions.abstract is
  'Long-form description of the session (markdown supported). Replaces the older `description` column.';
comment on column public.sessions.speaker_email is
  'Email of the speaker. The agenda viewer joins this back to public.users to show photos and links.';

create index sessions_event_id_starts_at_idx on public.sessions(event_id, starts_at);
create index sessions_type_idx on public.sessions(event_id, type);
create index sessions_speaker_email_idx on public.sessions(speaker_email) where speaker_email is not null;


-- Per-user favorites for sessions. Drives the "starred" filter on the
-- agenda viewer and the user's "my agenda" subset.
create table public.session_favorites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  favorited_at timestamptz not null default now(),
  unique (session_id, user_id)
);

comment on table public.session_favorites is
  'Per-user starred sessions. Used by the agenda viewer to filter "my picks".';

create index session_favorites_user_id_idx on public.session_favorites(user_id);


create table public.session_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status session_registration_status not null default 'registered',
  registered_at timestamptz not null default now(),
  includes_guest boolean not null default false,
  unique (session_id, user_id)
);

create index session_registrations_user_id_idx on public.session_registrations(user_id);


create table public.dinner_seating (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  table_number int not null,
  seat_number int,
  seating_group text,
  notes text,
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

comment on table public.dinner_seating is
  'Admin-assigned table layouts for dinner sessions. Included in seating export.';

create index dinner_seating_session_id_idx on public.dinner_seating(session_id);
create index dinner_seating_user_id_idx on public.dinner_seating(user_id);


-- itinerary_items: denormalised, materialised, single-table read for offline.
-- Kept in sync by triggers on sessions, flights, transport_requests, accommodations.
--
-- Timezone handling: starts_at and ends_at are timestamptz (UTC). The
-- starts_tz / ends_tz columns are IANA names (e.g. 'America/Edmonton',
-- 'Asia/Tokyo') that the renderer uses to display each row in its local
-- time. A SFO→YYC flight stores departure in America/Los_Angeles and
-- arrival in America/Edmonton even though both timestamps live as UTC.
create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  item_type itinerary_item_type not null,
  source itinerary_source not null,
  source_id uuid,
  title text not null,
  subtitle text,
  starts_at timestamptz not null,
  starts_tz text not null default 'UTC',
  ends_at timestamptz,
  ends_tz text,
  includes_guest boolean not null default false,
  is_conflict boolean not null default false,
  is_offline_cached boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on column public.itinerary_items.starts_tz is
  'IANA timezone name (e.g. America/Edmonton) used to render starts_at locally. UTC is a sentinel meaning "no preference; render in viewer''s tz".';
comment on column public.itinerary_items.ends_tz is
  'IANA timezone for ends_at. May differ from starts_tz on flights (departure tz vs arrival tz).';

comment on table public.itinerary_items is
  'Materialised personal schedule. One row per visible item. No joins on read. Maintained by triggers.';

create index itinerary_items_user_event_starts_idx
  on public.itinerary_items(user_id, event_id, starts_at);

-- Each contributor (session, flight, transport, accommodation) writes at most
-- one itinerary row per (user, item_type, source). Required to make
-- `on conflict do nothing` in the materialisation triggers behave correctly.
create unique index itinerary_items_dedup_uidx
  on public.itinerary_items(user_id, item_type, source_id)
  where source_id is not null;


-- Editorial home-screen feed. Admins curate items here; users render them
-- on the home screen alongside the dynamic feed (documents to sign, open
-- registration tasks, recent notifications). Drag-to-reorder is backed by
-- the `position` column.
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  location feed_location not null default 'main',
  position int not null default 0,
  title text not null,
  subtitle text,
  body text,
  occurs_at timestamptz,
  image_path text,
  link_url text,
  starts_displaying_at timestamptz,
  ends_displaying_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feed_items is
  'Editorial home-screen content curated by admins. Display window optional; null bounds = always show.';
comment on column public.feed_items.position is
  'Sort order within (event_id, location). Drag-to-reorder rewrites this for the affected rows.';
comment on column public.feed_items.occurs_at is
  'Optional date+time the item references (e.g. SupaCup 2025 final). Distinct from starts_displaying_at, which controls visibility window.';

create index feed_items_event_location_position_idx
  on public.feed_items(event_id, location, position);
