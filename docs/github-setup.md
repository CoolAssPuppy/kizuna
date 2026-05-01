# GitHub setup checklist

What needs to live in the repo settings on github.com, beyond what's already in the repo. Most of the heavier security and review posture is intentionally deferred until the project either grows past one developer or moves into the Supabase org and that team's defaults take over.

## 1. Supabase Branching is already wired

Settings → Integrations → Supabase. Per-PR preview Postgres branches and `supabase db push` on merge to main are handled by the Supabase GitHub integration. No GitHub secrets are needed for that path — Supabase uses OIDC.

## 2. Secrets for the edge-function deploy workflow

`.github/workflows/deploy.yml` deploys edge functions on push to `main`, but only the ones whose folder changed. If `supabase/functions/_shared/` changes, it redeploys everything (every function imports from there). It needs two secrets in Settings → Secrets and variables → Actions → Repository secrets:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> → Generate a new personal access token, copy once. |
| `SUPABASE_PROJECT_REF` | The 20-character ref in your project URL (`https://supabase.com/dashboard/project/<this part>`). |

Schema deploys do not need `SUPABASE_DB_PASSWORD` — Supabase Branching handles those via the GitHub integration.

The deploy workflow also exposes a manual run with a "force-deploy every function" toggle (Actions → Deploy → Run workflow), useful for debugging or initial bring-up.

## 3. Status badge (optional)

Once the first CI run is green:

```markdown
[![CI](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml/badge.svg)](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml)
```

## Deferred until the team grows or the Supabase org takeover

Skip these for now. Solo developer + private repo + Supabase Branching previews makes them low-value:

- Branch protection on `main` (PR + approvals + required CI checks + Code Owners review)
- Dependabot (alerts + security updates + version updates)
- Code scanning (CodeQL)
- Secret scanning + push protection

The Supabase engineering team will turn these on at the org level once the repo moves under `supabase/`.
