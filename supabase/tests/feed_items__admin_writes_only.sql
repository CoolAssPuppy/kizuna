set search_path to public, tap, extensions;
-- Admins manage the editorial home feed; authenticated users see only
-- items inside their display window. The display window check is
-- evaluated from the JWT-bearing role, not the admin override.
begin;
select plan(5);

insert into public.events (id, name, type, location, start_date, end_date, time_zone, is_active, invite_all_employees) values
  ('00000000-0000-0000-0000-feed00000001', 'Feed RLS Event', 'team_offsite', 'Banff', '2027-01-10', '2027-01-12', 'America/Edmonton', false, true);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-feed00000010', 'admin@feed.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-feed00000011', 'employee@feed.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-feed00000010', 'admin@feed.test',    'admin',    'h_feed_admin', null, 'sso'),
  ('00000000-0000-0000-0000-feed00000011', 'employee@feed.test', 'employee', 'h_feed_emp',   null, 'sso');

-- Admin-write: insert a future and a current item.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-feed00000010","role":"authenticated","app_role":"admin","aud":"authenticated"}';

select lives_ok(
  $$insert into public.feed_items (id, event_id, location, position, title, starts_displaying_at, ends_displaying_at)
    values
      ('00000000-0000-0000-0000-feed00001001', '00000000-0000-0000-0000-feed00000001', 'main', 1, 'Live now',     now() - interval '1 hour', now() + interval '1 hour'),
      ('00000000-0000-0000-0000-feed00001002', '00000000-0000-0000-0000-feed00000001', 'main', 2, 'Future',       now() + interval '7 days', now() + interval '14 days'),
      ('00000000-0000-0000-0000-feed00001003', '00000000-0000-0000-0000-feed00000001', 'main', 3, 'Always show',  null,                       null)$$,
  'admin can insert feed items'
);

-- Non-admin (employee) write blocked.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-feed00000011","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select throws_ok(
  $$insert into public.feed_items (event_id, location, position, title)
    values ('00000000-0000-0000-0000-feed00000001', 'main', 99, 'Imposter')$$,
  '42501',
  null,
  'employee cannot insert feed items'
);

-- Employee read sees the live item and the always-show item, NOT the
-- future one.
select is(
  (select count(*)::int from public.feed_items where event_id = '00000000-0000-0000-0000-feed00000001'),
  2,
  'employee sees only items inside display window (live + always-show)'
);

-- Admin sees all three, including the future item.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-feed00000010","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  (select count(*)::int from public.feed_items where event_id = '00000000-0000-0000-0000-feed00000001'),
  3,
  'admin sees every feed item including future-window'
);

-- Employee delete blocked.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-feed00000011","role":"authenticated","app_role":"employee","aud":"authenticated"}';
delete from public.feed_items where event_id = '00000000-0000-0000-0000-feed00000001';
select is(
  (select count(*)::int from public.feed_items where event_id = '00000000-0000-0000-0000-feed00000001'),
  -- The DELETE silently affects 0 rows — RLS hides every row from the
  -- USING clause perspective. Switching back to admin should still see
  -- the same 3 inserted above.
  2,
  'employee delete is a no-op against feed_items'
);

select * from finish();
rollback;
