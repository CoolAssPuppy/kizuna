set search_path to public, tap, extensions;
-- swag_items is the per-event catalogue shown to attendees on the swag
-- registration step. Hidden items are admin-only. Visibility for
-- non-admins depends on the event's eligibility model (invite_all +
-- allowed_domains, or per-row event_invitations, or registrations).
-- Here we exercise the invite_all path with a domain match so we don't
-- have to seed a registrations row.
begin;
select plan(5);

insert into public.events
  (id, name, type, location, start_date, end_date, time_zone,
   invite_all_employees, allowed_domains)
values
  ('00000000-0000-0000-0000-a8a6a8a6a801', 'Swag RLS', 'team_offsite', 'Banff',
   '2027-01-10', '2027-01-12', 'America/Edmonton',
   true, ARRAY['swag.test']);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-a8a6a8a6a810', 'admin@swag.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-a8a6a8a6a811', 'employee@swag.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider, is_active) values
  ('00000000-0000-0000-0000-a8a6a8a6a810', 'admin@swag.test',    'admin',    'h_swag_admin', null, 'sso', true),
  ('00000000-0000-0000-0000-a8a6a8a6a811', 'employee@swag.test', 'employee', 'h_swag_emp',   null, 'sso', true);

set local role authenticated;

-- Admin inserts visible + hidden items.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-a8a6a8a6a810","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.swag_items (id, event_id, name, is_hidden, sizes, sort_order)
    values
      ('00000000-0000-0000-0000-a8a6a8a61001', '00000000-0000-0000-0000-a8a6a8a6a801', 'T-shirt',  false, ARRAY['S','M','L'], 1),
      ('00000000-0000-0000-0000-a8a6a8a61002', '00000000-0000-0000-0000-a8a6a8a6a801', 'Mug',      false, ARRAY['One size'],   2),
      ('00000000-0000-0000-0000-a8a6a8a61003', '00000000-0000-0000-0000-a8a6a8a6a801', 'Hoodie',   true,  ARRAY['S','M','L'], 3)$$,
  'admin can populate the swag catalogue including hidden items'
);

-- Admin sees all three.
select is(
  (select count(*)::int from public.swag_items where event_id = '00000000-0000-0000-0000-a8a6a8a6a801'),
  3,
  'admin sees every swag item including hidden ones'
);

-- Employee on an invite_all event sees only the non-hidden items.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-a8a6a8a6a811","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.swag_items where event_id = '00000000-0000-0000-0000-a8a6a8a6a801'),
  2,
  'employee sees only non-hidden items'
);

select is(
  (select count(*)::int from public.swag_items where event_id = '00000000-0000-0000-0000-a8a6a8a6a801' and is_hidden = true),
  0,
  'hidden items invisible to employees'
);

-- Employee write blocked.
select throws_ok(
  $$insert into public.swag_items (event_id, name)
    values ('00000000-0000-0000-0000-a8a6a8a6a801', 'Imposter mug')$$,
  '42501',
  null,
  'employee cannot insert swag items'
);

select * from finish();
rollback;
