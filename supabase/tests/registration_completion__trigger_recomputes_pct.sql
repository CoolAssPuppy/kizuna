set search_path to public, tap, extensions;
-- update_registration_completion trigger keeps registrations.completion_pct
-- in sync with the registration_tasks rows.
begin;
select plan(4);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000010', 'eve@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider)
values ('00000000-0000-0000-0000-000000000010', 'eve@example.com', 'employee', 'hibob_eve', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active)
values ('00000000-0000-0000-0000-0000000000e1', 'Test', 'company_offsite', current_date, current_date + 1, false);

insert into public.registrations (id, user_id, event_id, status)
values ('00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-0000000000e1',
        'invited');

-- Insert four tasks, all pending. completion_pct should be 0.
insert into public.registration_tasks (registration_id, task_key, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'personal_info', 'pending'),
  ('00000000-0000-0000-0000-0000000000a1', 'passport',      'pending'),
  ('00000000-0000-0000-0000-0000000000a1', 'dietary',       'pending'),
  ('00000000-0000-0000-0000-0000000000a1', 'documents',     'pending');

select is(
  (select completion_pct from public.registrations where id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'four pending tasks -> 0%'
);

-- Complete one. Should be 25.
update public.registration_tasks set status = 'complete', completed_at = now()
where registration_id = '00000000-0000-0000-0000-0000000000a1' and task_key = 'personal_info';

select is(
  (select completion_pct from public.registrations where id = '00000000-0000-0000-0000-0000000000a1'),
  25,
  'one of four complete -> 25%'
);

-- Skip one. Should now be 1 of 3 = 33.
update public.registration_tasks set status = 'skipped'
where registration_id = '00000000-0000-0000-0000-0000000000a1' and task_key = 'documents';

select is(
  (select completion_pct from public.registrations where id = '00000000-0000-0000-0000-0000000000a1'),
  33,
  'one complete out of three (skipped excluded) -> 33%'
);

-- Complete remaining two. Should be 100, status complete.
update public.registration_tasks set status = 'complete', completed_at = now()
where registration_id = '00000000-0000-0000-0000-0000000000a1' and task_key in ('passport', 'dietary');

select is(
  (select status::text || '|' || completion_pct::text from public.registrations
   where id = '00000000-0000-0000-0000-0000000000a1'),
  'complete|100',
  'all non-skipped complete -> 100% and status=complete'
);

select * from finish();
rollback;
