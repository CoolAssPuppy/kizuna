#!/usr/bin/env bash
# scripts/reset-remote-db.sh — TEMPORARY launch-window utility.
#
# Wipes the public schema on a remote Supabase project, re-applies the
# declarative schemas + seed + fixtures, and prints a summary. Reads
# every credential from Doppler so no secret ever lives on disk.
#
# Usage:
#   ./scripts/reset-remote-db.sh              # defaults to --config prd
#   ./scripts/reset-remote-db.sh stg          # target staging instead
#   ./scripts/reset-remote-db.sh prd --yes    # skip the confirm prompt
#
# Prerequisites in the chosen Doppler config:
#   * VITE_SUPABASE_URL          — https://<ref>.supabase.co
#   * SB_DB_PASSWORD             — Postgres password (Settings -> Database)
#   * SB_PASSPORT_KEY            — pgp_sym_encrypt key seeded into
#                                  vault.secrets as 'kizuna_passport_key'.
#                                  Generate once: `openssl rand -hex 32`.
#                                  Rotating it strands previously-encrypted
#                                  passport numbers, so set once per env
#                                  and treat it as immutable.
#   * (optional) SB_DB_REGION    — defaults to us-east-1
#
# Doppler reserves the SUPABASE_ prefix for its Supabase sync, so we
# use SB_ for the secrets we own.
#
# The script DROPs schema public, so it is destructive. The
# `--yes` flag is provided for CI ergonomics; do not script it
# blindly. Delete this file once Phase 1 launch is settled.

set -euo pipefail

CONFIG="${1:-prd}"
YES="${2:-}"

if [[ "$CONFIG" != "prd" && "$CONFIG" != "stg" ]]; then
  echo "first argument must be one of: prd, stg" >&2
  exit 64
fi

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI not installed; install from https://docs.doppler.com/docs/cli" >&2
  exit 69
fi

DOPPLER=(doppler --project kizuna --config "$CONFIG")

SUPABASE_URL=$("${DOPPLER[@]}" secrets get VITE_SUPABASE_URL --plain)
DB_PASSWORD=$("${DOPPLER[@]}" secrets get SB_DB_PASSWORD --plain 2>/dev/null || true)
PASSPORT_KEY=$("${DOPPLER[@]}" secrets get SB_PASSPORT_KEY --plain 2>/dev/null || true)
DB_REGION=$("${DOPPLER[@]}" secrets get SB_DB_REGION --plain 2>/dev/null || echo "us-east-1")

if [[ -z "$DB_PASSWORD" ]]; then
  echo "SB_DB_PASSWORD missing in doppler $CONFIG. Add it first:" >&2
  echo "  doppler secrets set --project kizuna --config $CONFIG SB_DB_PASSWORD '<your-postgres-password>'" >&2
  echo "Find the password in Supabase dashboard > Settings > Database." >&2
  exit 78
fi

if [[ -z "$PASSPORT_KEY" ]]; then
  echo "SB_PASSPORT_KEY missing in doppler $CONFIG. Generate one and add it:" >&2
  echo "  doppler secrets set --project kizuna --config $CONFIG SB_PASSPORT_KEY \"\$(openssl rand -hex 32)\"" >&2
  echo "set_passport / get_passport_number read this from vault.secrets." >&2
  exit 78
fi

# Extract the project ref from the URL and build the pooler connection
# string. Pooler is the only path that accepts external traffic.
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^.]+)\..*|\1|')
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-${DB_REGION}.pooler.supabase.com:5432/postgres?sslmode=require"

echo
echo "=========================================================="
echo "  Kizuna remote DB reset"
echo "  config:      $CONFIG"
echo "  project ref: $PROJECT_REF"
echo "  region:      $DB_REGION"
echo "=========================================================="
echo

if [[ "$YES" != "--yes" ]]; then
  echo "This will DROP every table in schema public and re-apply schemas + fixtures."
  read -r -p "Type 'RESET' to proceed: " confirm
  if [[ "$confirm" != "RESET" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -X)

echo "[1/4] Dropping public + tap schemas"
"${PSQL[@]}" <<'SQL'
do $$ begin
  execute 'drop schema if exists public cascade';
  execute 'drop schema if exists tap cascade';
  execute 'create schema public';
  -- restore default grants so RLS / role logic works after reset
  grant usage on schema public to anon, authenticated, service_role;
  grant all on schema public to postgres, service_role;
end $$;
SQL

echo "[2/4] Applying declarative schemas"
for f in supabase/schemas/*.sql; do
  echo "  $f"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "[3/4] Applying seed.sql"
"${PSQL[@]}" -f supabase/seed.sql >/dev/null

if compgen -G "supabase/events/*.sql" > /dev/null; then
  echo "[3.5/4] Applying event scripts"
  for f in supabase/events/*.sql; do
    echo "  $f"
    "${PSQL[@]}" -f "$f" >/dev/null
  done
fi

if compgen -G "supabase/fixtures/*.sql" > /dev/null; then
  echo "[4/4] Applying fixtures (sample data)"
  for f in supabase/fixtures/*.sql; do
    echo "  $f"
    "${PSQL[@]}" -f "$f" >/dev/null
  done
fi

echo "Bootstrapping kizuna_passport_key in vault.secrets"
# set_passport / get_passport_number read the key from Vault by name.
# Idempotent: insert only if absent so reruns don't strand prior ciphertext.
# psql substitutes :'passport_key' to a properly-quoted literal client-side,
# so the value is bound into the statement instead of being interpolated by
# the shell.
"${PSQL[@]}" -v "passport_key=$PASSPORT_KEY" <<'SQL'
select case
  when exists (select 1 from vault.secrets where name = 'kizuna_passport_key')
    then 'kizuna_passport_key already set; leaving existing value in place'
  else 'kizuna_passport_key created: ' ||
       vault.create_secret(
         :'passport_key',
         'kizuna_passport_key',
         'pgp_sym_encrypt key for passport_details.passport_number_encrypted'
       )::text
end as vault_status;
SQL

echo
echo "Done. Sample data is live on $CONFIG."
