# GitHub setup checklist

What needs to live in the repo settings on github.com, beyond what's already in the repo. Most of the heavier security posture (Dependabot, code scanning, secret scanning, push protection) is intentionally deferred until the project moves into the Supabase org and that team's defaults take over.

## 1. Branch protection on `main`

Settings → Branches → Add branch protection rule

- Branch name pattern: `main`
- Require a pull request before merging: on
  - Require approvals: 1 (raise once the team grows)
  - Dismiss stale reviews when new commits push: on
  - Require review from Code Owners: on (uses `.github/CODEOWNERS`)
- Require status checks to pass before merging: on. After the first CI run lands, mark these as required:
  - `typecheck · lint · format · test · build`
  - `schemas · pgTAP`
  - `end-to-end`
- Require conversation resolution before merging: on
- Do not allow bypassing the above settings: on

## 2. Supabase Branching is already wired

Settings → Integrations → Supabase. Per-PR preview Postgres branches and `supabase db push` on merge to main are handled by the Supabase GitHub integration. No GitHub secrets are needed for that path — Supabase uses OIDC.

## 3. Secrets for the edge-function deploy workflow

`.github/workflows/deploy.yml` deploys edge functions on push to `main`. It needs two secrets in Settings → Secrets and variables → Actions → Repository secrets:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> → Generate a new personal access token, copy once. |
| `SUPABASE_PROJECT_REF` | The 20-character ref in your project URL (`https://supabase.com/dashboard/project/<this part>`). |

Schema deploys do not need `SUPABASE_DB_PASSWORD` — Supabase Branching handles those via the GitHub integration.

## 4. Status badge (optional)

Once the first CI run is green:

```markdown
[![CI](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml/badge.svg)](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml)
```

## Deferred until the Supabase org takeover

The Supabase engineering team will turn these on at the org level once the repo moves under `supabase/`:

- Dependabot (alerts + security updates + version updates)
- Code scanning (CodeQL)
- Secret scanning + push protection
