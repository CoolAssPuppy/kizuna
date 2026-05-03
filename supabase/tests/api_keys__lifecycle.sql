set search_path to public, tap, extensions;
-- create_api_key returns the cleartext token exactly once; only its
-- SHA-256 hash is persisted. verify_api_key matches by hash and
-- bumps last_used_at. revoke_api_key flips revoked_at without
-- removing the row (so audit trails survive).

begin;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000003100', 'lifecycle@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-000000003100', 'lifecycle@example.com', 'employee', 'h_lifecycle', 'sso');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003100","role":"authenticated","app_role":"employee","aud":"authenticated"}';

-- Create a token and capture both id + cleartext.
create temp table issued (id uuid, token text) on commit drop;
insert into issued
  select * from public.create_api_key('test key', 'read'::public.api_key_scope, null);
-- Temp tables are role-scoped; verify_api_key runs under service_role
-- below and needs to read this table.
grant all on issued to service_role;

select is(
  (select count(*)::int from issued),
  1,
  'create_api_key returned exactly one row'
);

-- pgTAP doesn't ship a `like` test; use `is` against the LIKE operator.
select is(
  (select token like 'kzn_read_%' from issued),
  true,
  'returned token uses the kzn_<scope>_ prefix'
);

select is(
  (select token_last4 from public.api_keys where id = (select id from issued)),
  (select right(token, 4) from issued),
  'token_last4 matches the last 4 of the cleartext'
);

-- verify_api_key is service-role only (the cli edge function calls it
-- with the service-role key). Switch roles for the verify probes; the
-- revoke step stays as the authenticated owner. Each role switch needs
-- a search_path that still includes `tap` so the pgTAP `is()` function
-- resolves — the SET role swap pulls from per-role defaults otherwise.
set local role service_role;
set local search_path to public, tap, extensions;
set local request.jwt.claims to '{"role":"service_role"}';
select is(
  (
    select count(*)::int
    from public.verify_api_key((select token from issued), null)
  ),
  1,
  'verify_api_key resolves a valid PAT'
);

select is(
  (select last_used_at is not null from public.api_keys where id = (select id from issued)),
  true,
  'verify_api_key stamps last_used_at'
);

set local role authenticated;
set local search_path to public, tap, extensions;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003100","role":"authenticated","app_role":"employee","aud":"authenticated"}';
-- Revoke flips revoked_at and verify now returns zero rows. `perform`
-- is PL/pgSQL-only, so call via `select` at the top level instead.
select public.revoke_api_key((select id from issued));

set local role service_role;
set local search_path to public, tap, extensions;
set local request.jwt.claims to '{"role":"service_role"}';
select is(
  (
    select count(*)::int
    from public.verify_api_key((select token from issued), null)
  ),
  0,
  'verify_api_key rejects revoked PATs'
);

select * from finish();
rollback;
