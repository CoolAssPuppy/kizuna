set search_path to public, tap, extensions;
-- api_keys carries token hashes that grant programmatic access to a
-- user's Kizuna data. The RLS contract:
--   * RLS is enabled (and forced) so a future seed can never bypass.
--   * Self-read works.
--   * Other-user read returns zero rows.
--   * Admins do NOT have read access (intentional — same passport
--     pattern: even a super-admin shouldn't see another user's PAT
--     hashes).
--   * The only updatable column is `revoked_at`; the trigger blocks
--     anything else.
--   * oauth_codes is opaque to clients; the for-all DENY policy means
--     even self-read returns zero.

begin;
select plan(7);

-- RLS state.
select is(
  (select relrowsecurity from pg_class where oid = 'public.api_keys'::regclass),
  true,
  'RLS is enabled on api_keys'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.api_keys'::regclass),
  true,
  'RLS is forced on api_keys'
);

-- Seed two users plus a key for each.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000003000', 'pat-owner@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000003001', 'pat-other@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000003002', 'pat-admin@example.com', 'authenticated', 'authenticated');

insert into public.users (id, email, role, hibob_id, auth_provider) values
  ('00000000-0000-0000-0000-000000003000', 'pat-owner@example.com', 'employee',    'h_pat_owner', 'sso'),
  ('00000000-0000-0000-0000-000000003001', 'pat-other@example.com', 'employee',    'h_pat_other', 'sso'),
  ('00000000-0000-0000-0000-000000003002', 'pat-admin@example.com', 'admin',       'h_pat_admin', 'sso');

insert into public.api_keys (user_id, name, scope, token_hash, token_last4)
values
  ('00000000-0000-0000-0000-000000003000', 'owner key', 'read',  'hash-owner', 'aaaa'),
  ('00000000-0000-0000-0000-000000003001', 'other key', 'write', 'hash-other', 'bbbb');

-- Owner reads their own row.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003000","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select is(
  (select count(*)::int from public.api_keys where user_id = '00000000-0000-0000-0000-000000003000'),
  1,
  'the owner can read their own api_keys row'
);

-- Owner cannot see anyone else's row.
select is(
  (select count(*)::int from public.api_keys where user_id = '00000000-0000-0000-0000-000000003001'),
  0,
  'the owner cannot read another user''s api_keys row'
);

-- Admin sees zero rows for the other users (no admin policy by design).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003002","role":"authenticated","app_role":"admin","aud":"authenticated"}';
select is(
  (select count(*)::int from public.api_keys where user_id <> '00000000-0000-0000-0000-000000003002'),
  0,
  'an admin cannot read other users'' api_keys rows'
);

-- Non-revoked-update is rejected by guard_api_key_update.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000003000","role":"authenticated","app_role":"employee","aud":"authenticated"}';
select throws_ok(
  $$ update public.api_keys set name = 'renamed' where user_id = '00000000-0000-0000-0000-000000003000' $$,
  'api_keys_only_revoked_at_is_user_updatable',
  'the only updatable column is revoked_at'
);

-- Revoking is allowed.
update public.api_keys
set revoked_at = now()
where user_id = '00000000-0000-0000-0000-000000003000';
select is(
  (select count(*)::int from public.api_keys where user_id = '00000000-0000-0000-0000-000000003000' and revoked_at is not null),
  1,
  'revoked_at is the only column the owner may write'
);

select * from finish();
rollback;
