set search_path to public, tap, extensions;
-- Lock down the EXECUTE surface on every SECURITY DEFINER function flagged
-- by Supabase advisor lints 0028/0029. Three buckets:
--   1. Trigger-only functions: no application role needs EXECUTE, since the
--      trigger fires with table-owner privileges.
--   2. Service-role-only functions: invoked exclusively from edge functions
--      that ship the service-role key. anon and authenticated must NOT be
--      able to reach them via PostgREST.
--   3. User-facing RPCs the SPA invokes: authenticated must keep EXECUTE,
--      anon must NOT.
-- has_function_privilege() returns the effective grant for a role, so it
-- catches any future drift where someone re-adds EXECUTE without thinking.

begin;
select plan(20);

-- =====================================================================
-- Bucket 1: trigger-only functions
-- =====================================================================
select ok(
  not has_function_privilege('anon', 'public.cascade_auth_user_delete()', 'execute'),
  'anon cannot EXECUTE cascade_auth_user_delete (trigger-only)'
);
select ok(
  not has_function_privilege('authenticated', 'public.cascade_auth_user_delete()', 'execute'),
  'authenticated cannot EXECUTE cascade_auth_user_delete (trigger-only)'
);

select ok(
  not has_function_privilege('anon', 'public.ensure_public_user_for_auth()', 'execute'),
  'anon cannot EXECUTE ensure_public_user_for_auth (trigger-only)'
);
select ok(
  not has_function_privilege('authenticated', 'public.ensure_public_user_for_auth()', 'execute'),
  'authenticated cannot EXECUTE ensure_public_user_for_auth (trigger-only)'
);

select ok(
  not has_function_privilege('anon', 'public.ensure_additional_guest_user()', 'execute'),
  'anon cannot EXECUTE ensure_additional_guest_user (trigger-only)'
);

select ok(
  not has_function_privilege('anon', 'public.guard_api_key_update()', 'execute'),
  'anon cannot EXECUTE guard_api_key_update (trigger-only)'
);

select ok(
  not has_function_privilege('anon', 'public.maybe_complete_documents_task()', 'execute'),
  'anon cannot EXECUTE maybe_complete_documents_task (trigger-only)'
);

select ok(
  not has_function_privilege('anon', 'public.sync_event_photo_hashtags()', 'execute'),
  'anon cannot EXECUTE sync_event_photo_hashtags (trigger-only)'
);

-- =====================================================================
-- Bucket 2: service-role-only functions
-- =====================================================================
select ok(
  not has_function_privilege('anon', 'public.verify_api_key(text, inet)', 'execute'),
  'anon cannot EXECUTE verify_api_key (service-role only)'
);
select ok(
  not has_function_privilege('authenticated', 'public.verify_api_key(text, inet)', 'execute'),
  'authenticated cannot EXECUTE verify_api_key (service-role only)'
);
select ok(
  has_function_privilege('service_role', 'public.verify_api_key(text, inet)', 'execute'),
  'service_role retains EXECUTE on verify_api_key'
);

select ok(
  not has_function_privilege('anon', 'public.exchange_oauth_code(text, text)', 'execute'),
  'anon cannot EXECUTE exchange_oauth_code (service-role only)'
);
select ok(
  not has_function_privilege('authenticated', 'public.exchange_oauth_code(text, text)', 'execute'),
  'authenticated cannot EXECUTE exchange_oauth_code (service-role only)'
);

select ok(
  not has_function_privilege('anon', 'public.write_cli_audit_log(uuid, uuid, text, text, public.api_key_scope, text, text, int)', 'execute'),
  'anon cannot EXECUTE write_cli_audit_log (service-role only)'
);
select ok(
  not has_function_privilege('authenticated', 'public.write_cli_audit_log(uuid, uuid, text, text, public.api_key_scope, text, text, int)', 'execute'),
  'authenticated cannot EXECUTE write_cli_audit_log (service-role only)'
);

-- =====================================================================
-- Bucket 3: user-facing RPCs (anon=denied, authenticated=allowed)
-- =====================================================================
select ok(
  not has_function_privilege('anon', 'public.create_api_key(text, public.api_key_scope, timestamptz)', 'execute'),
  'anon cannot EXECUTE create_api_key'
);
select ok(
  has_function_privilege('authenticated', 'public.create_api_key(text, public.api_key_scope, timestamptz)', 'execute'),
  'authenticated CAN EXECUTE create_api_key'
);

select ok(
  not has_function_privilege('anon', 'public.revoke_api_key(uuid)', 'execute'),
  'anon cannot EXECUTE revoke_api_key'
);
select ok(
  has_function_privilege('authenticated', 'public.revoke_api_key(uuid)', 'execute'),
  'authenticated CAN EXECUTE revoke_api_key'
);

select ok(
  has_function_privilege('authenticated', 'public.mint_oauth_code(public.api_key_scope, text, text)', 'execute'),
  'authenticated CAN EXECUTE mint_oauth_code'
);

select * from finish();
rollback;
