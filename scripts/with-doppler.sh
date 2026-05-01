#!/usr/bin/env bash
# scripts/with-doppler.sh
#
# Run a command with Doppler-injected env vars when the CLI is
# installed; otherwise pass through to the bare command. Centralised
# here because inline `if command -v doppler ... ; then ... ; else
# ... ; fi` patterns inside npm scripts break arg-forwarding —
# `npm run X -- --flag` produces `fi --flag`, which is a bash syntax
# error. Routing through this script means "$@" propagates cleanly.
#
# Usage in package.json scripts:
#   "dev": "bash scripts/with-doppler.sh vite"
#   "build": "bash scripts/with-doppler.sh sh -c 'tsc -b && vite build'"

set -euo pipefail

if command -v doppler >/dev/null 2>&1; then
  exec doppler run -- "$@"
fi
exec "$@"
