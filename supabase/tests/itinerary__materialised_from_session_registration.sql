set search_path to public, tap, extensions;
-- session_registrations insert produces an itinerary_items row.
begin;
select plan(3);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000030', 'attendee@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000030', 'attendee@example.com', 'employee', 'hibob_at', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active)
values ('00000000-0000-0000-0000-0000000000e2', 'Itin Event', 'supafest', current_date, current_date + 1, false);

insert into public.sessions (id, event_id, title, type, audience, starts_at, ends_at, location)
values ('00000000-0000-0000-0000-000000000051',
        '00000000-0000-0000-0000-0000000000e2',
        'Welcome dinner', 'dinner', 'all',
        '2027-04-01 18:00:00+00', '2027-04-01 21:00:00+00',
        'Main hall');

-- Act: register
insert into public.session_registrations (session_id, user_id, status)
values ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000030', 'registered');

select is(
  (select count(*)::int from public.itinerary_items
   where user_id = '00000000-0000-0000-0000-000000000030' and item_type = 'session'),
  1,
  'session registration creates one itinerary item'
);

select is(
  (select title from public.itinerary_items
   where user_id = '00000000-0000-0000-0000-000000000030' and item_type = 'session'),
  'Welcome dinner',
  'itinerary item title matches session title'
);

-- Cleanup: deletion clears the materialised row
delete from public.session_registrations
where session_id = '00000000-0000-0000-0000-000000000051' and user_id = '00000000-0000-0000-0000-000000000030';

select is(
  (select count(*)::int from public.itinerary_items
   where user_id = '00000000-0000-0000-0000-000000000030' and item_type = 'session'),
  0,
  'unregistering removes the itinerary item'
);

select * from finish();
rollback;
