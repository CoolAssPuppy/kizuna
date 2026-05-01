#!/usr/bin/env bash
# Apply declarative schemas + seed to the local Supabase database.
#
# Order of operations:
#   1. Run every supabase/schemas/*.sql in alphabetical order
#   2. Install pgTAP into a `tap` schema (test-only, kept out of public)
#   3. Apply supabase/seed.sql for the canonical dev fixture (people only)
#   4. Apply supabase/events/*.sql (event-specific data — one file per year)
#   5. Apply supabase/fixtures/*.sql (idempotent demo data — Star Wars employees etc.)
#
# Idempotent: safe to run repeatedly. Designed for the local DB only — not
# for production. Production deploys go through generated migrations.

set -euo pipefail

PSQL_BASE=(env PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1)

for f in supabase/schemas/*.sql; do
  echo "applying $f"
  "${PSQL_BASE[@]}" -f "$f"
done

echo "installing pgtap into tap schema"
"${PSQL_BASE[@]}" -c "create schema if not exists tap;"
"${PSQL_BASE[@]}" -c "create extension if not exists pgtap with schema tap;"
"${PSQL_BASE[@]}" -c "grant usage on schema tap to authenticated, anon;"
"${PSQL_BASE[@]}" -c "grant execute on all functions in schema tap to authenticated, anon;"

echo "applying seed"
"${PSQL_BASE[@]}" -f supabase/seed.sql

if compgen -G "supabase/events/*.sql" > /dev/null; then
  for f in supabase/events/*.sql; do
    echo "applying $f"
    "${PSQL_BASE[@]}" -f "$f"
  done
fi

if compgen -G "supabase/fixtures/*.sql" > /dev/null; then
  for f in supabase/fixtures/*.sql; do
    echo "applying $f"
    "${PSQL_BASE[@]}" -f "$f"
  done
fi
