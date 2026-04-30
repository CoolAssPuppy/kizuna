set search_path to public, tap, extensions;
-- itinerary_items rejects a duplicate row for the same (user, item_type, source_id).
-- Regression test for a pre-fix bug where on conflict do nothing silently
-- failed because no unique constraint existed.
begin;
select plan(2);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000060', 'dup@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000060', 'dup@example.com', 'employee', 'hibob_dup', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active)
values ('00000000-0000-0000-0000-0000000000d1', 'Dup Event', 'supafest', current_date, current_date + 1, false);

-- Insert a base itinerary item directly.
insert into public.itinerary_items (
  user_id, event_id, item_type, source, source_id, title, starts_at
) values (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-0000000000d1',
  'session', 'self_registered',
  '00000000-0000-0000-0000-0000000000a1',
  'First',
  '2027-04-01 10:00:00+00'
);

-- Inserting a second row with same (user, item_type, source_id) is rejected.
select throws_ok(
  $$insert into public.itinerary_items (
      user_id, event_id, item_type, source, source_id, title, starts_at
    ) values (
      '00000000-0000-0000-0000-000000000060',
      '00000000-0000-0000-0000-0000000000d1',
      'session', 'self_registered',
      '00000000-0000-0000-0000-0000000000a1',
      'Second',
      '2027-04-01 11:00:00+00'
    )$$,
  '23505',
  null,
  'duplicate (user_id, item_type, source_id) is rejected'
);

-- Two rows with different source_id coexist.
insert into public.itinerary_items (
  user_id, event_id, item_type, source, source_id, title, starts_at
) values (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-0000000000d1',
  'session', 'self_registered',
  '00000000-0000-0000-0000-0000000000a2',
  'Other session',
  '2027-04-01 12:00:00+00'
);

select is(
  (select count(*)::int from public.itinerary_items
   where user_id = '00000000-0000-0000-0000-000000000060'),
  2,
  'two distinct (user, source_id) rows coexist'
);

select * from finish();
rollback;
