-- Seed data for local development
--
-- Minimal but realistic: one Supafest event, a handful of employees, one
-- guest with sponsor, sessions across the day, documents requiring consent.
-- Keep this fast — `supabase db reset` runs it on every wipe.

-- Idempotent guard
do $$ begin
  if exists (select 1 from public.events where name = 'Supafest 2027') then
    raise notice 'kizuna seed already applied, skipping';
    return;
  end if;
end $$;


-- Auth users (real ones come from Supabase Auth signup; these are dev fixtures)
-- Local dev password is "kizuna-dev-only" for every seeded user. The bcrypt
-- hash is computed at runtime via pgcrypto so the SSO fallback in
-- src/features/auth/sso.ts can sign Paul in without any third-party setup.
insert into auth.users (id, email, aud, role, raw_user_meta_data, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id) values
  ('11111111-1111-1111-1111-111111111111', 'admin@kizuna.dev',     'authenticated', 'authenticated', '{"name":"Admin Adams"}',  crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'lu@kizuna.dev',        'authenticated', 'authenticated', '{"name":"Lu Liu"}',       crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('33333333-3333-3333-3333-333333333333', 'paul@kizuna.dev',      'authenticated', 'authenticated', '{"name":"Paul Park"}',    crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('44444444-4444-4444-4444-444444444444', 'maya@kizuna.dev',      'authenticated', 'authenticated', '{"name":"Maya Mason"}',   crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000'),
  ('55555555-5555-5555-5555-555555555555', 'guest.alex@kizuna.dev','authenticated', 'authenticated', '{"name":"Alex Guest"}',   crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- Insert identities so Supabase's auth flow recognises these accounts.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@kizuna.dev'
on conflict do nothing;


insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'admin@kizuna.dev',     'super_admin', 'hibob_admin', null,                                  'sso',             true),
  ('22222222-2222-2222-2222-222222222222', 'lu@kizuna.dev',        'admin',       'hibob_lu',    null,                                  'sso',             true),
  ('33333333-3333-3333-3333-333333333333', 'paul@kizuna.dev',      'employee',    'hibob_paul',  null,                                  'sso',             true),
  ('44444444-4444-4444-4444-444444444444', 'maya@kizuna.dev',      'employee',    'hibob_maya',  null,                                  'sso',             true),
  ('55555555-5555-5555-5555-555555555555', 'guest.alex@kizuna.dev','guest',       null,          '33333333-3333-3333-3333-333333333333','email_password',  true)
on conflict (id) do nothing;


insert into public.employee_profiles (user_id, preferred_name, legal_name, department, team, job_title, start_date, home_country, base_city, slack_handle, years_attended) values
  ('11111111-1111-1111-1111-111111111111', 'Adams',      'Adams Admin',     'Operations',  'Events',     'Head of Events',     '2021-01-15', 'US', 'San Francisco', 'adams', 4),
  ('22222222-2222-2222-2222-222222222222', 'Lu',         'Lu Liu',          'Operations',  'Events',     'Events Manager',     '2022-03-01', 'CA', 'Toronto',       'lu',    3),
  ('33333333-3333-3333-3333-333333333333', 'Paul',       'Paul Park',       'Engineering', 'Database',   'Senior Engineer',    '2023-06-01', 'GB', 'London',        'paul',  2),
  ('44444444-4444-4444-4444-444444444444', 'Maya',       'Maya Mason',      'Marketing',   'Content',    'Content Lead',       '2024-09-15', 'US', 'New York',      'maya',  1)
on conflict (user_id) do nothing;


insert into public.guest_profiles (user_id, sponsor_id, full_name, legal_name, relationship, payment_status, fee_amount) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Alex Guest', 'Alexander Guest', 'partner', 'pending', 950.00)
on conflict (user_id) do nothing;


-- The event
insert into public.events (id, name, type, location, start_date, end_date, reg_opens_at, reg_closes_at, is_active, hero_image_url) values
  ('99999999-9999-9999-9999-999999999999', 'Supafest 2027', 'supafest', 'Banff, Alberta, Canada',
   '2027-04-12', '2027-04-16', '2026-08-01 00:00:00+00', '2027-02-15 23:59:59+00', true,
   'https://kizuna.dev/banff-hero.jpg')
on conflict (id) do nothing;


-- Documents (waiver + code of conduct)
insert into public.documents (event_id, document_key, version, title, body, applies_to, requires_acknowledgement, requires_scroll, display_order) values
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


-- A few sessions
insert into public.sessions (event_id, title, type, audience, starts_at, ends_at, location, is_mandatory, description) values
  ('99999999-9999-9999-9999-999999999999', 'Welcome dinner',      'dinner',   'all',         '2027-04-12 18:00:00+00', '2027-04-12 21:00:00+00', 'Banff Springs ballroom', true,  'Kick-off dinner. Mandatory for all attendees.'),
  ('99999999-9999-9999-9999-999999999999', 'Engineering keynote', 'keynote',  'employees_only','2027-04-13 09:00:00+00', '2027-04-13 10:30:00+00', 'Main hall', true, 'Where we are headed in 2027.'),
  ('99999999-9999-9999-9999-999999999999', 'Database deep dive',  'breakout', 'opt_in',      '2027-04-13 11:00:00+00', '2027-04-13 12:00:00+00', 'Studio 2', false, 'Postgres internals.'),
  ('99999999-9999-9999-9999-999999999999', 'Mountain hike',       'activity', 'opt_in',      '2027-04-14 09:00:00+00', '2027-04-14 13:00:00+00', 'Sulphur Mountain', false, 'Bring layers.'),
  ('99999999-9999-9999-9999-999999999999', 'Closing party',       'social',   'all',         '2027-04-15 19:00:00+00', '2027-04-15 23:00:00+00', 'Hot springs lodge', true, 'Send-off celebration.');


-- Registrations + tasks for paul and maya
do $$
declare
  v_paul_reg uuid;
  v_maya_reg uuid;
  task_key registration_task_key;
begin
  insert into public.registrations (user_id, event_id, status, completion_pct)
  values ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'started', 0)
  returning id into v_paul_reg;

  insert into public.registrations (user_id, event_id, status, completion_pct)
  values ('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'invited', 0)
  returning id into v_maya_reg;

  for task_key in select unnest(array['personal_info','passport','emergency_contact','dietary','swag','transport','documents']::registration_task_key[]) loop
    insert into public.registration_tasks (registration_id, task_key, applies_to)
    values (v_paul_reg, task_key, 'all'::task_audience);
    insert into public.registration_tasks (registration_id, task_key, applies_to)
    values (v_maya_reg, task_key, 'all'::task_audience);
  end loop;
end $$;
