set search_path to public, tap, extensions;
-- hibob_sync_log is an admin-only audit trail of every sync run. Even
-- the user whose record was synced has no business reading the log.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-5bb05bb05b01', 'admin@sync.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-5bb05bb05b02', 'employee@sync.test', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, sponsor_id, auth_provider) values
  ('00000000-0000-0000-0000-5bb05bb05b01', 'admin@sync.test',    'admin',    'h_sync_admin', null, 'sso'),
  ('00000000-0000-0000-0000-5bb05bb05b02', 'employee@sync.test', 'employee', 'h_sync_emp',   null, 'sso');

set local role authenticated;

-- Admin write succeeds.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-5bb05bb05b01","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select lives_ok(
  $$insert into public.hibob_sync_log (id, status, records_processed, records_updated, records_skipped, conflicts_created)
    values ('00000000-0000-0000-0000-5bb05bb01001', 'success', 12, 8, 2, 1)$$,
  'admin can write a sync log row'
);

-- Admin read sees the row.
select is(
  (select count(*)::int from public.hibob_sync_log where id = '00000000-0000-0000-0000-5bb05bb01001'),
  1,
  'admin can read sync log rows'
);

-- Employee read sees nothing.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-5bb05bb05b02","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.hibob_sync_log),
  0,
  'employee cannot read hibob_sync_log'
);

-- Employee write blocked.
select throws_ok(
  $$insert into public.hibob_sync_log (status, records_processed)
    values ('success', 0)$$,
  '42501',
  null,
  'employee cannot write to hibob_sync_log'
);

select * from finish();
rollback;
