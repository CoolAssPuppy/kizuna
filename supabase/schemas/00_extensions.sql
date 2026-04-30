-- Postgres extensions used across the schema.
--
-- These run first because everything below assumes they are available.
-- pgcrypto powers passport_number encryption (pgp_sym_encrypt/decrypt).
-- citext gives us case-insensitive email storage where it matters.

create extension if not exists pgcrypto;
create extension if not exists citext;
