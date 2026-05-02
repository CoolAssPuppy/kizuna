set search_path to public, tap, extensions;

begin;
select plan(3);

insert into auth.users (id, email, aud, role)
values
  ('10000000-0000-0000-0000-000000000001', 'reader@example.com', 'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-000000000002', 'outsider@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider)
values
  ('10000000-0000-0000-0000-000000000001', 'reader@example.com', 'employee', 'hibob_reader', 'sso'),
  ('10000000-0000-0000-0000-000000000002', 'outsider@example.com', 'employee', 'hibob_outsider', 'sso');

insert into public.events (id, name, type, start_date, end_date, is_active)
values
  ('10000000-0000-0000-0000-00000000e001', 'Event One', 'supafest', current_date, current_date + 2, false),
  ('10000000-0000-0000-0000-00000000e002', 'Event Two', 'supafest', current_date, current_date + 2, false);

insert into public.registrations (user_id, event_id, status)
values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000e001', 'started');

insert into public.documents (id, event_id, document_key, version, title, content_type, body, applies_to, is_active)
values
  ('10000000-0000-0000-0000-00000000d001', '10000000-0000-0000-0000-00000000e001', 'waiver', 1, 'Scoped doc', 'markdown', 'hello', 'all', true),
  ('10000000-0000-0000-0000-00000000d002', '10000000-0000-0000-0000-00000000e002', 'code_of_conduct', 1, 'Other event doc', 'markdown', 'nope', 'all', true),
  ('10000000-0000-0000-0000-00000000d003', null, 'expense_policy', 1, 'Global doc', 'markdown', 'global', 'all', true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_role":"employee","aud":"authenticated"}';

select is((select count(*)::int from public.documents), 2, 'registered user sees event-scoped + global docs only');
select ok(exists(select 1 from public.documents where id = '10000000-0000-0000-0000-00000000d001'), 'registered user sees own-event doc');
select ok(not exists(select 1 from public.documents where id = '10000000-0000-0000-0000-00000000d002'), 'registered user cannot see other-event doc');

select * from finish();
rollback;
