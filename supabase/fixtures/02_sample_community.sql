-- Community fixtures: attendee profiles + a few user-created channels.
--
-- Builds on top of supabase/fixtures/sample_employees.sql so the user IDs
-- below correspond to seeded employees. Idempotent: re-running is safe.

begin;

-- =====================================================================
-- attendee_profiles — bios, hobbies, hometowns, current cities
-- =====================================================================
insert into public.attendee_profiles (
  user_id, bio, hobbies, fun_fact,
  hometown_city, hometown_country, current_city, current_country, visibility
) values
  -- Picard: born in France, lives in San Francisco (Earth HQ).
  ('a0000000-0000-0000-0000-000000000001',
   'Captain who plays the Ressikan flute and prefers Earl Grey, hot.',
   array['skiing','reading','wine']::text[],
   'I once played first chair in a Klingon opera.',
   'Paris','FR','San Francisco','US','attendees_only'),
  -- Janeway: born Bloomington, lives in New York.
  ('a0000000-0000-0000-0000-000000000002',
   'Captain by trade, scientist by curiosity, perpetual coffee fiend.',
   array['coffee','reading','running']::text[],
   'Held the Delta-quadrant record for fastest cup of coffee.',
   'Bloomington','US','New York','US','attendees_only'),
  -- Luke: Tatooine roots, now in San Francisco.
  ('a0000000-0000-0000-0000-000000000010',
   'Storage engineer with a moisture-farm upbringing.',
   array['skiing','snowboarding','photography','retro-gaming']::text[],
   'Trained with a Jedi master who lived in a swamp.',
   'Albuquerque','US','San Francisco','US','attendees_only'),
  -- Leia: Alderaan-born, now lives in New York.
  ('a0000000-0000-0000-0000-000000000011',
   'EM at heart, diplomat by training, mom by choice.',
   array['hiking','reading','travel']::text[],
   'Princess. It is on the resume.',
   'New York','US','New York','US','attendees_only'),
  -- Han: Corellia → Austin.
  ('a0000000-0000-0000-0000-000000000012',
   'Realtime engineer. Kessel run optimizer.',
   array['photography','craft-beer','board-games']::text[],
   'I have a Wookiee best friend and we once made the Kessel run in 12 parsecs.',
   'Las Vegas','US','Austin','US','attendees_only'),
  -- Rey: Jakku → London.
  ('a0000000-0000-0000-0000-000000000013',
   'Edge functions enjoyer, scavenger by nature.',
   array['hiking','running','photography']::text[],
   'Nobody knew my last name until two years ago.',
   'Manchester','GB','London','GB','attendees_only'),
  -- Obi-Wan: Stewjon → Edinburgh, retired hermit.
  ('a0000000-0000-0000-0000-000000000016',
   'Auth team. High ground specialist.',
   array['hiking','reading','coffee','chess']::text[],
   'I once watched the Republic transform into the Empire while sipping tea.',
   'London','GB','Edinburgh','GB','attendees_only'),
  -- Harry: Surrey → SF.
  ('a0000000-0000-0000-0000-000000000020',
   'DevRel, very into broomsticks and warm butterbeer.',
   array['photography','running','board-games','open-source']::text[],
   'Survived a basilisk bite at age twelve.',
   'Edinburgh','GB','San Francisco','US','attendees_only'),
  -- Hermione: Ealing → London.
  ('a0000000-0000-0000-0000-000000000021',
   'Head of Content. Bookworm. Strong feelings about apostrophes.',
   array['reading','writing','coffee','chess','baking']::text[],
   'I time-traveled through a third-year course schedule.',
   'Birmingham','GB','London','GB','attendees_only'),
  -- Hagrid: Forest of Dean → London (mostly).
  ('a0000000-0000-0000-0000-000000000027',
   'Head of Events. Bringer of large dogs.',
   array['camping','cooking','photography']::text[],
   'I keep a baby dragon in my hut. It is fine.',
   'Forest of Dean','GB','London','GB','attendees_only'),
  -- Adama: Caprica → Boston.
  ('a0000000-0000-0000-0000-000000000030',
   'VP Sales. Cigar enthusiast. Father of three.',
   array['whisky','sailing','running']::text[],
   'Helped lead a fleet across uncharted space.',
   'Chicago','US','Boston','US','attendees_only'),
  -- Homer: Springfield lifer.
  ('a0000000-0000-0000-0000-000000000040',
   'Director of Customer Support. Donut futurist.',
   array['video-games','coffee','baking']::text[],
   'I once worked at a nuclear plant and only caused three meltdowns.',
   'Springfield','US','Springfield','US','attendees_only'),
  -- Marge: Capital City → Springfield.
  ('a0000000-0000-0000-0000-000000000041',
   'Customer Support Manager. Wields a vacuum cleaner with surgical precision.',
   array['baking','cooking','reading']::text[],
   'My hair has its own gravitational field.',
   'Las Vegas','US','Springfield','US','attendees_only'),
  -- Lisa: Springfield → New York.
  ('a0000000-0000-0000-0000-000000000042',
   'Customer Success. Saxophone player. Vegetarian.',
   array['music-production','reading','running']::text[],
   'I once met a saxophonist named Bleeding Gums.',
   'Springfield','US','New York','US','attendees_only')
on conflict (user_id) do nothing;


-- =====================================================================
-- channels — a handful of user-created starter rooms
-- =====================================================================
insert into public.channels (slug, name, description, created_by, is_system) values
  ('ski-snowboard',     'Ski + snowboard',  'Powder updates, lift tickets, après-ski plans.',                'a0000000-0000-0000-0000-000000000010', false),
  ('coffee-and-life',   'Coffee + life',    'Cafés, beans, life updates over caffeine.',                    'a0000000-0000-0000-0000-000000000002', false),
  ('photo-walk',        'Photo walk',       'Banff is photogenic. Share a shot, plan a walk.',              'a0000000-0000-0000-0000-000000000020', false),
  ('engineering-banter','Engineering banter','Database memes, edge function tricks, postgres trivia.',     'a0000000-0000-0000-0000-000000000016', false),
  ('books',             'Books',            'What you''re reading, what you can''t put down.',              'a0000000-0000-0000-0000-000000000021', false)
on conflict (slug) do nothing;


-- =====================================================================
-- A few starter messages so the channel list looks alive in dev
-- =====================================================================
insert into public.messages (sender_id, channel, body) values
  ('a0000000-0000-0000-0000-000000000010', 'ski-snowboard',     'Lake Louise opens at 9. Anyone want to grab the gondola together?'),
  ('a0000000-0000-0000-0000-000000000011', 'ski-snowboard',     'I''m in. Bring an extra hand warmer.'),
  ('a0000000-0000-0000-0000-000000000002', 'coffee-and-life',   'Banff Roasting Co. is the move. They have flat whites.'),
  ('a0000000-0000-0000-0000-000000000020', 'photo-walk',        'Sunrise at Vermillion Lakes. Meet at the lobby 6:15.'),
  ('a0000000-0000-0000-0000-000000000016', 'engineering-banter','New theory: every postgres function should ship with **a haiku**.'),
  ('a0000000-0000-0000-0000-000000000021', 'books',             'Currently reading: _Project Hail Mary_. Would recommend.'),
  ('a0000000-0000-0000-0000-000000000001', 'general',            'Welcome to Banff. Make it so.')
on conflict do nothing;

commit;
