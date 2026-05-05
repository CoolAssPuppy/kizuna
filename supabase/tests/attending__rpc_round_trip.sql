set search_path to public, tap, extensions;
-- set_attending: covers yes-first-time, opt-out, and flip-back semantics.
-- Asserts directly against registrations + registration_tasks so the
-- "cancelled status survives the completion trigger" guarantee is locked
-- in alongside the more obvious task-status flips.
begin;
select plan(8);

-- Active event needed for current_active_event_id() inside set_attending.
do $$
declare
  v_event_id uuid;
begin
  if not exists (select 1 from public.events where is_active = true and type = 'supafest') then
    insert into public.events (id, name, type, start_date, end_date, starts_tz, ends_tz, location, is_active)
    values (gen_random_uuid(), 'pgTAP Attending Test', 'supafest', current_date, current_date + 5,
            'UTC', 'UTC', 'pgtap', true);
  end if;
end
$$;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a77e', 'pgtap.attending@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-00000000a77e', 'pgtap.attending@example.com', 'employee', 'hibob_attending', 'sso');

-- Pre-seed the registration row + every task so the test mirrors the
-- real wizard (where ensureRegistration runs before set_attending). The
-- completion trigger reads the full task list to derive status, so
-- without sibling 'pending' tasks it would flip status to 'complete'
-- the moment 'attending' is the only thing on the table.
insert into public.registrations (user_id, event_id, status)
select '00000000-0000-0000-0000-00000000a77e', e.id, 'invited'
from public.events e where e.is_active = true and e.type = 'supafest' limit 1
on conflict (user_id, event_id) do nothing;

insert into public.registration_tasks (registration_id, task_key, applies_to, status)
select r.id, k.task_key, 'all'::task_audience, 'pending'
from public.registrations r,
     unnest(array[
       'attending','personal_info','passport','emergency_contact',
       'dietary','accessibility','swag','transport','documents'
     ]::registration_task_key[]) as k(task_key)
where r.user_id = '00000000-0000-0000-0000-00000000a77e'
on conflict do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a77e","role":"authenticated","app_role":"employee","aud":"authenticated"}';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000a77e';

-- ---------------------------------------------------------------------
-- Yes attending, first-time
-- ---------------------------------------------------------------------
select public.set_attending(true, true);

select is(
  (select status::text from public.registrations
   where user_id = '00000000-0000-0000-0000-00000000a77e'),
  'started',
  'yes-attending leaves registration status non-cancelled'
);

select is(
  (select is_first_time_attendee from public.registrations
   where user_id = '00000000-0000-0000-0000-00000000a77e'),
  true,
  'first-time answer persists onto the registration row'
);

select is(
  (select rt.status::text from public.registration_tasks rt
   join public.registrations r on r.id = rt.registration_id
   where r.user_id = '00000000-0000-0000-0000-00000000a77e' and rt.task_key = 'attending'),
  'complete',
  'yes-attending ticks the attending task complete'
);

-- ---------------------------------------------------------------------
-- Flip to no
-- ---------------------------------------------------------------------
select public.set_attending(false, false);

select is(
  (select status::text from public.registrations
   where user_id = '00000000-0000-0000-0000-00000000a77e'),
  'cancelled',
  'no-attending flips registration status to cancelled'
);

select is(
  (select is_first_time_attendee from public.registrations
   where user_id = '00000000-0000-0000-0000-00000000a77e'),
  false,
  'no-attending resets is_first_time_attendee to false'
);

select is(
  (select count(*)::int from public.registration_tasks rt
   join public.registrations r on r.id = rt.registration_id
   where r.user_id = '00000000-0000-0000-0000-00000000a77e'
     and rt.task_key <> 'attending'
     and rt.status = 'skipped'),
  8,
  'no-attending skips every sibling task'
);

-- ---------------------------------------------------------------------
-- Flip back to yes
-- ---------------------------------------------------------------------
select public.set_attending(true, false);

select is(
  (select status::text from public.registrations
   where user_id = '00000000-0000-0000-0000-00000000a77e'),
  'started',
  'flip back to yes restores status from cancelled'
);

select is(
  (select count(*)::int from public.registration_tasks rt
   join public.registrations r on r.id = rt.registration_id
   where r.user_id = '00000000-0000-0000-0000-00000000a77e'
     and rt.task_key <> 'attending'
     and rt.status = 'pending'),
  8,
  'flip back to yes re-opens previously-skipped sibling tasks'
);

select * from finish();
rollback;
