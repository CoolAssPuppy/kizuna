set search_path to public, tap, extensions;
-- Coverage: set_swag_selections happy path, opt-out shape, lock blocks
-- writes, lock_swag is admin-only, sibling-event guard.
--
-- Uses an isolated test event with hard-coded ids so the assertions
-- don't mingle with the fixture catalogue and so the cross-event guard
-- can reference the outsider item without tripping on RLS at SELECT
-- time.
begin;
select plan(8);

-- Test event (separate from the seeded supafest event so its swag
-- catalogue is empty until this test populates it).
insert into public.events (id, name, type, start_date, end_date, time_zone, location, is_active)
values ('00000000-0000-0000-0000-000000000e1d', 'pgTAP Swag Event', 'company_offsite',
        current_date, current_date + 5, 'UTC', 'pgtap', false);

-- Outsider event for the cross-event guard test.
insert into public.events (id, name, type, start_date, end_date, time_zone, location, is_active)
values ('00000000-0000-0000-0000-000000000ee2', 'pgTAP Outsider Event', 'company_offsite',
        current_date, current_date + 1, 'UTC', 'pgtap', false);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000005a6', 'pgtap.swag@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-0000000005a6', 'pgtap.swag@example.com', 'employee', 'hibob_swag_pgtap', 'sso');

-- Registration row + the swag task so the auto-tick branch has somewhere to land.
insert into public.registrations (id, user_id, event_id, status)
values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-0000000005a6',
        '00000000-0000-0000-0000-000000000e1d', 'started');

insert into public.registration_tasks (registration_id, task_key, applies_to, status)
values ('00000000-0000-0000-0000-00000000ee01', 'swag', 'all', 'pending');

-- Two visible items in the test event.
insert into public.swag_items (id, event_id, name, sizes, allows_opt_out)
values
  ('00000000-0000-0000-0000-000000005ee1', '00000000-0000-0000-0000-000000000e1d', 'pgTAP Tee', array['S','M','L'], true),
  ('00000000-0000-0000-0000-000000005ee2', '00000000-0000-0000-0000-000000000e1d', 'pgTAP Hoodie', array['S','M','L'], false);

-- One item in the outsider event for the cross-event guard.
insert into public.swag_items (id, event_id, name, sizes, allows_opt_out)
values ('00000000-0000-0000-0000-00000000505d', '00000000-0000-0000-0000-000000000ee2', 'Outsider', array['S'], true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005a6","role":"authenticated","app_role":"employee","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000005a6';

-- ---------------------------------------------------------------------
-- Happy path: yes-size on both items
-- ---------------------------------------------------------------------
select public.set_swag_selections(
  '00000000-0000-0000-0000-000000000e1d'::uuid,
  jsonb_build_array(
    jsonb_build_object('swag_item_id', '00000000-0000-0000-0000-000000005ee1', 'size', 'M', 'opted_out', false),
    jsonb_build_object('swag_item_id', '00000000-0000-0000-0000-000000005ee2', 'size', 'L', 'opted_out', false)
  )
);

select is(
  (select count(*)::int from public.swag_selections where user_id = '00000000-0000-0000-0000-0000000005a6'),
  2,
  'set_swag_selections persists one row per item'
);

select is(
  (select rt.status::text from public.registration_tasks rt
   where rt.registration_id = '00000000-0000-0000-0000-00000000ee01' and rt.task_key = 'swag'),
  'complete',
  'swag task auto-completes once every visible item is answered'
);

-- Opt-out flips size to null and the flag.
select public.set_swag_selections(
  '00000000-0000-0000-0000-000000000e1d'::uuid,
  jsonb_build_array(
    jsonb_build_object('swag_item_id', '00000000-0000-0000-0000-000000005ee1', 'size', null, 'opted_out', true)
  )
);

select is(
  (select size from public.swag_selections
   where user_id = '00000000-0000-0000-0000-0000000005a6'
     and swag_item_id = '00000000-0000-0000-0000-000000005ee1'),
  null::text,
  'opt-out clears the saved size'
);

select is(
  (select opted_out from public.swag_selections
   where user_id = '00000000-0000-0000-0000-0000000005a6'
     and swag_item_id = '00000000-0000-0000-0000-000000005ee1'),
  true,
  'opt-out flips the opted_out flag'
);

-- ---------------------------------------------------------------------
-- Cross-event guard: payload referencing an item from another event
-- raises rather than silently storing the row in the wrong event.
-- The item id is hard-coded above, so the assertion does not depend on
-- the caller being able to SELECT it through RLS.
-- ---------------------------------------------------------------------
prepare cross_event as
  select public.set_swag_selections(
    '00000000-0000-0000-0000-000000000e1d'::uuid,
    jsonb_build_array(
      jsonb_build_object('swag_item_id', '00000000-0000-0000-0000-00000000505d', 'size', 'S', 'opted_out', false)
    )
  );
select throws_ok('execute cross_event', null, null, 'cross-event item triggers an exception');
deallocate cross_event;

-- ---------------------------------------------------------------------
-- Lock: admin RPC sets swag_locked_at; subsequent attendee write fails.
-- ---------------------------------------------------------------------
reset role;
update public.users set role = 'admin' where id = '00000000-0000-0000-0000-0000000005a6';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000005a6","role":"authenticated","app_role":"admin","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000005a6';

select public.set_swag_lock('00000000-0000-0000-0000-000000000e1d'::uuid, true);

select isnt(
  (select swag_locked_at from public.events where id = '00000000-0000-0000-0000-000000000e1d'),
  null::timestamptz,
  'lock_swag stamps swag_locked_at'
);

select is(
  (select swag_locked_by from public.events where id = '00000000-0000-0000-0000-000000000e1d'),
  '00000000-0000-0000-0000-0000000005a6'::uuid,
  'lock_swag stamps swag_locked_by with the caller'
);

prepare write_after_lock as
  select public.set_swag_selections(
    '00000000-0000-0000-0000-000000000e1d'::uuid,
    jsonb_build_array(
      jsonb_build_object('swag_item_id', '00000000-0000-0000-0000-000000005ee1', 'size', 'M', 'opted_out', false)
    )
  );
select throws_ok('execute write_after_lock', null, null, 'writes after lock raise');
deallocate write_after_lock;

select * from finish();
rollback;
