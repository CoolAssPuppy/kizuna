-- Schema-level GRANTs for the Supabase application roles.
--
-- Supabase Cloud bootstraps `public` with grants to anon /
-- authenticated / service_role on every table created via the
-- dashboard or migrations CLI. When we DROP SCHEMA public and
-- recreate it (see scripts/reset-remote-db.sh), those grants vanish
-- and the SPA gets `permission denied for table users` even when RLS
-- would have allowed the row. The block below re-applies every grant
-- we rely on so a fresh schema deploy is a working schema deploy.
--
-- This file runs LAST in scripts/db-apply.sh's alphabetical order,
-- after all CREATE TABLE / CREATE FUNCTION statements have landed.
-- Idempotent: re-running it is a no-op.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Routines are NOT granted blanket-style anymore. Per-function GRANT
-- statements in 80_functions_and_triggers.sql + 90_rls.sql control
-- who can EXECUTE each one. Doing it that way:
--   - keeps user-action SECURITY DEFINER RPCs (set_passport,
--     set_user_leadership, broadcast_to_all_channels, etc.) off-limits
--     to the anon role — Supabase advisor lints 0028/0029.
--   - keeps RLS helpers (is_admin, is_super_admin, auth_role,
--     is_self_or_admin, channel_has_access, is_leadership_user)
--     callable by anon AND authenticated, which is what RLS
--     evaluation needs even for unauthenticated callers hitting
--     tables with policies that reference them.
-- The block below grants EXECUTE only on the helpers that legitimately
-- need to run in any caller's context.
grant execute on function public.auth_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_self_or_admin(uuid) to anon, authenticated;
grant execute on function public.is_leadership_user() to anon, authenticated;
grant execute on function public.channel_has_access(uuid, text) to anon, authenticated;
grant execute on function public.current_active_event_id() to anon, authenticated;

-- service_role still needs blanket execute for backups, the cron
-- secret-bearer that runs send-deadline-reminders, etc.
grant all on all routines in schema public to service_role;

-- Default privileges for tables / functions / sequences created
-- AFTER this file runs. Without these, a future migration that
-- creates a table inside `public` would silently re-introduce the
-- "permission denied" failure. Functions stay default-locked-down
-- (we only grant on the helpers above + per-function in their own
-- schema files); tables and sequences keep the broad grants.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
