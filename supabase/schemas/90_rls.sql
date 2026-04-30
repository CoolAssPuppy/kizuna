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
as $$
  select public.auth_role() in ('admin', 'super_admin')
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.auth_role() = 'super_admin'
$$;


-- Convenience helpers for row-ownership checks. Most policies follow the
-- shape "this row belongs to me, or I'm an admin". Wrapping that in a single
-- function keeps policy bodies short and consistent.
create or replace function public.is_self_or_admin(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select p_user_id = auth.uid() or public.is_admin()
$$;


-- channel_has_access: messages RLS gate. Phase 1 simple rules:
--   - 'general'              -> any authenticated user
--   - 'announcements'        -> any authenticated user (read), admins (write)
--   - 'guests'               -> guests and admins
--   - 'team:<dept>'          -> employees in that department, admins
--   - 'dm:<user_id>'         -> the two participants
create or replace function public.channel_has_access(p_uid uuid, p_channel text)
returns boolean
language plpgsql
stable
as $$
declare
  v_role text;
  v_dept text;
begin
  if p_uid is null then return false; end if;

  v_role := public.auth_role();

  if p_channel in ('general', 'announcements') then
    return true;
  end if;

  if p_channel = 'guests' then
    return v_role in ('guest', 'admin', 'super_admin');
  end if;

  if p_channel like 'team:%' then
    if v_role in ('admin', 'super_admin') then return true; end if;
    select department into v_dept from public.employee_profiles where user_id = p_uid;
    return v_dept = substr(p_channel, 6);
  end if;

  if p_channel like 'dm:%' then
    return p_uid::text = substr(p_channel, 4);
  end if;

  return false;
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


create policy employee_profiles_self_read on public.employee_profiles
  for select using (public.is_self_or_admin(user_id));

create policy employee_profiles_self_write on public.employee_profiles
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy employee_profiles_admin_all on public.employee_profiles
  for all using (public.is_admin())
  with check (public.is_admin());


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


create policy children_sponsor_all on public.children
  for all using (public.is_self_or_admin(sponsor_id))
  with check (public.is_self_or_admin(sponsor_id));


create policy emergency_contacts_self_all on public.emergency_contacts
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


-- Events: every authenticated user can read; only admins write.
create policy events_authenticated_read on public.events
  for select using (auth.role() = 'authenticated');

create policy events_admin_write on public.events
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


-- Passport: only the owning user can read or write. Admins are blocked
-- entirely (no policy granted) because passport numbers must remain private.
create policy passport_details_self_only on public.passport_details
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());


create policy dietary_preferences_self_read on public.dietary_preferences
  for select using (public.is_self_or_admin(user_id));

create policy dietary_preferences_self_write on public.dietary_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy dietary_preferences_admin_all on public.dietary_preferences
  for all using (public.is_admin())
  with check (public.is_admin());


-- Logistics
create policy flights_self_read on public.flights
  for select using (public.is_self_or_admin(user_id));

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


create policy transport_requests_self_read on public.transport_requests
  for select using (public.is_self_or_admin(user_id));

create policy transport_requests_admin_write on public.transport_requests
  for all using (public.is_admin())
  with check (public.is_admin());


create policy transport_vehicles_admin_all on public.transport_vehicles
  for all using (public.is_admin())
  with check (public.is_admin());


create policy swag_items_authenticated_read on public.swag_items
  for select using (auth.role() = 'authenticated');

create policy swag_items_admin_write on public.swag_items
  for all using (public.is_admin())
  with check (public.is_admin());


create policy swag_selections_self_all on public.swag_selections
  for all using (public.is_self_or_admin(user_id))
  with check (public.is_self_or_admin(user_id));


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

create policy attendee_profiles_self_write on public.attendee_profiles
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());


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


create policy hibob_sync_log_admin_only on public.hibob_sync_log
  for all using (public.is_admin())
  with check (public.is_admin());


-- data_conflicts: only super_admin can resolve, admin can read.
create policy data_conflicts_admin_read on public.data_conflicts
  for select using (public.is_admin());

create policy data_conflicts_super_admin_write on public.data_conflicts
  for all using (public.is_super_admin())
  with check (public.is_super_admin());
