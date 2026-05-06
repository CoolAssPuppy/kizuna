set search_path to public, tap, extensions;
-- session_tags is the per-event tag palette. Anyone authenticated reads
-- (so the agenda can render pills); only admins create / rename / reorder.
begin;
select plan(5);

insert into public.events (id, name, type, location, start_date, end_date, time_zone, invite_all_employees) values
  ('00000000-0000-0000-0000-7a657a657a01', 'Tags RLS', 'team_offsite', 'Banff', '2027-01-10', '2027-01-12', 'America/Edmonton', true);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-7a657a657a10', 'admin@tags.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-7a657a657a11', 'employee@tags.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-7a657a657a10', 'admin@tags.test',    'admin',    'h_tags_admin', null, 'sso'),
  ('00000000-0000-0000-0000-7a657a657a11', 'employee@tags.test', 'employee', 'h_tags_emp',   null, 'sso');

set local role authenticated;

-- Admin inserts a tag.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-7a657a657a10","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.session_tags (id, event_id, name, color, position)
    values ('00000000-0000-0000-0000-7a657a651001',
            '00000000-0000-0000-0000-7a657a657a01',
            'PgTAP RLS Tag', '#0ea5e9', 1)$$,
  'admin can create a session tag'
);

-- Admin can rename.
update public.session_tags
   set name = 'PgTAP RLS Renamed', color = '#22d3ee'
 where id = '00000000-0000-0000-0000-7a657a651001';
select is(
  (select name from public.session_tags where id = '00000000-0000-0000-0000-7a657a651001'),
  'PgTAP RLS Renamed',
  'admin can rename a session tag'
);

-- Employee can READ the tag (for rendering pills) but cannot write.
-- ensure_default_session_tags() seeds a starter palette per event, so
-- there's a baseline already present; the assertion here checks that
-- our admin-created tag is among the visible rows.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-7a657a657a11","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.session_tags
     where event_id = '00000000-0000-0000-0000-7a657a657a01'
       and id = '00000000-0000-0000-0000-7a657a651001'),
  1,
  'employee can read the admin-created session tag'
);

select throws_ok(
  $$insert into public.session_tags (event_id, name)
    values ('00000000-0000-0000-0000-7a657a657a01', 'Sneaky')$$,
  '42501',
  null,
  'employee cannot insert a session tag'
);

-- Employee delete blocked (silently 0-rows-affected).
delete from public.session_tags where id = '00000000-0000-0000-0000-7a657a651001';
select is(
  (select count(*)::int from public.session_tags where id = '00000000-0000-0000-0000-7a657a651001'),
  1,
  'employee delete is rejected by RLS'
);

select * from finish();
rollback;
