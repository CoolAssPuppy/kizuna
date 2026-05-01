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

-- Cascade delete from auth.users to public.users.
--
-- Replaces the old FK cascade (public.users.id REFERENCES
-- auth.users(id) ON DELETE CASCADE). The FK was dropped because
-- dependents have no auth.users entry, so the FK would block their
-- shadow rows. We still need the cascade for real attendees: when an
-- auth account is deleted, its public.users row should follow,
-- and every per-section table that FKs to public.users(id) cascades
-- from there.
create or replace function public.cascade_auth_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end
$$;

create trigger cascade_auth_user_delete_ad
  after delete on auth.users
  for each row execute function public.cascade_auth_user_delete();

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
    'additional_guests',
    'flights',
    'accommodations',
    'transport_requests',
    'swag_sizes'
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
-- When a flight's arrival/departure time, airline, or flight_number changes
-- AND the linked transport_request already has a vehicle assigned, the
-- assignment is revoked: the admin must re-pick a vehicle that still
-- matches the new flight time. needs_review trips on every flight edit
-- so the Ground Transport Tool surfaces the row even when no vehicle was
-- previously assigned.
create or replace function public.flag_transport_for_review_on_flight_change()
returns trigger
language plpgsql
as $$
declare
  v_material_change boolean;
begin
  v_material_change :=
       new.arrival_at      is distinct from old.arrival_at
    or new.departure_at    is distinct from old.departure_at
    or new.airline         is distinct from old.airline
    or new.flight_number   is distinct from old.flight_number
    or new.origin          is distinct from old.origin
    or new.destination     is distinct from old.destination;

  if v_material_change then
    update public.transport_requests
    set needs_review = true,
        assigned_vehicle_id = null
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

  -- For UPDATE (e.g. user toggles includes_guest), refresh the existing
  -- row so the offline cache reflects the change.
  update public.itinerary_items
     set includes_guest = new.includes_guest
   where source_id = new.session_id and user_id = new.user_id and item_type = 'session';

  return new;
end
$$;

create trigger sync_itinerary_for_session_registration_aiud
  after insert or update or delete on public.session_registrations
  for each row execute function public.sync_itinerary_for_session_registration();


-- When an admin edits a session (title, location, time), every user
-- itinerary row pointing at that session needs to follow. Without this
-- trigger the cache stays stale until the user deregisters and re-registers.
create or replace function public.sync_itinerary_for_session()
returns trigger
language plpgsql
as $$
declare
  v_tz text;
begin
  if tg_op = 'DELETE' then
    delete from public.itinerary_items
     where source_id = old.id and item_type = 'session';
    return old;
  end if;

  select time_zone into v_tz from public.events where id = new.event_id;

  update public.itinerary_items
     set title = new.title,
         subtitle = new.location,
         starts_at = new.starts_at,
         ends_at = new.ends_at,
         starts_tz = v_tz,
         ends_tz = v_tz
   where source_id = new.id and item_type = 'session';

  return new;
end
$$;

create trigger sync_itinerary_for_session_aud
  after update or delete on public.sessions
  for each row execute function public.sync_itinerary_for_session();


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
    'Pickup at ' || to_char(new.pickup_at at time zone new.pickup_tz, 'HH24:MI'),
    new.pickup_at, new.pickup_tz
  )
  on conflict (user_id, item_type, source_id) where source_id is not null do nothing;

  update public.itinerary_items
  set title = case new.direction when 'arrival' then 'Airport pickup' else 'Airport drop-off' end,
      subtitle = 'Pickup at ' || to_char(new.pickup_at at time zone new.pickup_tz, 'HH24:MI'),
      starts_at = new.pickup_at,
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


-- =====================================================================
-- Leadership flag: only admins/super_admins can change it
-- =====================================================================
--
-- Approach: a BEFORE UPDATE trigger on public.users that raises if
-- is_leadership is being changed by a caller who isn't an admin. RLS
-- alone can't gate per-column writes, so the trigger keeps the rule
-- enforceable regardless of which policy actually allowed the row
-- update (users_self_update, users_admin_all, etc.).
--
-- A SECURITY DEFINER RPC `set_user_leadership` is the SPA's blessed
-- write path: it does the admin check up front, returns a typed error,
-- and updates through RLS so audit triggers fire normally.
create or replace function public.guard_leadership_change()
returns trigger
language plpgsql
as $$
begin
  if new.is_leadership is distinct from old.is_leadership
     and not public.is_admin() then
    raise exception 'only admins can change is_leadership'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger users_leadership_change_guard
  before update of is_leadership on public.users
  for each row execute function public.guard_leadership_change();


create or replace function public.set_user_leadership(
  p_user_id uuid,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can change is_leadership'
      using errcode = '42501';
  end if;

  update public.users
     set is_leadership = p_value
   where id = p_user_id;
end
$$;

revoke all on function public.set_user_leadership(uuid, boolean) from public;
grant execute on function public.set_user_leadership(uuid, boolean) to authenticated;


-- =====================================================================
-- Messages: bump edited_at when the body changes after the initial send
-- =====================================================================
create or replace function public.touch_message_edited_at()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end
$$;

create trigger touch_messages_edited_at
  before update on public.messages
  for each row execute function public.touch_message_edited_at();


-- =====================================================================
-- Admin broadcast: post the same body to every active community channel
-- in one round-trip. SECURITY DEFINER so the message rows credit the
-- caller as sender_id while skipping per-channel RLS overhead.
-- =====================================================================
create or replace function public.broadcast_to_all_channels(p_body text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'only admins can broadcast'
      using errcode = '42501';
  end if;

  if coalesce(length(trim(p_body)), 0) = 0 then
    raise exception 'broadcast body cannot be empty'
      using errcode = '22023';
  end if;

  insert into public.messages (sender_id, channel, body)
  select auth.uid(), c.slug, p_body
  from public.channels c
  where c.archived_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.broadcast_to_all_channels(text) from public;
grant execute on function public.broadcast_to_all_channels(text) to authenticated;


-- =====================================================================
-- Notifications: recipient marks one (or all) as read
-- =====================================================================

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set read_at = now()
   where id = p_notification_id
     and user_id = auth.uid()
     and read_at is null;
end
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;


create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;


-- =====================================================================
-- Guest fee tiers (Phase 1 launch pricing)
-- =====================================================================
-- Single source of truth for the Invite-a-Guest pricing. Triggers on
-- guest_invitations and additional_guests stamp fee_amount from this
-- function on insert so the captured value never drifts away from the
-- real charge that runs through Stripe.
--
-- Update intent: bump prices via `alter function` in a future schema
-- change; existing rows keep their captured fee_amount unchanged so a
-- mid-cycle bill cannot suddenly increase.
create or replace function public.guest_fee_for_bracket(
  p_bracket guest_age_bracket
)
returns numeric
language sql
immutable
as $$
  select case p_bracket
    when 'under_12' then 200.00
    when 'teen'     then 500.00
    when 'adult'    then 950.00
  end
$$;

grant execute on function public.guest_fee_for_bracket(guest_age_bracket) to authenticated;


create or replace function public.set_guest_fee_amount()
returns trigger
language plpgsql
as $$
begin
  -- Always overwrite on insert so the SPA cannot under-quote. On update
  -- we refuse to silently re-price a confirmed invite — fee_amount only
  -- changes via an explicit admin action.
  if tg_op = 'INSERT' then
    new.fee_amount := public.guest_fee_for_bracket(new.age_bracket);
  elsif new.age_bracket is distinct from old.age_bracket then
    new.fee_amount := public.guest_fee_for_bracket(new.age_bracket);
  end if;
  return new;
end
$$;

create trigger set_additional_guest_fee_biu
  before insert or update on public.additional_guests
  for each row execute function public.set_guest_fee_amount();

create trigger set_guest_invitation_fee_biu
  before insert or update on public.guest_invitations
  for each row execute function public.set_guest_fee_amount();


-- =====================================================================
-- Shadow user for each dependent (additional_guest)
-- =====================================================================
-- The sponsor fills in the dependent's dietary, accessibility, swag,
-- passport, etc. via the same Section components used for the sponsor.
-- Those sections write to per-table rows keyed on user_id. So every
-- dependent needs a real public.users row to anchor those writes —
-- but no auth.users entry, since the dependent never signs in.
--
-- The trigger mints the shadow row on additional_guest insert when the
-- caller doesn't supply user_id. role='dependent', sponsor_id set,
-- email is synthetic (sponsorid+ag-id@dependent.kizuna.local) to keep
-- the NOT NULL + unique constraints on public.users honest without
-- ever letting the address receive mail.
create or replace function public.ensure_additional_guest_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_new_user_id uuid;
begin
  if new.user_id is not null then return new; end if;

  v_new_user_id := gen_random_uuid();
  -- Synthetic non-routable address. The .invalid TLD is reserved by
  -- RFC 2606 specifically so anything sent there bounces.
  v_email := format('dependent+%s@%s.invalid', v_new_user_id, new.sponsor_id);

  insert into public.users (id, email, role, sponsor_id, auth_provider)
  values (v_new_user_id, v_email, 'dependent', new.sponsor_id, 'email_password');

  new.user_id := v_new_user_id;
  return new;
end
$$;

create trigger ensure_additional_guest_user_bi
  before insert on public.additional_guests
  for each row execute function public.ensure_additional_guest_user();


-- =====================================================================
-- Sponsor-fee summary view + gate
-- =====================================================================
-- A view that rolls up the total / paid amounts across BOTH adult
-- guest_profiles and minor additional_guests for a sponsor. The
-- registration logic reads `all_paid` to decide whether a guest can
-- complete their profile or whether they must wait for the sponsor's
-- card to clear.
create or replace view public.sponsor_guest_fee_summary as
  select
    sponsor_id,
    coalesce(sum(fee_amount), 0)::numeric(10, 2) as total_fee,
    coalesce(sum(fee_amount) filter (where payment_status = 'paid'), 0)::numeric(10, 2) as paid_amount,
    coalesce(sum(fee_amount) filter (where payment_status = 'waived'), 0)::numeric(10, 2) as waived_amount,
    bool_and(payment_status in ('paid', 'waived')) as all_settled
  from (
    select sponsor_id, fee_amount, payment_status
    from public.guest_profiles
    where fee_amount is not null
    union all
    select sponsor_id, fee_amount, payment_status
    from public.additional_guests
  ) combined
  group by sponsor_id;

comment on view public.sponsor_guest_fee_summary is
  'Per-sponsor rollup of total guest fees vs paid + waived. The registration code blocks guest profile completion until all_settled is true.';


-- Trigger: prevent guest_profiles from being marked complete (i.e.
-- legal_name being filled in) until the sponsor has settled every fee.
-- The sponsor pays once for everyone they invite, including under-18
-- additional_guests, so this gate keeps the invariant enforced no
-- matter how many guests are added.
--
-- We evaluate against OTHER currently-stored rows for this sponsor PLUS
-- the new row's own payment_status, rather than reading the
-- sponsor_guest_fee_summary view. The view is a snapshot that doesn't
-- yet include the row being inserted, so an INSERT for a sponsor's
-- first guest would otherwise read as "no rows -> not settled" and
-- spuriously trip the gate. Computing the membership inline keeps the
-- contract correct: the sponsor must have everything settled, and the
-- new row must also be settled, before legal_name can land.
create or replace function public.guard_guest_profile_completion()
returns trigger
language plpgsql
as $$
declare
  v_other_unsettled int;
begin
  if new.legal_name is null or length(trim(new.legal_name)) = 0 then
    return new;
  end if;

  -- Defensive: NOT NULL on sponsor_id covers this in practice; the
  -- early return keeps a future schema relaxation from locking out
  -- anonymous rows we have no sponsor to bill against.
  if new.sponsor_id is null then return new; end if;

  select count(*) into v_other_unsettled
  from (
    select payment_status
    from public.guest_profiles gp
    where gp.sponsor_id = new.sponsor_id
      and (tg_op = 'INSERT' or gp.id <> new.id)
    union all
    select payment_status
    from public.additional_guests ag
    where ag.sponsor_id = new.sponsor_id
  ) others
  where payment_status not in ('paid', 'waived');

  if v_other_unsettled > 0
     or new.payment_status not in ('paid', 'waived') then
    raise exception 'guest_profile_locked_until_paid'
      using hint = 'The sponsoring employee has not finished paying all guest fees. The Stripe checkout for the sponsor must complete before this guest can finish their profile.',
            errcode = '42501';
  end if;

  return new;
end
$$;

create trigger guard_guest_profile_completion_biu
  before insert or update of legal_name on public.guest_profiles
  for each row execute function public.guard_guest_profile_completion();


-- =====================================================================
-- Admin-triggered event cascade delete.
-- =====================================================================
-- Hard-delete every row that lives under an event: sessions,
-- registrations, accommodations, transport vehicles, transport
-- requests, itinerary items, document acknowledgements, profile field
-- responses, notifications, feed items, report snapshots. The FK
-- cascades on each of those tables already point at events(id) ON
-- DELETE CASCADE, so dropping the events row is sufficient.
--
-- User-scoped data (additional_guests, guest_profiles, swag_sizes,
-- attendee_profiles, emergency_contacts, dietary, passport, etc.)
-- intentionally survives — those describe the person, not the event.
-- Use the dedicated user-deletion path if you need to remove someone.
--
-- Returns true on success. Raises on missing event so the SPA can
-- surface a clear error rather than silently doing nothing.
create or replace function public.delete_event_cascade(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'only admins can delete events'
      using errcode = '42501';
  end if;

  delete from public.events where id = p_event_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  return true;
end
$$;

revoke all on function public.delete_event_cascade(uuid) from public;
grant execute on function public.delete_event_cascade(uuid) to authenticated;


-- =====================================================================
-- Per-user special-request edits on itinerary elements.
-- =====================================================================
-- The Itinerary edit dialog lets attendees attach a free-form note to
-- their hotel room or transport request — "needs a crib in the room",
-- "departing 30 min earlier", etc. RLS on the underlying tables is
-- admin-only, but these SECURITY DEFINER helpers narrow the
-- write surface to a single column and verify the caller actually
-- owns the row.

create or replace function public.update_accommodation_special_requests(
  p_accommodation_id uuid,
  p_requests text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if not (
    public.is_admin()
    or exists (
      select 1 from public.accommodation_occupants ao
      where ao.accommodation_id = p_accommodation_id
        and ao.user_id = v_caller
    )
  ) then
    raise exception 'not an occupant' using errcode = '42501';
  end if;
  update public.accommodations
     set special_requests = nullif(trim(p_requests), '')
   where id = p_accommodation_id;
end
$$;

revoke all on function public.update_accommodation_special_requests(uuid, text) from public;
grant execute on function public.update_accommodation_special_requests(uuid, text) to authenticated;


create or replace function public.update_transport_request_special_requests(
  p_request_id uuid,
  p_requests text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if not (
    public.is_admin()
    or exists (
      select 1 from public.transport_requests tr
      where tr.id = p_request_id and tr.user_id = v_caller
    )
  ) then
    raise exception 'not the requester' using errcode = '42501';
  end if;
  update public.transport_requests
     set special_requests = nullif(trim(p_requests), '')
   where id = p_request_id;
end
$$;

revoke all on function public.update_transport_request_special_requests(uuid, text) from public;
grant execute on function public.update_transport_request_special_requests(uuid, text) to authenticated;
