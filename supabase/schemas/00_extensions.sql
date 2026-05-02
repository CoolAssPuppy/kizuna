-- Postgres extensions used across the schema.
--
-- pgcrypto powers passport_number encryption (pgp_sym_encrypt/decrypt).
-- citext gives us case-insensitive email storage.
--
-- Both extensions live in `extensions` (Supabase convention) so the
-- public schema stays free of extension types — Supabase's database
-- linter flags extensions in `public` (lint 0014).

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create extension if not exists pgcrypto schema extensions;
create extension if not exists citext schema extensions;
-- pg_trgm powers ILIKE/word-similarity search over photo captions and is
-- the standard recommended for free-text search at our scale.
create extension if not exists pg_trgm schema extensions;

-- If a previous deploy installed citext into `public`, move it. ALTER
-- EXTENSION ... SET SCHEMA migrates the type definition; existing
-- columns reference it by OID and continue to work.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'citext' and n.nspname = 'public'
  ) then
    execute 'alter extension citext set schema extensions';
  end if;
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'public'
  ) then
    execute 'alter extension pgcrypto set schema extensions';
  end if;
end
$$;
