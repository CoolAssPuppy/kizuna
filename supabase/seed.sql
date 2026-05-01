-- People seed for local development.
--
-- Just identities — no event, no sessions. Event-specific data lives in
-- supabase/events/*.sql so we can swap years without touching this file.
-- Keep this fast: `supabase db reset` runs it on every wipe.
--
-- Local dev password is "kizuna-dev-only" for every seeded user. The bcrypt
-- hash is computed at runtime via pgcrypto so the SSO fallback in
-- src/features/auth/sso.ts can sign in without any third-party setup.
--
-- Note on the empty-string defaults: GoTrue stores token fields as NOT NULL
-- text and chokes on NULL when scanning. We explicitly set every one of
-- those columns so the row is compatible with `auth.users` query path.

insert into auth.users (
  id, email, aud, role, raw_user_meta_data, encrypted_password,
  email_confirmed_at, created_at, updated_at, instance_id,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data
) values
  ('00000000-0000-0000-0000-0000000000aa', 'prashant@kizuna.dev',  'authenticated', 'authenticated', '{"name":"Prashant Sridharan"}', crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-1111-1111-111111111111', 'admin@kizuna.dev',     'authenticated', 'authenticated', '{"name":"Admin Adams"}',        crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'),
  ('22222222-2222-2222-2222-222222222222', 'lu@kizuna.dev',        'authenticated', 'authenticated', '{"name":"Lu Liu"}',             crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'),
  ('33333333-3333-3333-3333-333333333333', 'paul@kizuna.dev',      'authenticated', 'authenticated', '{"name":"Paul Park"}',          crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'),
  ('44444444-4444-4444-4444-444444444444', 'maya@kizuna.dev',      'authenticated', 'authenticated', '{"name":"Maya Mason"}',         crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}'),
  ('55555555-5555-5555-5555-555555555555', 'guest.alex@kizuna.dev','authenticated', 'authenticated', '{"name":"Alex Guest"}',         crypt('kizuna-dev-only', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '', '', '', '', '', '', '', '{"provider":"email","providers":["email"]}')
on conflict (id) do nothing;

-- Insert identities so Supabase's auth flow recognises these accounts.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@kizuna.dev'
on conflict do nothing;

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider, is_active) values
  ('00000000-0000-0000-0000-0000000000aa', 'prashant@kizuna.dev',  'super_admin', 'hibob_prashant', null,                                  'sso',            true),
  ('11111111-1111-1111-1111-111111111111', 'admin@kizuna.dev',     'super_admin', 'hibob_admin',    null,                                  'sso',            true),
  ('22222222-2222-2222-2222-222222222222', 'lu@kizuna.dev',        'admin',       'hibob_lu',       null,                                  'sso',            true),
  ('33333333-3333-3333-3333-333333333333', 'paul@kizuna.dev',      'employee',    'hibob_paul',     null,                                  'sso',            true),
  ('44444444-4444-4444-4444-444444444444', 'maya@kizuna.dev',      'employee',    'hibob_maya',     null,                                  'sso',            true),
  ('55555555-5555-5555-5555-555555555555', 'guest.alex@kizuna.dev','guest',       null,             '33333333-3333-3333-3333-333333333333','email_password', true)
on conflict (id) do nothing;

insert into public.employee_profiles (user_id, preferred_name, first_name, last_name, legal_name, department, team, job_title, start_date, home_country, base_city, slack_handle, years_attended) values
  ('00000000-0000-0000-0000-0000000000aa', 'Prashant',  'Prashant', 'Sridharan', 'Prashant Sridharan', 'Marketing',  'DevRel',     'Head of DevRel',     '2024-01-15', 'US', 'San Francisco', 'prashant', 3),
  ('11111111-1111-1111-1111-111111111111', 'Adams',     'Adams',    'Admin',     'Adams Admin',        'Operations', 'Events',     'Head of Events',     '2021-01-15', 'US', 'San Francisco', 'adams',    4),
  ('22222222-2222-2222-2222-222222222222', 'Lu',        'Lu',       'Liu',       'Lu Liu',             'Operations', 'Events',     'Events Manager',     '2022-03-01', 'CA', 'Toronto',       'lu',       3),
  ('33333333-3333-3333-3333-333333333333', 'Paul',      'Paul',     'Park',      'Paul Park',          'Engineering','Database',   'Senior Engineer',    '2023-06-01', 'GB', 'London',        'paul',     2),
  ('44444444-4444-4444-4444-444444444444', 'Maya',      'Maya',     'Mason',     'Maya Mason',         'Marketing',  'Content',    'Content Lead',       '2024-09-15', 'US', 'New York',      'maya',     1)
on conflict (user_id) do nothing;

insert into public.guest_profiles (user_id, sponsor_id, full_name, legal_name, relationship, payment_status, fee_amount) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Alex Guest', 'Alexander Guest', 'partner', 'pending', 950.00)
on conflict (user_id) do nothing;


-- =====================================================================
-- System channels — required by RLS so messages.channel_has_access can
-- resolve them. Created without a created_by because they predate any
-- user. is_system=true keeps them protected from the regular update/
-- delete policies.
-- =====================================================================
insert into public.channels (slug, name, description, is_system, created_by) values
  ('general',       'General',       'Open chat for everyone.',                                   true, null),
  ('announcements', 'Announcements', 'Official updates from the events team.',                    true, null),
  ('guests',        'Guests',        'Channel for guests and the partners team supporting them.', true, null)
on conflict (slug) do nothing;


-- =====================================================================
-- Hobby catalog — canonical typeahead suggestions across dev/stg/prd.
-- Free-form hobbies are still allowed; this just primes the autocomplete.
-- =====================================================================
insert into public.hobby_catalog (slug, label, category) values
  -- Outdoor + sport
  ('skiing',         'Skiing',          'outdoor'),
  ('snowboarding',   'Snowboarding',    'outdoor'),
  ('hiking',         'Hiking',          'outdoor'),
  ('trail-running',  'Trail running',   'outdoor'),
  ('running',        'Running',         'fitness'),
  ('cycling',        'Cycling',         'outdoor'),
  ('rock-climbing',  'Rock climbing',   'outdoor'),
  ('surfing',        'Surfing',         'outdoor'),
  ('sailing',        'Sailing',         'outdoor'),
  ('kayaking',       'Kayaking',        'outdoor'),
  ('camping',        'Camping',         'outdoor'),
  ('yoga',           'Yoga',            'fitness'),
  ('pilates',        'Pilates',         'fitness'),
  ('weightlifting',  'Weightlifting',   'fitness'),
  ('crossfit',       'CrossFit',        'fitness'),
  ('martial-arts',   'Martial arts',    'fitness'),
  -- Creative
  ('photography',    'Photography',     'creative'),
  ('film-photography','Film photography','creative'),
  ('drawing',        'Drawing',         'creative'),
  ('painting',       'Painting',        'creative'),
  ('woodworking',    'Woodworking',     'creative'),
  ('pottery',        'Pottery',         'creative'),
  ('writing',        'Writing',         'creative'),
  ('poetry',         'Poetry',          'creative'),
  ('music-production','Music production','creative'),
  ('djing',          'DJing',           'creative'),
  ('singing',        'Singing',         'creative'),
  ('guitar',         'Guitar',          'creative'),
  ('piano',          'Piano',           'creative'),
  -- Tech
  ('open-source',    'Open source',     'tech'),
  ('home-automation','Home automation', 'tech'),
  ('mechanical-keyboards','Mechanical keyboards','tech'),
  ('3d-printing',    '3D printing',     'tech'),
  ('retro-gaming',   'Retro gaming',    'tech'),
  ('board-games',    'Board games',     'social'),
  ('video-games',    'Video games',     'social'),
  ('chess',          'Chess',           'social'),
  ('tabletop-rpgs',  'Tabletop RPGs',   'social'),
  -- Food + drink
  ('coffee',         'Coffee',          'food'),
  ('cooking',        'Cooking',         'food'),
  ('baking',         'Baking',          'food'),
  ('wine',           'Wine',            'food'),
  ('whisky',         'Whisky',          'food'),
  ('craft-beer',     'Craft beer',      'food'),
  -- Travel + culture
  ('travel',         'Travel',          'travel'),
  ('languages',      'Languages',       'travel'),
  ('birdwatching',   'Birdwatching',    'outdoor'),
  ('reading',        'Reading',         'culture'),
  ('film',           'Film',            'culture'),
  ('theater',        'Theater',         'culture'),
  ('podcasts',       'Podcasts',        'culture')
on conflict (slug) do nothing;
