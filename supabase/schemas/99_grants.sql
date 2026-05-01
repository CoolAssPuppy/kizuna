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
grant all on all routines in schema public to anon, authenticated, service_role;

-- Default privileges for tables / functions / sequences created
-- AFTER this file runs. Without these, a future migration that
-- creates a table inside `public` would silently re-introduce the
-- "permission denied" failure.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
