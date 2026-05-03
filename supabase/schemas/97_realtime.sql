-- Realtime publication
--
-- Tables added here stream INSERT/UPDATE/DELETE events through Supabase
-- Realtime to the browser. The home screen, admin dashboard, and
-- notifications center all subscribe to these to stay live without
-- polling.
--
-- Idempotent: alter publication add table is a no-op if the table is
-- already a member.

do $$
declare
  v_table text;
  v_tables text[] := array[
    -- Home + admin dashboards
    'feed_items',
    'events',
    'sessions',
    'session_registrations',
    'session_favorites',
    'session_proposal_votes',
    'session_tags',
    'session_tag_assignments',
    'registrations',
    'users',
    'documents',
    'document_acknowledgements',
    'data_conflicts',
    -- Notifications and itinerary
    'notifications',
    'itinerary_items',
    -- Logistics
    'flights',
    'transport_requests',
    'transport_vehicles',
    -- Community
    'channels',
    'messages',
    'event_photos',
    'event_photo_tags'
  ];
begin
  foreach v_table in array v_tables loop
    -- pg_publication_tables ignores schema-qualified names; check by
    -- (pubname, schemaname, tablename).
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;
