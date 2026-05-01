-- Sample data for local dev and demo environments.
--
-- Seeds 60 fictional employees spread across five departments, each
-- themed after a beloved fictional universe so the demo feels alive
-- without leaking any real employee data:
--
--   Star Trek               -> Executive
--   Star Wars               -> Engineering
--   Harry Potter            -> Marketing
--   Battlestar Galactica    -> Sales
--   The Simpsons            -> Support
--
-- Plus a handful of guest invitations and registrations in flight.
--
-- Applied automatically as the last step of `npm run db:apply` so the dev
-- sign-in shortcuts (Pretend you're an employee / admin) always work.
-- Idempotent: re-running is safe (uuid PKs guard against duplicates).

begin;

-- =====================================================================
-- Auth users
-- =====================================================================

-- Helper: precomputed bcrypt hash of "kizuna-dev-only" computed by pgcrypto.
-- Every fictional employee shares the same dev password so QA can sign in
-- as anyone without juggling credentials. Production seeds replace this.

insert into auth.users (
  id, email, aud, role, raw_user_meta_data, encrypted_password,
  email_confirmed_at, created_at, updated_at, instance_id,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data
)
select
  user_id::uuid,
  email,
  'authenticated', 'authenticated',
  jsonb_build_object('name', preferred_name),
  crypt('kizuna-dev-only', gen_salt('bf')),
  now(), now(), now(),
  '00000000-0000-0000-0000-000000000000',
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb
from (values
  -- Executive: Star Trek
  ('a0000000-0000-0000-0000-000000000001', 'jean-luc.picard@kizuna.dev',  'Jean-Luc'),
  ('a0000000-0000-0000-0000-000000000002', 'kathryn.janeway@kizuna.dev',  'Kathryn'),
  ('a0000000-0000-0000-0000-000000000003', 'benjamin.sisko@kizuna.dev',   'Benjamin'),
  ('a0000000-0000-0000-0000-000000000004', 'jonathan.archer@kizuna.dev',  'Jonathan'),
  -- Engineering: Star Wars
  ('a0000000-0000-0000-0000-000000000010', 'luke.skywalker@kizuna.dev',   'Luke'),
  ('a0000000-0000-0000-0000-000000000011', 'leia.organa@kizuna.dev',      'Leia'),
  ('a0000000-0000-0000-0000-000000000012', 'han.solo@kizuna.dev',         'Han'),
  ('a0000000-0000-0000-0000-000000000013', 'rey.skywalker@kizuna.dev',    'Rey'),
  ('a0000000-0000-0000-0000-000000000014', 'finn.fn2187@kizuna.dev',      'Finn'),
  ('a0000000-0000-0000-0000-000000000015', 'poe.dameron@kizuna.dev',      'Poe'),
  ('a0000000-0000-0000-0000-000000000016', 'obi-wan.kenobi@kizuna.dev',   'Obi-Wan'),
  ('a0000000-0000-0000-0000-000000000017', 'padme.amidala@kizuna.dev',    'Padmé'),
  ('a0000000-0000-0000-0000-000000000018', 'mace.windu@kizuna.dev',       'Mace'),
  ('a0000000-0000-0000-0000-000000000019', 'ahsoka.tano@kizuna.dev',      'Ahsoka'),
  ('a0000000-0000-0000-0000-00000000001a', 'lando.calrissian@kizuna.dev', 'Lando'),
  ('a0000000-0000-0000-0000-00000000001b', 'cassian.andor@kizuna.dev',    'Cassian'),
  ('a0000000-0000-0000-0000-00000000001c', 'jyn.erso@kizuna.dev',         'Jyn'),
  ('a0000000-0000-0000-0000-00000000001d', 'din.djarin@kizuna.dev',       'Din'),
  -- Marketing: Harry Potter
  ('a0000000-0000-0000-0000-000000000020', 'harry.potter@kizuna.dev',     'Harry'),
  ('a0000000-0000-0000-0000-000000000021', 'hermione.granger@kizuna.dev', 'Hermione'),
  ('a0000000-0000-0000-0000-000000000022', 'ron.weasley@kizuna.dev',      'Ron'),
  ('a0000000-0000-0000-0000-000000000023', 'minerva.mcgonagall@kizuna.dev','Minerva'),
  ('a0000000-0000-0000-0000-000000000024', 'albus.dumbledore@kizuna.dev', 'Albus'),
  ('a0000000-0000-0000-0000-000000000025', 'sirius.black@kizuna.dev',     'Sirius'),
  ('a0000000-0000-0000-0000-000000000026', 'remus.lupin@kizuna.dev',      'Remus'),
  ('a0000000-0000-0000-0000-000000000027', 'rubeus.hagrid@kizuna.dev',    'Rubeus'),
  ('a0000000-0000-0000-0000-000000000028', 'luna.lovegood@kizuna.dev',    'Luna'),
  ('a0000000-0000-0000-0000-000000000029', 'neville.longbottom@kizuna.dev','Neville'),
  ('a0000000-0000-0000-0000-00000000002a', 'ginny.weasley@kizuna.dev',    'Ginny'),
  ('a0000000-0000-0000-0000-00000000002b', 'cho.chang@kizuna.dev',        'Cho'),
  ('a0000000-0000-0000-0000-00000000002c', 'cedric.diggory@kizuna.dev',   'Cedric'),
  ('a0000000-0000-0000-0000-00000000002d', 'fleur.delacour@kizuna.dev',   'Fleur'),
  -- Sales: Battlestar Galactica
  ('a0000000-0000-0000-0000-000000000030', 'william.adama@kizuna.dev',    'William'),
  ('a0000000-0000-0000-0000-000000000031', 'laura.roslin@kizuna.dev',     'Laura'),
  ('a0000000-0000-0000-0000-000000000032', 'kara.thrace@kizuna.dev',      'Kara'),
  ('a0000000-0000-0000-0000-000000000033', 'lee.adama@kizuna.dev',        'Lee'),
  ('a0000000-0000-0000-0000-000000000034', 'saul.tigh@kizuna.dev',        'Saul'),
  ('a0000000-0000-0000-0000-000000000035', 'galen.tyrol@kizuna.dev',      'Galen'),
  ('a0000000-0000-0000-0000-000000000036', 'karl.agathon@kizuna.dev',     'Karl'),
  ('a0000000-0000-0000-0000-000000000037', 'sharon.valerii@kizuna.dev',   'Sharon'),
  ('a0000000-0000-0000-0000-000000000038', 'gaius.baltar@kizuna.dev',     'Gaius'),
  ('a0000000-0000-0000-0000-000000000039', 'caprica.six@kizuna.dev',      'Caprica'),
  ('a0000000-0000-0000-0000-00000000003a', 'helena.cain@kizuna.dev',      'Helena'),
  ('a0000000-0000-0000-0000-00000000003b', 'samuel.anders@kizuna.dev',    'Samuel'),
  ('a0000000-0000-0000-0000-00000000003c', 'anastasia.dualla@kizuna.dev', 'Anastasia'),
  ('a0000000-0000-0000-0000-00000000003d', 'felix.gaeta@kizuna.dev',      'Felix'),
  -- Support: The Simpsons
  ('a0000000-0000-0000-0000-000000000040', 'homer.simpson@kizuna.dev',    'Homer'),
  ('a0000000-0000-0000-0000-000000000041', 'marge.simpson@kizuna.dev',    'Marge'),
  ('a0000000-0000-0000-0000-000000000042', 'lisa.simpson@kizuna.dev',     'Lisa'),
  ('a0000000-0000-0000-0000-000000000043', 'bart.simpson@kizuna.dev',     'Bart'),
  ('a0000000-0000-0000-0000-000000000044', 'ned.flanders@kizuna.dev',     'Ned'),
  ('a0000000-0000-0000-0000-000000000045', 'moe.szyslak@kizuna.dev',      'Moe'),
  ('a0000000-0000-0000-0000-000000000046', 'apu.nahasapeemapetilon@kizuna.dev', 'Apu'),
  ('a0000000-0000-0000-0000-000000000047', 'krusty.clown@kizuna.dev',     'Krusty'),
  ('a0000000-0000-0000-0000-000000000048', 'monty.burns@kizuna.dev',      'Monty'),
  ('a0000000-0000-0000-0000-000000000049', 'waylon.smithers@kizuna.dev',  'Waylon'),
  ('a0000000-0000-0000-0000-00000000004a', 'milhouse.vanhouten@kizuna.dev','Milhouse'),
  ('a0000000-0000-0000-0000-00000000004b', 'seymour.skinner@kizuna.dev',  'Seymour'),
  ('a0000000-0000-0000-0000-00000000004c', 'clancy.wiggum@kizuna.dev',    'Clancy'),
  ('a0000000-0000-0000-0000-00000000004d', 'edna.krabappel@kizuna.dev',   'Edna')
) as t(user_id, email, preferred_name)
on conflict (id) do nothing;


-- Identities (GoTrue requires a row per provider)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like 'a0000000%' or email like '%.%@kizuna.dev'
on conflict do nothing;


-- =====================================================================
-- public.users — kizuna identity layer
-- =====================================================================

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider, is_active)
select user_id::uuid, email, role::user_role, 'hibob_' || replace(user_id, '-', ''), null, 'sso', true
from (values
  -- Executive (super_admin / admin)
  ('a0000000-0000-0000-0000-000000000001', 'jean-luc.picard@kizuna.dev',     'super_admin'),
  ('a0000000-0000-0000-0000-000000000002', 'kathryn.janeway@kizuna.dev',     'admin'),
  ('a0000000-0000-0000-0000-000000000003', 'benjamin.sisko@kizuna.dev',      'admin'),
  ('a0000000-0000-0000-0000-000000000004', 'jonathan.archer@kizuna.dev',     'admin'),
  -- Engineering (employees)
  ('a0000000-0000-0000-0000-000000000010', 'luke.skywalker@kizuna.dev',      'employee'),
  ('a0000000-0000-0000-0000-000000000011', 'leia.organa@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000012', 'han.solo@kizuna.dev',            'employee'),
  ('a0000000-0000-0000-0000-000000000013', 'rey.skywalker@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000014', 'finn.fn2187@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000015', 'poe.dameron@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000016', 'obi-wan.kenobi@kizuna.dev',      'employee'),
  ('a0000000-0000-0000-0000-000000000017', 'padme.amidala@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000018', 'mace.windu@kizuna.dev',          'employee'),
  ('a0000000-0000-0000-0000-000000000019', 'ahsoka.tano@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-00000000001a', 'lando.calrissian@kizuna.dev',    'employee'),
  ('a0000000-0000-0000-0000-00000000001b', 'cassian.andor@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-00000000001c', 'jyn.erso@kizuna.dev',            'employee'),
  ('a0000000-0000-0000-0000-00000000001d', 'din.djarin@kizuna.dev',          'employee'),
  -- Marketing (employees)
  ('a0000000-0000-0000-0000-000000000020', 'harry.potter@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000021', 'hermione.granger@kizuna.dev',    'employee'),
  ('a0000000-0000-0000-0000-000000000022', 'ron.weasley@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000023', 'minerva.mcgonagall@kizuna.dev',  'employee'),
  ('a0000000-0000-0000-0000-000000000024', 'albus.dumbledore@kizuna.dev',    'employee'),
  ('a0000000-0000-0000-0000-000000000025', 'sirius.black@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000026', 'remus.lupin@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000027', 'rubeus.hagrid@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000028', 'luna.lovegood@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000029', 'neville.longbottom@kizuna.dev',  'employee'),
  ('a0000000-0000-0000-0000-00000000002a', 'ginny.weasley@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-00000000002b', 'cho.chang@kizuna.dev',           'employee'),
  ('a0000000-0000-0000-0000-00000000002c', 'cedric.diggory@kizuna.dev',      'employee'),
  ('a0000000-0000-0000-0000-00000000002d', 'fleur.delacour@kizuna.dev',      'employee'),
  -- Sales (employees)
  ('a0000000-0000-0000-0000-000000000030', 'william.adama@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000031', 'laura.roslin@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000032', 'kara.thrace@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000033', 'lee.adama@kizuna.dev',           'employee'),
  ('a0000000-0000-0000-0000-000000000034', 'saul.tigh@kizuna.dev',           'employee'),
  ('a0000000-0000-0000-0000-000000000035', 'galen.tyrol@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000036', 'karl.agathon@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000037', 'sharon.valerii@kizuna.dev',      'employee'),
  ('a0000000-0000-0000-0000-000000000038', 'gaius.baltar@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000039', 'caprica.six@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-00000000003a', 'helena.cain@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-00000000003b', 'samuel.anders@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-00000000003c', 'anastasia.dualla@kizuna.dev',    'employee'),
  ('a0000000-0000-0000-0000-00000000003d', 'felix.gaeta@kizuna.dev',         'employee'),
  -- Support (employees)
  ('a0000000-0000-0000-0000-000000000040', 'homer.simpson@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000041', 'marge.simpson@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-000000000042', 'lisa.simpson@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000043', 'bart.simpson@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000044', 'ned.flanders@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000045', 'moe.szyslak@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000046', 'apu.nahasapeemapetilon@kizuna.dev', 'employee'),
  ('a0000000-0000-0000-0000-000000000047', 'krusty.clown@kizuna.dev',        'employee'),
  ('a0000000-0000-0000-0000-000000000048', 'monty.burns@kizuna.dev',         'employee'),
  ('a0000000-0000-0000-0000-000000000049', 'waylon.smithers@kizuna.dev',     'employee'),
  ('a0000000-0000-0000-0000-00000000004a', 'milhouse.vanhouten@kizuna.dev',  'employee'),
  ('a0000000-0000-0000-0000-00000000004b', 'seymour.skinner@kizuna.dev',     'employee'),
  ('a0000000-0000-0000-0000-00000000004c', 'clancy.wiggum@kizuna.dev',       'employee'),
  ('a0000000-0000-0000-0000-00000000004d', 'edna.krabappel@kizuna.dev',      'employee')
) as t(user_id, email, role)
on conflict (id) do nothing;


-- =====================================================================
-- employee_profiles — narrative metadata
-- =====================================================================

insert into public.employee_profiles (
  user_id, preferred_name, legal_name, department, team, job_title,
  start_date, home_country, base_city, slack_handle, years_attended
)
select
  user_id::uuid, preferred_name, legal_name, department, team, job_title,
  start_date::date, home_country, base_city, slack_handle, years_attended::int
from (values
  -- Executive
  ('a0000000-0000-0000-0000-000000000001', 'Jean-Luc',  'Jean-Luc Picard',     'Executive',   'Office of the CEO',         'Chief Executive Officer',     '2020-01-04', 'FR', 'Paris',         'jlpicard',    5),
  ('a0000000-0000-0000-0000-000000000002', 'Kathryn',   'Kathryn Janeway',     'Executive',   'Office of the COO',         'Chief Operating Officer',     '2020-09-15', 'US', 'Bloomington',    'kjaneway',    4),
  ('a0000000-0000-0000-0000-000000000003', 'Benjamin',  'Benjamin Sisko',      'Executive',   'Office of the CRO',         'Chief Revenue Officer',       '2021-04-12', 'US', 'New Orleans',    'bsisko',      3),
  ('a0000000-0000-0000-0000-000000000004', 'Jonathan',  'Jonathan Archer',     'Executive',   'Office of the CFO',         'Chief Financial Officer',     '2021-08-09', 'US', 'San Francisco',  'jarcher',     3),
  -- Engineering
  ('a0000000-0000-0000-0000-000000000010', 'Luke',      'Luke Skywalker',      'Engineering', 'Database',                  'Staff Engineer',              '2022-02-01', 'US', 'San Francisco',  'lskywalker',  3),
  ('a0000000-0000-0000-0000-000000000011', 'Leia',      'Leia Organa',         'Engineering', 'Platform',                  'Engineering Manager',         '2021-11-08', 'US', 'New York',       'lorgana',     4),
  ('a0000000-0000-0000-0000-000000000012', 'Han',       'Han Solo',            'Engineering', 'Realtime',                  'Senior Engineer',             '2022-05-23', 'US', 'Austin',         'hsolo',       2),
  ('a0000000-0000-0000-0000-000000000013', 'Rey',       'Rey Skywalker',       'Engineering', 'Edge Functions',            'Senior Engineer',             '2023-03-14', 'GB', 'London',         'rskywalker',  2),
  ('a0000000-0000-0000-0000-000000000014', 'Finn',      'Finn FN2187',         'Engineering', 'Edge Functions',            'Engineer',                    '2024-01-22', 'GB', 'Manchester',     'finn',        1),
  ('a0000000-0000-0000-0000-000000000015', 'Poe',       'Poe Dameron',         'Engineering', 'Realtime',                  'Senior Engineer',             '2022-08-30', 'US', 'Miami',          'pdameron',    2),
  ('a0000000-0000-0000-0000-000000000016', 'Obi-Wan',   'Obi-Wan Kenobi',      'Engineering', 'Auth',                      'Distinguished Engineer',      '2020-06-01', 'GB', 'Edinburgh',      'okenobi',     5),
  ('a0000000-0000-0000-0000-000000000017', 'Padmé',     'Padmé Amidala',       'Engineering', 'Storage',                   'Engineering Manager',         '2021-02-17', 'IT', 'Naboo',          'pamidala',    4),
  ('a0000000-0000-0000-0000-000000000018', 'Mace',      'Mace Windu',          'Engineering', 'Auth',                      'Principal Engineer',          '2020-11-04', 'US', 'Los Angeles',    'mwindu',      4),
  ('a0000000-0000-0000-0000-000000000019', 'Ahsoka',    'Ahsoka Tano',         'Engineering', 'Database',                  'Senior Engineer',             '2023-07-19', 'AU', 'Sydney',         'atano',       2),
  ('a0000000-0000-0000-0000-00000000001a', 'Lando',     'Lando Calrissian',    'Engineering', 'Platform',                  'Staff Engineer',              '2022-04-04', 'US', 'Las Vegas',      'lcalrissian', 3),
  ('a0000000-0000-0000-0000-00000000001b', 'Cassian',   'Cassian Andor',       'Engineering', 'Security',                  'Senior Engineer',             '2023-09-12', 'MX', 'Mexico City',    'candor',      1),
  ('a0000000-0000-0000-0000-00000000001c', 'Jyn',       'Jyn Erso',            'Engineering', 'Security',                  'Senior Engineer',             '2024-04-08', 'GB', 'Birmingham',     'jerso',       1),
  ('a0000000-0000-0000-0000-00000000001d', 'Din',       'Din Djarin',          'Engineering', 'Mobile',                    'Senior Engineer',             '2023-01-30', 'US', 'Albuquerque',    'ddjarin',     2),
  -- Marketing
  ('a0000000-0000-0000-0000-000000000020', 'Harry',     'Harry Potter',        'Marketing',   'DevRel',                    'Director of DevRel',          '2021-09-01', 'GB', 'Godric''s Hollow','hpotter',     4),
  ('a0000000-0000-0000-0000-000000000021', 'Hermione',  'Hermione Granger',    'Marketing',   'Content',                   'Head of Content',             '2021-09-01', 'GB', 'London',         'hgranger',    4),
  ('a0000000-0000-0000-0000-000000000022', 'Ron',       'Ron Weasley',         'Marketing',   'DevRel',                    'Senior Developer Advocate',   '2022-09-01', 'GB', 'Devon',          'rweasley',    3),
  ('a0000000-0000-0000-0000-000000000023', 'Minerva',   'Minerva McGonagall',  'Marketing',   'Brand',                     'Head of Brand',               '2020-09-01', 'GB', 'Edinburgh',      'mmcgonagall', 5),
  ('a0000000-0000-0000-0000-000000000024', 'Albus',     'Albus Dumbledore',    'Marketing',   'Office of the CMO',         'Chief Marketing Officer',     '2020-01-15', 'GB', 'Mould-on-the-Wold','adumbledore', 5),
  ('a0000000-0000-0000-0000-000000000025', 'Sirius',    'Sirius Black',        'Marketing',   'Demand Gen',                'Demand Gen Lead',             '2022-04-01', 'GB', 'London',         'sblack',      3),
  ('a0000000-0000-0000-0000-000000000026', 'Remus',     'Remus Lupin',         'Marketing',   'DevRel',                    'Developer Advocate',          '2022-10-15', 'GB', 'Cardiff',        'rlupin',      2),
  ('a0000000-0000-0000-0000-000000000027', 'Rubeus',    'Rubeus Hagrid',       'Marketing',   'Events',                    'Head of Events',              '2021-03-01', 'GB', 'Forest of Dean', 'rhagrid',     4),
  ('a0000000-0000-0000-0000-000000000028', 'Luna',      'Luna Lovegood',       'Marketing',   'Content',                   'Senior Writer',               '2023-06-12', 'GB', 'Ottery St Catchpole','llovegood',   2),
  ('a0000000-0000-0000-0000-000000000029', 'Neville',   'Neville Longbottom',  'Marketing',   'Community',                 'Community Manager',           '2023-08-21', 'GB', 'Birmingham',     'nlongbottom', 1),
  ('a0000000-0000-0000-0000-00000000002a', 'Ginny',     'Ginny Weasley',       'Marketing',   'Social',                    'Social Media Manager',        '2024-02-05', 'GB', 'Devon',          'gweasley',    1),
  ('a0000000-0000-0000-0000-00000000002b', 'Cho',       'Cho Chang',           'Marketing',   'Brand',                     'Brand Designer',              '2023-11-01', 'HK', 'Hong Kong',      'cchang',      1),
  ('a0000000-0000-0000-0000-00000000002c', 'Cedric',    'Cedric Diggory',      'Marketing',   'Demand Gen',                'Marketing Operations Manager','2022-07-18', 'GB', 'Bristol',        'cdiggory',    3),
  ('a0000000-0000-0000-0000-00000000002d', 'Fleur',     'Fleur Delacour',      'Marketing',   'DevRel',                    'Developer Advocate (EMEA)',   '2023-04-10', 'FR', 'Paris',          'fdelacour',   2),
  -- Sales
  ('a0000000-0000-0000-0000-000000000030', 'William',   'William Adama',       'Sales',       'Office of the CRO',         'VP Sales',                    '2020-12-12', 'US', 'Boston',         'wadama',      5),
  ('a0000000-0000-0000-0000-000000000031', 'Laura',     'Laura Roslin',        'Sales',       'Strategic Accounts',        'Director, Strategic Accounts','2021-01-19', 'US', 'Chicago',        'lroslin',     4),
  ('a0000000-0000-0000-0000-000000000032', 'Kara',      'Kara Thrace',         'Sales',       'Strategic Accounts',        'Senior AE',                   '2022-03-21', 'US', 'Phoenix',        'kthrace',     3),
  ('a0000000-0000-0000-0000-000000000033', 'Lee',       'Lee Adama',           'Sales',       'Mid-Market',                'Director, Mid-Market',        '2021-08-30', 'US', 'Seattle',        'ladama',      4),
  ('a0000000-0000-0000-0000-000000000034', 'Saul',      'Saul Tigh',           'Sales',       'Sales Engineering',         'Sales Engineering Manager',   '2021-05-14', 'US', 'Dallas',        'stigh',       4),
  ('a0000000-0000-0000-0000-000000000035', 'Galen',     'Galen Tyrol',         'Sales',       'Sales Engineering',         'Senior Sales Engineer',       '2022-11-09', 'US', 'Atlanta',        'gtyrol',      2),
  ('a0000000-0000-0000-0000-000000000036', 'Karl',      'Karl Agathon',        'Sales',       'Mid-Market',                'Account Executive',           '2023-02-27', 'US', 'Denver',         'kagathon',    2),
  ('a0000000-0000-0000-0000-000000000037', 'Sharon',    'Sharon Valerii',      'Sales',       'SMB',                       'Senior AE',                   '2023-05-08', 'US', 'San Diego',      'svalerii',    1),
  ('a0000000-0000-0000-0000-000000000038', 'Gaius',     'Gaius Baltar',        'Sales',       'Sales Engineering',         'Solutions Architect',         '2023-09-25', 'GB', 'Cambridge',      'gbaltar',     2),
  ('a0000000-0000-0000-0000-000000000039', 'Caprica',   'Caprica Six',         'Sales',       'Strategic Accounts',        'Senior AE',                   '2022-06-14', 'US', 'Houston',        'csix',        3),
  ('a0000000-0000-0000-0000-00000000003a', 'Helena',    'Helena Cain',         'Sales',       'Strategic Accounts',        'Director, EMEA',              '2021-11-22', 'DE', 'Berlin',         'hcain',       4),
  ('a0000000-0000-0000-0000-00000000003b', 'Samuel',    'Samuel Anders',       'Sales',       'Mid-Market',                'Account Executive',           '2024-03-04', 'US', 'Portland',       'sanders',     1),
  ('a0000000-0000-0000-0000-00000000003c', 'Anastasia', 'Anastasia Dualla',    'Sales',       'Sales Operations',          'Sales Operations Manager',    '2022-01-31', 'US', 'Minneapolis',    'adualla',     3),
  ('a0000000-0000-0000-0000-00000000003d', 'Felix',     'Felix Gaeta',         'Sales',       'Sales Operations',          'Senior Analyst',              '2023-07-07', 'PT', 'Lisbon',         'fgaeta',      1),
  -- Support
  ('a0000000-0000-0000-0000-000000000040', 'Homer',     'Homer Simpson',       'Support',     'Customer Support',          'Director, Customer Support',  '2020-08-12', 'US', 'Springfield',    'hsimpson',    5),
  ('a0000000-0000-0000-0000-000000000041', 'Marge',     'Marge Simpson',       'Support',     'Customer Support',          'Customer Support Manager',    '2021-02-04', 'US', 'Springfield',    'msimpson',    4),
  ('a0000000-0000-0000-0000-000000000042', 'Lisa',      'Lisa Simpson',        'Support',     'Customer Success',          'Customer Success Manager',    '2023-10-01', 'US', 'Springfield',    'lsimpson',    1),
  ('a0000000-0000-0000-0000-000000000043', 'Bart',      'Bart Simpson',        'Support',     'Customer Support',          'Support Engineer',            '2024-05-15', 'US', 'Springfield',    'bsimpson',    1),
  ('a0000000-0000-0000-0000-000000000044', 'Ned',       'Ned Flanders',        'Support',     'Customer Success',          'Director, Customer Success',  '2020-10-05', 'US', 'Springfield',    'nflanders',   5),
  ('a0000000-0000-0000-0000-000000000045', 'Moe',       'Moe Szyslak',         'Support',     'Customer Support',          'Senior Support Engineer',     '2022-12-12', 'US', 'Springfield',    'mszyslak',    2),
  ('a0000000-0000-0000-0000-000000000046', 'Apu',       'Apu Nahasapeemapetilon','Support',   'Customer Support',          'Senior Support Engineer',     '2021-07-01', 'IN', 'Bengaluru',      'apu',         4),
  ('a0000000-0000-0000-0000-000000000047', 'Krusty',    'Herschel Krustofski', 'Support',     'Community',                 'Community Manager',           '2022-09-01', 'US', 'Springfield',    'krusty',      2),
  ('a0000000-0000-0000-0000-000000000048', 'Monty',     'Charles Montgomery Burns','Support', 'Office of Support',         'VP, Customer Operations',     '2020-01-01', 'US', 'Springfield',    'mburns',      5),
  ('a0000000-0000-0000-0000-000000000049', 'Waylon',    'Waylon Smithers',     'Support',     'Office of Support',         'Chief of Staff',              '2020-01-01', 'US', 'Springfield',    'wsmithers',   5),
  ('a0000000-0000-0000-0000-00000000004a', 'Milhouse',  'Milhouse Van Houten', 'Support',     'Customer Success',          'Customer Success Engineer',   '2024-01-08', 'US', 'Springfield',    'mvanhouten',  1),
  ('a0000000-0000-0000-0000-00000000004b', 'Seymour',   'Seymour Skinner',     'Support',     'Customer Education',        'Director, Customer Education','2021-04-22', 'US', 'Springfield',    'sskinner',    4),
  ('a0000000-0000-0000-0000-00000000004c', 'Clancy',    'Clancy Wiggum',       'Support',     'Customer Support',          'Senior Support Engineer',     '2023-03-15', 'US', 'Springfield',    'cwiggum',     1),
  ('a0000000-0000-0000-0000-00000000004d', 'Edna',      'Edna Krabappel',      'Support',     'Customer Education',        'Lead Customer Educator',      '2022-08-08', 'US', 'Springfield',    'ekrabappel',  3)
) as t(user_id, preferred_name, legal_name, department, team, job_title, start_date, home_country, base_city, slack_handle, years_attended)
on conflict (user_id) do nothing;


-- =====================================================================
-- Registrations + tasks for the active Supafest event
-- =====================================================================

do $$
declare
  v_event_id uuid;
  v_user record;
  v_reg_id uuid;
  v_task registration_task_key;
  v_completed int;
begin
  select id into v_event_id from public.events where is_active = true and type = 'supafest' limit 1;
  if v_event_id is null then
    raise notice 'no active supafest event yet — sample registrations skipped';
    return;
  end if;

  for v_user in
    select id from public.users
    where role in ('employee','admin','super_admin')
      and email like '%@kizuna.dev'
      and email <> 'prashant@kizuna.dev'
  loop
    insert into public.registrations (user_id, event_id, status)
    values (v_user.id, v_event_id, 'started')
    on conflict (user_id, event_id) do nothing
    returning id into v_reg_id;

    if v_reg_id is null then continue; end if;

    -- Sprinkle a realistic mix of task progress: ~40% done, ~40% mid,
    -- ~20% just started.
    v_completed := (abs(hashtext(v_user.id::text)) % 7);

    for v_task in
      select unnest(array['personal_info','passport','emergency_contact','dietary','swag','transport','documents']::registration_task_key[])
    loop
      insert into public.registration_tasks (registration_id, task_key, applies_to, status, completed_at)
      values (
        v_reg_id, v_task, 'all',
        case when v_completed > 0 then 'complete'::registration_task_status else 'pending' end,
        case when v_completed > 0 then now() else null end
      )
      on conflict (registration_id, task_key) do nothing;
      v_completed := v_completed - 1;
    end loop;
  end loop;
end
$$;


-- =====================================================================
-- A handful of dietary preferences and emergency contacts
-- =====================================================================

insert into public.dietary_preferences (user_id, restrictions, allergies, alcohol_free, severity, notes)
values
  ('a0000000-0000-0000-0000-000000000010', array['vegetarian'], array[]::text[], false, 'preference',  'Plant-forward when possible.'),
  ('a0000000-0000-0000-0000-000000000017', array['vegan'],      array['nuts'],   true,  'allergy',     'Severe peanut allergy — no peanut oil in any kitchen.'),
  ('a0000000-0000-0000-0000-000000000027', array['gluten_free'],array[]::text[],false, 'intolerance', 'Coeliac diagnosed 2019.'),
  ('a0000000-0000-0000-0000-000000000044', array['vegetarian'],array['dairy'],  true,  'preference',  'Avoiding dairy for the duration of the event.'),
  ('a0000000-0000-0000-0000-000000000046', array['halal'],      array[]::text[],false, 'preference',  null)
on conflict (user_id) do nothing;

insert into public.emergency_contacts (user_id, full_name, relationship, phone_primary, phone_secondary, email, notes)
values
  ('a0000000-0000-0000-0000-000000000010', 'Anakin Skywalker',  'father',   '+1 415 555 0101', null, 'anakin.skywalker@kizuna.dev', null),
  ('a0000000-0000-0000-0000-000000000020', 'Petunia Dursley',   'aunt',     '+44 20 7946 0102', null, null, 'Reach via post if unreachable by phone.'),
  ('a0000000-0000-0000-0000-000000000030', 'Lee Adama',         'son',      '+1 206 555 0130', null, null, null),
  ('a0000000-0000-0000-0000-000000000040', 'Marge Simpson',     'spouse',   '+1 217 555 0140', null, 'marge.simpson@kizuna.dev', null)
on conflict (user_id) do nothing;


-- =====================================================================
-- Guest invitations + a confirmed guest
-- =====================================================================

insert into public.guest_invitations (sponsor_id, guest_email, signed_token, status, expires_at)
values
  ('a0000000-0000-0000-0000-000000000010', 'mara.jade@example.com',     'sample-token-luke',     'pending', now() + interval '6 days'),
  ('a0000000-0000-0000-0000-000000000020', 'ginny.weasley.guest@example.com', 'sample-token-harry',     'pending', now() + interval '4 days'),
  ('a0000000-0000-0000-0000-000000000040', 'maggie.simpson@example.com','sample-token-homer',    'accepted', now() + interval '2 days')
on conflict do nothing;

commit;

-- Apply with:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f supabase/fixtures/sample_employees.sql
