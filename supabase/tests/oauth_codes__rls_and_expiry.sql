set search_path to public, tap, extensions;
-- oauth_codes is the OAuth bootstrap intermediate. Codes live for 60s
-- and are consumed-once by exchange_oauth_code. Direct client access
-- is forbidden; the table is reachable only through SECURITY DEFINER
-- helpers.

begin;
select plan(5);

select is(
  (select relrowsecurity from pg_class where oid = 'public.oauth_codes'::regclass),
  true,
  'RLS is enabled on oauth_codes'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.oauth_codes'::regclass),
  true,
  'RLS is forced on oauth_codes'
);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000003200', 'oauth@example.com', 'authenticated', 'authenticated');
insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-000000003200', 'oauth@example.com', 'employee', 'h_oauth', 'sso');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003200","role":"authenticated","app_role":"employee","aud":"authenticated"}';

-- Mint a code via the SECURITY DEFINER helper.
create temp table minted (code text) on commit drop;
insert into minted
  select public.mint_oauth_code(
    'read'::public.api_key_scope,
    'state-1',
    'http://127.0.0.1:50000/callback'
  );

-- Direct SELECT is denied — the policy is `for all using (false)`.
select is(
  (select count(*)::int from public.oauth_codes),
  0,
  'authenticated clients cannot read oauth_codes directly'
);

-- exchange_oauth_code returns a fresh PAT and marks the code consumed.
create temp table exchanged (id uuid, token text) on commit drop;
insert into exchanged
  select * from public.exchange_oauth_code(
    (select code from minted),
    'state-1'
  );

select is(
  (select count(*)::int from exchanged),
  1,
  'exchange_oauth_code returns the freshly minted PAT'
);

-- Replaying the same code is rejected.
select throws_ok(
  $$ select * from public.exchange_oauth_code((select code from minted), 'state-1') $$,
  'invalid_oauth_code',
  'a consumed oauth_code cannot be replayed'
);

select * from finish();
rollback;
