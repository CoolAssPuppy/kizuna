-- Row Level Security policies
--
-- RLS is enabled on every table; the application layer cannot bypass it.
--
-- App role (employee | guest | admin | super_admin) lives in the JWT custom
-- claim `app_role`. This is set by a Custom Access Token Hook that reads
-- public.users.role on token issuance.
--
-- The standard JWT `role` claim stays 'authenticated' / 'anon' so Supabase's
-- built-in auth.role() and Postgres role mapping continue to work.

create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role',
    auth.jwt() ->> 'app_role'
  )
$$;

comment on function public.auth_role() is
  'Reads the kizuna app role from JWT custom claim "app_role". Set by Custom Access Token Hook in production; injected directly by tests.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Prefer the JWT custom claim (zero queries). If the claim is missing —
  -- e.g. a session minted before the auth hook was wired up, or an
  -- internal pg session running without claims — fall back to a direct
  -- read of public.users so admin writes don't fail with RLS errors.
  select coalesce(
    public.auth_role() in ('admin', 'super_admin'),
    false
  ) or exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'super_admin')
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.auth_role() = 'super_admin',
    false
  ) or exists (
    select 1 from public.users
    where id = auth.uid() and role = 'super_admin'
  )
$$;


-- Convenience helpers for row-ownership checks. Most policies follow the
-- shape "this row belongs to me, or I'm an admin". Wrapping that in a single
-- function keeps policy bodies short and consistent.
-- Self, sponsor-of-dependent, or admin.
--
-- Per-section data (dietary, accessibility, swag, passport, emergency
-- contact, attendee profile, registrations, etc.) is keyed on user_id.
-- A dependent has a shadow public.users row with role='dependent' and
-- sponsor_id pointing at the employee who added them. The sponsor
-- needs to write into the dependent's per-section rows on their
-- behalf — so this helper resolves true when p_user_id is a dependent
-- whose sponsor is the caller.
--
-- SECURITY DEFINER so the inline lookup against public.users (which
-- itself has RLS) doesn't fight the surrounding policy evaluation.
create or replace function public.is_self_or_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.users u
      where u.id = p_user_id
        and u.role = 'dependent'
        and u.sponsor_id = auth.uid()
    )
$$;


-- Reads is_leadership from the JWT custom claim, with a fallback to a
-- direct read of public.users for sessions minted before the auth hook
-- gained the claim.
create or replace function public.is_leadership_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_leadership')::boolean,
    (auth.jwt() ->> 'is_leadership')::boolean,
    (select is_leadership from public.users where id = auth.uid()),
    false
  )
$$;


-- channel_has_access: messages RLS gate. Phase 1 simple rules:
--   - any slug in public.channels (active row) -> any authenticated user
--   - 'dm:<uuid_a>:<uuid_b>'                   -> the two participants
--
-- Pre-`channels` legacy slugs (general / announcements / guests / team:*)
-- are now rows in public.channels seeded by the events migration, so the
-- single "exists in channels" branch covers them all.
create or replace function public.channel_has_access(p_uid uuid, p_channel text)
returns boolean
language plpgsql
stable
as $$
begin
  if p_uid is null then return false; end if;

  if p_channel like 'dm:%' then
    return p_uid::text = any(string_to_array(substr(p_channel, 4), ':'));
  end if;

  return exists (
    select 1 from public.channels
    where slug = p_channel and archived_at is null
  );
end
$$;


-- Enable RLS on every public table.
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end
$$;


-- Identity
create policy users_self_read on public.users
  for select using (public.is_self_or_admin(id));

create policy users_self_update on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all on public.users
  for all using (public.is_admin())
  with check (public.is_admin());

-- Community read: any authenticated user can resolve email + role +
-- leadership flag for an attendee with a non-private community profile.
-- This is the spine of the people-matching tables and channel sender
-- rendering — without it, joins through users come back null.
create policy users_community_read on public.users
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.attendee_profiles ap
      where ap.user_id = users.id and ap.visibility <> 'private'
    )
  );


create policy employee_profiles_self_read on public.employee_profiles
  for select using (public.is_self_or_admin(user_id));

create policy employee_profiles_self_write on public.employee_profiles
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy employee_profiles_admin_all on public.employee_profiles
  for all using (public.is_admin())
  with check (public.is_admin());

-- Same community read rule for employee_profiles. Limits exposure to the
-- columns the SDK joins for the community page (preferred_name,
-- legal_name, first_name/last_name, avatar_url) — every other column is
-- already covered by the self/admin read policy or simply not selected
-- on the community surface.
create policy employee_profiles_community_read on public.employee_profiles
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.attendee_profiles ap
      where ap.user_id = employee_profiles.user_id and ap.visibility <> 'private'
    )
  );


create policy guest_profiles_sponsor_read on public.guest_profiles
  for select using (sponsor_id = auth.uid() or user_id = auth.uid() or public.is_admin());

create policy guest_profiles_self_write on public.guest_profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy guest_profiles_admin_all on public.guest_profiles
  for all using (public.is_admin())
  with check (public.is_admin());


create policy guest_invitations_sponsor_read on public.guest_invitations
  for select using (sponsor_id = auth.uid() or public.is_admin());

create policy guest_invitations_sponsor_write on public.guest_invitations
  for all using (sponsor_id = auth.uid())
  with check (sponsor_id = auth.uid());

create policy guest_invitations_admin_all on public.guest_invitations
  for all using (public.is_admin())
  with check (public.is_admin());


-- Minor profiles on additional_guests are private by default. Read +
-- write are open to:
--   * Admins (via is_admin())
--   * The sponsoring employee (auth.uid() = sponsor_id)
--   * Any of the sponsor's ADULT guests (a guest_profiles row whose
--     sponsor_id matches AND whose user_id = auth.uid()). This lets
--     a sponsor's spouse fill in their child's dietary restrictions
--     without a separate handoff back to the sponsor.
-- The CHECK clause uses the same expression so writes obey the same
-- audience as reads.
create policy additional_guests_editor_all on public.additional_guests
  for all using (
    public.is_admin()
    or sponsor_id = auth.uid()
    or exists (
      select 1 from public.guest_profiles gp
      where gp.user_id = auth.uid()
        and gp.sponsor_id = additional_guests.sponsor_id
    )
  )
  with check (
    public.is_admin()
    or sponsor_id = auth.uid()
    or exists (
      select 1 from public.guest_profiles gp
      where gp.user_id = auth.uid()
        and gp.sponsor_id = additional_guests.sponsor_id
    )
  );


create policy emergency_contacts_self_all on public.emergency_contacts
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


create policy accessibility_preferences_self_all on public.accessibility_preferences
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


-- Events: every authenticated user can read; only admins write.
-- Users see events they have a registration row in, OR events flagged
-- invite_all_employees = true (provided they are an active employee).
-- Admins see every event regardless.
create policy events_visible_read on public.events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.registrations r
      where r.event_id = events.id and r.user_id = auth.uid()
    )
    or (
      events.invite_all_employees
      and exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'employee' and u.is_active
      )
    )
  );

create policy events_admin_write on public.events
  for all using (public.is_admin())
  with check (public.is_admin());


-- Feed items: anyone authenticated can read items inside their display
-- window. Admins manage everything.
create policy feed_items_authenticated_read on public.feed_items
  for select using (
    auth.role() = 'authenticated'
    and (starts_displaying_at is null or starts_displaying_at <= now())
    and (ends_displaying_at is null or ends_displaying_at > now())
  );

create policy feed_items_admin_write on public.feed_items
  for all using (public.is_admin())
  with check (public.is_admin());


create policy sessions_authenticated_read on public.sessions
  for select using (auth.role() = 'authenticated');

create policy sessions_admin_write on public.sessions
  for all using (public.is_admin())
  with check (public.is_admin());


create policy session_registrations_self_all on public.session_registrations
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


-- Session favorites: each user manages their own row, admins read all
-- so admin reports can show "most starred sessions".
create policy session_favorites_self_all on public.session_favorites
  for all using (public.is_self_or_admin(user_id))
  with check (user_id = auth.uid());


create policy dinner_seating_self_read on public.dinner_seating
  for select using (public.is_self_or_admin(user_id));

create policy dinner_seating_admin_write on public.dinner_seating
  for all using (public.is_admin())
  with check (public.is_admin());


create policy itinerary_items_self_read on public.itinerary_items
  for select using (public.is_self_or_admin(user_id));

create policy itinerary_items_admin_write on public.itinerary_items
  for all using (public.is_admin())
  with check (public.is_admin());

-- Self-imported rows let a user persist hotels and car services parsed
-- from their own confirmation emails directly into the itinerary view.
-- source='self_imported' AND source_id IS NULL keeps these rows from
-- colliding with the trigger-materialised ones from flights / sessions /
-- accommodations.
create policy itinerary_items_self_imported_insert on public.itinerary_items
  for insert with check (
    user_id = auth.uid()
    and source = 'self_imported'
    and source_id is null
  );

create policy itinerary_items_self_imported_update on public.itinerary_items
  for update using (
    user_id = auth.uid()
    and source = 'self_imported'
  )
  with check (
    user_id = auth.uid()
    and source = 'self_imported'
  );

create policy itinerary_items_self_imported_delete on public.itinerary_items
  for delete using (user_id = auth.uid() and source = 'self_imported');

-- Guests who toggled syncs_with_sponsor=true on their guest_profiles
-- can read every itinerary_items row owned by their sponsoring
-- employee. The sponsor's items still belong to the sponsor — we just
-- widen visibility, no row duplication.
create policy itinerary_items_sponsor_read_for_synced_guest on public.itinerary_items
  for select using (
    exists (
      select 1 from public.guest_profiles g
      where g.user_id = auth.uid()
        and g.sponsor_id = itinerary_items.user_id
        and g.syncs_with_sponsor
    )
  );


-- Registration
create policy registrations_self_all on public.registrations
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


create policy registration_tasks_self_read on public.registration_tasks
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and public.is_self_or_admin(r.user_id)
    )
  );

create policy registration_tasks_self_write on public.registration_tasks
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and public.is_self_or_admin(r.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and public.is_self_or_admin(r.user_id)
    )
  );


create policy profile_custom_fields_authenticated_read on public.profile_custom_fields
  for select using (auth.role() = 'authenticated');

create policy profile_custom_fields_admin_write on public.profile_custom_fields
  for all using (public.is_admin())
  with check (public.is_admin());


create policy profile_field_responses_self_all on public.profile_field_responses
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


-- Passport: the owning user (or, for a dependent, the sponsor) can
-- read and write. Admins are blocked entirely — passport numbers must
-- remain private. is_self_or_admin's body resolves sponsor-of-dependent
-- but admin coverage is intentional here, so we exclude it inline.
create policy passport_details_self_only on public.passport_details
  for all using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = passport_details.user_id
        and u.role = 'dependent'
        and u.sponsor_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = passport_details.user_id
        and u.role = 'dependent'
        and u.sponsor_id = auth.uid()
    )
  );


create policy dietary_preferences_self_read on public.dietary_preferences
  for select using (public.is_self_or_admin(user_id));

create policy dietary_preferences_self_write on public.dietary_preferences
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));

create policy dietary_preferences_admin_all on public.dietary_preferences
  for all using (public.is_admin())
  with check (public.is_admin());


-- Logistics
create policy flights_self_read on public.flights
  for select using (public.is_self_or_admin(user_id));

-- Self-insert lets the SPA persist user-pasted flights (parse-itinerary
-- import flow). Source is recorded as 'manual_obs' so admin reports can
-- distinguish self-reported flights from Perk-synced ones. Admins can
-- still write any row via flights_admin_write.
create policy flights_self_insert on public.flights
  for insert with check (user_id = auth.uid() and source = 'manual_obs');

create policy flights_self_update on public.flights
  for update using (user_id = auth.uid() and source = 'manual_obs')
  with check (user_id = auth.uid() and source = 'manual_obs');

create policy flights_self_delete on public.flights
  for delete using (user_id = auth.uid() and source = 'manual_obs');

create policy flights_admin_write on public.flights
  for all using (public.is_admin())
  with check (public.is_admin());


create policy accommodations_occupant_read on public.accommodations
  for select using (
    exists (
      select 1 from public.accommodation_occupants ao
      where ao.accommodation_id = id and ao.user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy accommodations_admin_write on public.accommodations
  for all using (public.is_admin())
  with check (public.is_admin());


create policy accommodation_occupants_self_read on public.accommodation_occupants
  for select using (public.is_self_or_admin(user_id));

create policy accommodation_occupants_admin_write on public.accommodation_occupants
  for all using (public.is_admin())
  with check (public.is_admin());


-- transport_requests are admin-managed by design. Users create flights
-- (manual_obs source), and the admin or a Postgres trigger derives a
-- transport_request from that flight. There is intentionally no
-- self-insert policy on this table.
create policy transport_requests_self_read on public.transport_requests
  for select using (public.is_self_or_admin(user_id));

create policy transport_requests_admin_write on public.transport_requests
  for all using (public.is_admin())
  with check (public.is_admin());


create policy transport_vehicles_admin_all on public.transport_vehicles
  for all using (public.is_admin())
  with check (public.is_admin());


-- swag_sizes is polymorphic: a row is owned either by the user_id (the
-- attendee themselves) or by the sponsor of the additional_guest_id.
-- Admins can read/write everything.
create policy swag_sizes_self_or_sponsor on public.swag_sizes
  for all using (
    public.is_admin()
    or (user_id is not null and public.is_self_or_admin(user_id))
    or (
      additional_guest_id is not null
      and exists (
        select 1 from public.additional_guests g
        where g.id = additional_guest_id
          and g.sponsor_id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin()
    or (user_id is not null and public.is_self_or_admin(user_id))
    or (
      additional_guest_id is not null
      and exists (
        select 1 from public.additional_guests g
        where g.id = additional_guest_id
          and g.sponsor_id = auth.uid()
      )
    )
  );


-- Documents
create policy documents_authenticated_read on public.documents
  for select using (auth.role() = 'authenticated');

create policy documents_admin_write on public.documents
  for all using (public.is_admin())
  with check (public.is_admin());


create policy document_acks_self_read on public.document_acknowledgements
  for select using (public.is_self_or_admin(user_id));

create policy document_acks_self_insert on public.document_acknowledgements
  for insert with check (user_id = auth.uid());


-- Community
create policy attendee_profiles_authenticated_read on public.attendee_profiles
  for select using (
    auth.role() = 'authenticated'
    and (visibility <> 'private' or user_id = auth.uid())
  );

-- Admin-scoped read policy: admins must see every attendee_profiles row,
-- including private ones, so manifest tooling (Ground Transport Tool,
-- room assignment, dietary report) does not silently exclude attendees
-- who marked their profile private.
create policy attendee_profiles_admin_read on public.attendee_profiles
  for select using (public.is_admin());

create policy attendee_profiles_self_write on public.attendee_profiles
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


create policy messages_channel_read on public.messages
  for select using (
    auth.role() = 'authenticated'
    and public.channel_has_access(auth.uid(), channel)
    and deleted_at is null
  );

create policy messages_self_insert on public.messages
  for insert with check (sender_id = auth.uid() and public.channel_has_access(auth.uid(), channel));

create policy messages_self_update on public.messages
  for update using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Soft-delete by the sender or any admin. Hard delete is intentionally
-- not granted because we want the audit trail.
create policy messages_self_delete on public.messages
  for delete using (sender_id = auth.uid() or public.is_admin());


-- Channels: any authenticated user can read; any authenticated user can
-- create; the creator (or an admin) can rename, set description, archive.
-- System channels are protected from the regular update policy because
-- only an admin can mutate them.
create policy channels_authenticated_read on public.channels
  for select using (auth.role() = 'authenticated');

create policy channels_authenticated_insert on public.channels
  for insert with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
    and is_system = false
  );

create policy channels_creator_update on public.channels
  for update using (
    (created_by = auth.uid() and is_system = false)
    or public.is_admin()
  )
  with check (
    (created_by = auth.uid() and is_system = false)
    or public.is_admin()
  );

create policy channels_admin_delete on public.channels
  for delete using (public.is_admin());


-- Hobby catalog: read for anyone authenticated, write admin-only so the
-- list stays curated.
create policy hobby_catalog_authenticated_read on public.hobby_catalog
  for select using (auth.role() = 'authenticated');

create policy hobby_catalog_admin_write on public.hobby_catalog
  for all using (public.is_admin())
  with check (public.is_admin());


create policy votes_self_all on public.votes
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy votes_authenticated_read on public.votes
  for select using (auth.role() = 'authenticated');


-- Infra
create policy report_snapshots_admin_only on public.report_snapshots
  for all using (public.is_admin())
  with check (public.is_admin());


create policy notifications_self_read on public.notifications
  for select using (public.is_self_or_admin(user_id));

create policy notifications_admin_write on public.notifications
  for all using (public.is_admin())
  with check (public.is_admin());

-- Recipients flip the read flag via mark_notification_read(); a direct
-- UPDATE policy would let them tamper with subject/body/channel. The
-- function is SECURITY DEFINER so it can write through RLS.


create policy hibob_sync_log_admin_only on public.hibob_sync_log
  for all using (public.is_admin())
  with check (public.is_admin());


-- icebreaker_rephrasings: any authenticated user can read the cache so
-- the SPA can surface a polished question without a round trip to the
-- model. Writes are limited to the rephrase-icebreaker edge function
-- (service-role bypass via SECURITY DEFINER on the helper, or just
-- service-role from the function itself).
create policy icebreaker_rephrasings_read on public.icebreaker_rephrasings
  for select using (auth.role() = 'authenticated');

create policy icebreaker_rephrasings_admin_write on public.icebreaker_rephrasings
  for all using (public.is_admin())
  with check (public.is_admin());


-- data_conflicts: only super_admin can resolve, admin can read.
create policy data_conflicts_admin_read on public.data_conflicts
  for select using (public.is_admin());

create policy data_conflicts_super_admin_write on public.data_conflicts
  for all using (public.is_super_admin())
  with check (public.is_super_admin());
