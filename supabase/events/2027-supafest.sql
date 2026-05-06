-- 2027 Supafest — Banff, Alberta, Canada
--
-- Source of truth for everything event-specific in local dev. To add a
-- new year, copy this file to `YYYY-supafest.sql` and edit the constants
-- below. supabase/events/README.md has the playbook.
--
-- Dates and channels lifted from the planning Notion page on 2026-04-30.
-- Idempotent: re-running on a populated database is safe.

do $$
declare
  -- ===== Edit these for a new event =====
  v_event_id uuid := '99999999-9999-9999-9999-999999999999';
  v_event_name text := 'Supafest 2027';
  v_event_subtitle text := 'Banff, Alberta — January 11-15';
  v_event_location text := 'Banff, Alberta, Canada';
  v_event_tz text := 'America/Edmonton';
  v_start_date date := '2027-01-11';
  v_end_date date := '2027-01-15';
  v_reg_opens_at timestamptz := '2026-08-01 00:00:00+00';
  v_reg_closes_at timestamptz := '2026-12-15 23:59:59+00';
  v_hero_image_path text := null;
  v_logo_path text := null;
  -- ===== End event constants =====
begin
  if exists (select 1 from public.events where id = v_event_id) then
    raise notice 'event % already seeded — skipping', v_event_name;
    return;
  end if;

  insert into public.events (
    id, name, subtitle, type, location, airport_iata, time_zone,
    start_date, end_date, reg_opens_at, reg_closes_at,
    is_active, hero_image_path, logo_path,
    invite_all_employees, allowed_domains
  ) values (
    v_event_id, v_event_name, v_event_subtitle, 'company_offsite', v_event_location, 'YYC', v_event_tz,
    v_start_date, v_end_date, v_reg_opens_at, v_reg_closes_at,
    true, v_hero_image_path, v_logo_path,
    -- The seeded fixture employees all live on @kizuna.dev. Anyone
    -- with a kizuna.dev email is open-to-all eligible by default;
    -- swap in your own production domains via Admin → About.
    true, ARRAY['kizuna.dev']
  );

  -- Documents that every attendee must read and sign.
  insert into public.documents (
    event_id, document_key, version, title, body,
    applies_to, requires_acknowledgement, requires_scroll, display_order
  ) values
    (v_event_id, 'expense_policy', 1, 'Travel Expense Policy',
     '## Travel expense policy

All Supafest travel must be booked through Perk before 15 December 2026. Out-of-pocket expenses are reimbursed at 100% with a receipt and proper category. Hotel incidentals are not reimbursed except for authorised business meals.

Use Brex for any reimbursable expense over $25. Anything under $25 reimburses through Expensify.

By signing this document you confirm that you have read and will follow the travel expense policy.',
     'employee', true, true, 3),
    (null, 'waiver', 1, 'Event waiver',
     '## Event waiver

By attending Supafest you agree to the following terms…

This is sample waiver content for local development. Replace with the real document before any production launch. Attendees must scroll to the bottom and tick the explicit consent checkbox before continuing.',
     'all', true, true, 1),
    (null, 'code_of_conduct', 1, 'Code of conduct',
     '## Code of conduct

Be kind. Be inclusive. Look out for each other.

Sample code of conduct content. Real content will replace this in production.',
     'all', true, true, 2)
  on conflict do nothing;

  -- Sessions: timestamps are stored as UTC. The event time zone above
  -- (America/Edmonton in winter = MST, UTC-7) drives display.
  -- 18:00 MST = 01:00 UTC the next day.
  insert into public.sessions (event_id, title, subtitle, type, audience, starts_at, ends_at, location, is_mandatory, abstract, speaker_email) values
    (v_event_id, 'Welcome dinner',      'Family-style dinner to kick off the week',     'dinner',   'all',            '2027-01-12 01:00:00+00', '2027-01-12 04:00:00+00', 'Banff Springs ballroom', true,  'Kick-off dinner. Mandatory for all attendees.', null),
    (v_event_id, 'Engineering keynote', 'Where we are headed in 2027',                  'keynote',  'employees_only', '2027-01-12 16:00:00+00', '2027-01-12 17:30:00+00', 'Main hall',             true,  'A look at the year ahead.', 'paul@kizuna.dev'),
    (v_event_id, 'Database deep dive',  'Postgres internals: WAL, MVCC, and vacuum',    'breakout', 'opt_in',         '2027-01-12 18:00:00+00', '2027-01-12 19:00:00+00', 'Studio 2',              false, 'How the WAL actually works.', 'paul@kizuna.dev'),
    (v_event_id, 'Mountain hike',       'Sulphur Mountain summit, moderate pace',       'activity', 'opt_in',         '2027-01-13 16:00:00+00', '2027-01-13 20:00:00+00', 'Sulphur Mountain',      false, 'Bring layers and water. Pace is moderate.', null),
    (v_event_id, 'Closing party',       'Hot springs send-off with live music',         'social',   'all',            '2027-01-15 02:00:00+00', '2027-01-15 06:00:00+00', 'Hot springs lodge',     true,  'Send-off celebration.', null);

  -- Default tags are already created by the ensure_default_session_tags
  -- trigger on event insert. Tag each sample session with its primary
  -- audience so the pills render in the seed data.
  insert into public.session_tag_assignments (session_id, tag_id)
  select s.id, t.id
  from public.sessions s, public.session_tags t
  where s.event_id = v_event_id
    and t.event_id = v_event_id
    and (
      (s.title = 'Welcome dinner'      and t.name = 'General Session')
      or (s.title = 'Engineering keynote' and t.name = 'Engineering')
      or (s.title = 'Database deep dive'  and t.name = 'Engineering')
      or (s.title = 'Mountain hike'       and t.name = 'General Session')
      or (s.title = 'Closing party'       and t.name = 'General Session')
    )
  on conflict do nothing;

  -- Editorial home-screen feed. Sample items demonstrating both
  -- locations. The SupaCup card was previously hardcoded into the home
  -- screen; it now lives here so admins can swap it out year-over-year.
  insert into public.feed_items (event_id, location, position, title, subtitle, body, image_path) values
    (v_event_id, 'sidebar', 0,
     'Defending SupaCup champion',
     'Tyler Shukert · Champion of Supafest 2026 — Da Nang',
     null,
     null),
    (v_event_id, 'main', 0,
     'Welcome to Supafest 2027',
     'Five days in Banff, January 11-15',
     'Hotel rooms are filling up. Book your travel through Perk by 15 December 2026.',
     null),
    (v_event_id, 'main', 1,
     'New: opt-in breakouts',
     'Pick the technical sessions that matter to you',
     'The agenda has 14 breakout slots this year. Star the ones you want to attend in the agenda tab.',
     null);

  -- Sample swag catalogue with deliberately silly product names so the
  -- demo has personality. Admins can edit/add/remove via /admin/swag.
  -- image_path / size_image_path stay null here; scripts/seed-test-storage.ts
  -- uploads the public/test-images/* files into the bucket and stamps
  -- the resulting paths on these rows.
  insert into public.swag_items (event_id, name, description, sizes, allows_opt_out, sort_order)
  values
    (v_event_id, 'Captain Picard''s Red Uniform',
     'Officially a "T-Shirt." Not officially flagship-bridge issue. Wear it on the off-property excursions and the locals will assume you''re in command.',
     array['XS','S','M','L','XL','XXL','3XL'], true, 0),
    (v_event_id, 'Worf''s Bat''leth',
     'Officially a "Letter Opener." Brushed steel, single curved blade, completely unbalanced for actual combat. Honour demands you open every postcard with one decisive stroke.',
     array['One size'], true, 1),
    (v_event_id, 'Insulated Banff Jacket',
     'Goose-down winter jacket. Required for the off-property excursions; everyone gets one whether they ask or not.',
     array['XS','S','M','L','XL','XXL'], false, 2),
    (v_event_id, 'Engineering Tote Bag',
     'Heavy canvas tote with reinforced handles. Big enough to fit the Bat''leth, the laptop, and the regret from buying every souvenir at the Banff hot springs gift shop.',
     array['One size'], true, 3),
    (v_event_id, 'Subspace Coffee Mug',
     'Ceramic, 14oz, dishwasher safe but not actually capable of subspace transmission. Tested.',
     array['One size'], true, 4)
  on conflict do nothing;

  -- Starter registrations + per-task rows for the dev employees so the
  -- wizard has data to resume from. Other users register on first visit.
  insert into public.registrations (user_id, event_id, status, completion_pct)
  values
    ('33333333-3333-3333-3333-333333333333', v_event_id, 'started', 0),
    ('44444444-4444-4444-4444-444444444444', v_event_id, 'invited', 0)
  on conflict do nothing;

  insert into public.registration_tasks (registration_id, task_key, applies_to)
  select r.id, k.task_key, 'all'::task_audience
  from public.registrations r
  cross join unnest(
    array['attending','personal_info','passport','emergency_contact','dietary','accessibility','swag','transport','documents']::registration_task_key[]
  ) as k(task_key)
  where r.event_id = v_event_id
  on conflict do nothing;
end $$;
