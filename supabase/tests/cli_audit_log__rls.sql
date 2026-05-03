set search_path to public, tap, extensions;
-- cli_audit_log is admin-readable only; attendees never see audit
-- entries. The write_cli_audit_log function is SECURITY DEFINER so
-- the edge function (running with the service role) can append rows.

begin;
select plan(4);

select is(
  (select relrowsecurity from pg_class where oid = 'public.cli_audit_log'::regclass),
  true,
  'RLS is enabled on cli_audit_log'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.cli_audit_log'::regclass),
  true,
  'RLS is forced on cli_audit_log'
);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000003300', 'audit-admin@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000003301', 'audit-user@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-000000003300', 'audit-admin@example.com', 'admin',    'h_audit_admin', 'sso'),
  ('00000000-0000-0000-0000-000000003301', 'audit-user@example.com',  'employee', 'h_audit_user',  'sso');

-- write_cli_audit_log is callable as service role. From a regular
-- authenticated session we go through it directly because it's
-- SECURITY DEFINER.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003301","role":"authenticated","app_role":"employee","aud":"authenticated"}';

-- `perform` is PL/pgSQL-only; from the top level we use `select` and
-- discard the void return.
select public.write_cli_audit_log(
  '00000000-0000-0000-0000-000000003301',
  null,
  'req-1',
  'me itinerary',
  'read'::public.api_key_scope,
  'error',
  'forbidden',
  42
);

-- Attendee cannot read the audit log.
select is(
  (select count(*)::int from public.cli_audit_log),
  0,
  'an attendee cannot read cli_audit_log'
);

-- Admin can read all rows.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003300","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  (select count(*)::int from public.cli_audit_log where command = 'me itinerary'),
  1,
  'admin reads cli_audit_log entries'
);

select * from finish();
rollback;
