-- Functions and triggers
--
-- These maintain invariants that must never be bypassed by application code:
--   - registrations.completion_pct stays in sync with registration_tasks
--   - flights.arrival_at changes cascade to transport_requests.needs_review
--   - itinerary_items is materialised from sessions/flights/transport/accommodations
--   - updated_at columns auto-bump on modification
--   - passport_number is encrypted/decrypted via wrapper functions

-- Generic updated_at touch
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Wire touch_updated_at onto every table that owns an updated_at column. The
-- list lives here (rather than scanning information_schema) so the surface
-- area is explicit and reviewable in one place.
do $$
declare
  t text;
  touch_tables text[] := array[
    'employee_profiles',
    'sessions',
    'dinner_seating',
    'itinerary_items',
    'registrations',
    'profile_field_responses',
    'passport_details',
    'dietary_preferences',
    'accessibility_preferences',
    'flights',
    'accommodations',
    'transport_requests',
    'swag_selections'
  ];
begin
  foreach t in array touch_tables loop
    execute format(
      'create trigger touch_%1$s_updated_at before update on public.%1$I '
      'for each row execute function public.touch_updated_at()',
      t
    );
  end loop;
end $$;


-- registrations.completion_pct trigger
--
-- Walks the task list for the registration and recomputes completion. Status
-- of 'complete' or 'waived' counts toward done; 'skipped' is excluded from
-- the denominator (it's a no-op task for that user).
create or replace function public.update_registration_completion()
returns trigger
language plpgsql
as $$
declare
  v_registration_id uuid;
  v_total int;
  v_done int;
  v_pct int;
begin
  v_registration_id := coalesce(new.registration_id, old.registration_id);

  select
    count(*) filter (where status <> 'skipped'),
    count(*) filter (where status in ('complete', 'waived'))
  into v_total, v_done
  from public.registration_tasks
  where registration_id = v_registration_id;

  v_pct := case when v_total = 0 then 0 else round(v_done::numeric * 100 / v_total) end;

  update public.registrations
  set completion_pct = v_pct,
      status = case
        when v_pct = 100 then 'complete'::registration_status
        when v_pct > 0 then 'started'::registration_status
        else status
      end
  where id = v_registration_id;

  return coalesce(new, old);
end
$$;

create trigger update_registration_completion_aiud
  after insert or update or delete on public.registration_tasks
  for each row execute function public.update_registration_completion();


-- flights -> transport_requests cascade
--
-- When a flight's arrival_at changes, every linked transport_request needs
-- admin review before the next manifest export.
create or replace function public.flag_transport_for_review_on_flight_change()
returns trigger
language plpgsql
as $$
begin
  if new.arrival_at is distinct from old.arrival_at
     or new.departure_at is distinct from old.departure_at then
    update public.transport_requests
    set needs_review = true
    where flight_id = new.id;
  end if;
  return new;
end
$$;

create trigger flag_transport_for_review_on_flight_change_au
  after update on public.flights
  for each row execute function public.flag_transport_for_review_on_flight_change();


-- itinerary_items materialisation
--
-- Sessions, flights, transport_requests, and accommodations all contribute
-- rows. We sync via per-table triggers that upsert into itinerary_items.
-- Mandatory sessions auto-add for every registered user; opt-in sessions
-- only land for users with a session_registration row.

-- Picks the active event used to attribute flight and transport itinerary rows.
-- Returns null if no event is active; callers short-circuit in that case.
create or replace function public.current_active_event_id()
returns uuid
language sql
stable
as $$
  select id from public.events
  where is_active
  order by start_date desc
  limit 1
$$;


create or replace function public.sync_itinerary_for_session_registration()
returns trigger
language plpgsql
as $$
declare
  v_session public.sessions%rowtype;
begin
  if tg_op = 'DELETE' then
    delete from public.itinerary_items
    where source_id = old.session_id and user_id = old.user_id and item_type = 'session';
    return old;
  end if;

  select * into v_session from public.sessions where id = new.session_id;

  insert into public.itinerary_items (
    user_id, event_id, item_type, source, source_id,
    title, subtitle, starts_at, starts_tz, ends_at, ends_tz, includes_guest
  )
  select
    new.user_id, v_session.event_id, 'session', 'self_registered', v_session.id,
    v_session.title, v_session.location,
    v_session.starts_at, e.time_zone, v_session.ends_at, e.time_zone,
    new.includes_guest
  from public.events e where e.id = v_session.event_id
  on conflict (user_id, item_type, source_id) where source_id is not null do nothing;

  return new;
end
$$;

create trigger sync_itinerary_for_session_registration_aiud
  after insert or update or delete on public.session_registrations
  for each row execute function public.sync_itinerary_for_session_registration();


create or replace function public.sync_itinerary_for_flight()
returns trigger
language plpgsql
as $$
declare
  v_event_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.itinerary_items where source_id = old.id and item_type = 'flight';
    return old;
  end if;

  v_event_id := public.current_active_event_id();
  if v_event_id is null then
    return new;
  end if;

  insert into public.itinerary_items (
    user_id, event_id, item_type, source, source_id,
    title, subtitle, starts_at, starts_tz, ends_at, ends_tz
  ) values (
    new.user_id, v_event_id, 'flight', 'assigned', new.id,
    coalesce(new.airline || ' ' || new.flight_number, 'Flight'),
    new.origin || ' → ' || new.destination,
    new.departure_at, new.departure_tz, new.arrival_at, new.arrival_tz
  )
  on conflict (user_id, item_type, source_id) where source_id is not null do nothing;

  -- For UPDATE, also refresh the existing row so itinerary stays current.
  update public.itinerary_items
  set title = coalesce(new.airline || ' ' || new.flight_number, 'Flight'),
      subtitle = new.origin || ' → ' || new.destination,
      starts_at = new.departure_at,
      starts_tz = new.departure_tz,
      ends_at = new.arrival_at,
      ends_tz = new.arrival_tz
  where source_id = new.id and item_type = 'flight';

  return new;
end
$$;

create trigger sync_itinerary_for_flight_aiud
  after insert or update or delete on public.flights
  for each row execute function public.sync_itinerary_for_flight();


create or replace function public.sync_itinerary_for_transport_request()
returns trigger
language plpgsql
as $$
declare
  v_event_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.itinerary_items where source_id = old.id and item_type = 'transport';
    return old;
  end if;

  v_event_id := public.current_active_event_id();
  if v_event_id is null then
    return new;
  end if;

  insert into public.itinerary_items (
    user_id, event_id, item_type, source, source_id,
    title, subtitle, starts_at, starts_tz
  ) values (
    new.user_id, v_event_id, 'transport', 'assigned', new.id,
    case new.direction when 'arrival' then 'Airport pickup' else 'Airport drop-off' end,
    'Pickup at ' || to_char(new.pickup_datetime at time zone new.pickup_tz, 'HH24:MI'),
    new.pickup_datetime, new.pickup_tz
  )
  on conflict (user_id, item_type, source_id) where source_id is not null do nothing;

  update public.itinerary_items
  set title = case new.direction when 'arrival' then 'Airport pickup' else 'Airport drop-off' end,
      subtitle = 'Pickup at ' || to_char(new.pickup_datetime at time zone new.pickup_tz, 'HH24:MI'),
      starts_at = new.pickup_datetime,
      starts_tz = new.pickup_tz
  where source_id = new.id and item_type = 'transport';

  return new;
end
$$;

create trigger sync_itinerary_for_transport_request_aiud
  after insert or update or delete on public.transport_requests
  for each row execute function public.sync_itinerary_for_transport_request();


create or replace function public.sync_itinerary_for_accommodation_occupant()
returns trigger
language plpgsql
as $$
declare
  v_acc public.accommodations%rowtype;
begin
  if tg_op = 'DELETE' then
    delete from public.itinerary_items
    where source_id = old.accommodation_id and item_type = 'accommodation' and user_id = old.user_id;
    return old;
  end if;

  select * into v_acc from public.accommodations where id = new.accommodation_id;

  insert into public.itinerary_items (
    user_id, event_id, item_type, source, source_id,
    title, subtitle, starts_at, starts_tz, ends_at, ends_tz
  )
  select
    new.user_id, v_acc.event_id, 'accommodation', 'assigned', v_acc.id,
    v_acc.hotel_name,
    coalesce('Room ' || v_acc.room_number, v_acc.room_type),
    v_acc.check_in::timestamptz, e.time_zone,
    v_acc.check_out::timestamptz, e.time_zone
  from public.events e where e.id = v_acc.event_id
  on conflict (user_id, item_type, source_id) where source_id is not null do nothing;

  return new;
end
$$;

create trigger sync_itinerary_for_accommodation_occupant_aiud
  after insert or update or delete on public.accommodation_occupants
  for each row execute function public.sync_itinerary_for_accommodation_occupant();


-- Passport encryption helpers
--
-- The passport_number_encrypted column holds pgp_sym_encrypt output. The key
-- is read from the kizuna.passport_key custom GUC so it is never present in
-- application code or logs. Set in supabase config or via vault.

create or replace function public.set_passport(
  p_user_id uuid,
  p_passport_name text,
  p_passport_number text,
  p_issuing_country text,
  p_expiry_date date
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  v_key := current_setting('kizuna.passport_key', true);
  if v_key is null or length(v_key) = 0 then
    raise exception 'kizuna.passport_key not configured';
  end if;

  insert into public.passport_details (
    user_id, passport_name, passport_number_encrypted, issuing_country, expiry_date
  )
  values (
    p_user_id, p_passport_name,
    pgp_sym_encrypt(p_passport_number, v_key),
    p_issuing_country, p_expiry_date
  )
  on conflict (user_id) do update
    set passport_name = excluded.passport_name,
        passport_number_encrypted = excluded.passport_number_encrypted,
        issuing_country = excluded.issuing_country,
        expiry_date = excluded.expiry_date;
end
$$;

revoke all on function public.set_passport(uuid, text, text, text, date) from public;
grant execute on function public.set_passport(uuid, text, text, text, date) to authenticated;


create or replace function public.get_passport_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
  v_cipher bytea;
begin
  -- Only the owning user may decrypt. RLS on passport_details enforces this
  -- but we double-check here because security definer bypasses RLS.
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  v_key := current_setting('kizuna.passport_key', true);
  if v_key is null or length(v_key) = 0 then
    raise exception 'kizuna.passport_key not configured';
  end if;

  select passport_number_encrypted into v_cipher
  from public.passport_details where user_id = p_user_id;

  if v_cipher is null then
    return null;
  end if;

  return pgp_sym_decrypt(v_cipher, v_key);
end
$$;

revoke all on function public.get_passport_number(uuid) from public;
grant execute on function public.get_passport_number(uuid) to authenticated;
