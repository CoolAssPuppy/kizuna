# GitHub setup checklist

A one-time tour of the GitHub-side configuration that makes the CI workflow work as intended. Most of these are settings on the repo, not code in the repo.

## Required

### 1. Branch protection on `main`

Settings → Branches → Add branch protection rule

- **Branch name pattern**: `main`
- **Require a pull request before merging**: on
  - Require approvals: 1 (raise once the team grows)
  - Dismiss stale reviews when new commits push: on
  - Require review from Code Owners: on (uses `.github/CODEOWNERS`)
- **Require status checks to pass before merging**: on
  - Mark these as required after the first CI run lands a green check:
    - `typecheck · lint · format · test · build`
    - `schemas · pgTAP`
    - `end-to-end`
- **Require conversation resolution before merging**: on
- **Require signed commits**: optional (recommended)
- **Do not allow bypassing the above settings**: on (until the project ships)

### 2. Actions permissions

Settings → Actions → General

- **Actions permissions**: Allow all actions and reusable workflows
- **Workflow permissions**: Read repository contents permission (default)
- **Allow GitHub Actions to create and approve pull requests**: on (for Dependabot)

### 3. Default branch

Confirm `main` is the default branch under Settings → Branches.

## Recommended

### 4. Secrets for CI (when the time comes)

Settings → Secrets and variables → Actions

For now CI does not need any real secrets — every step uses placeholder env vars. When we wire production deploys, add:

- `DOPPLER_TOKEN` — a Doppler service token scoped to the `prd` config
- `SUPABASE_PROJECT_ID` — for `supabase db push` in the deploy workflow
- `SUPABASE_DB_PASSWORD` — for `supabase db push`
- `VERCEL_TOKEN` — if you want CI to trigger Vercel deploys (Vercel's own integration is usually easier)

### 5. Dependabot

`.github/dependabot.yml` is already in the repo. The first time it runs, GitHub may ask you to enable Dependabot under Settings → Code security and analysis. Confirm:

- **Dependabot alerts**: on
- **Dependabot security updates**: on
- **Dependabot version updates**: on (uses the file in this repo)

### 6. Code scanning

Settings → Code security and analysis → Code scanning

- Enable GitHub's **Default** code scanning setup. It uses CodeQL on JavaScript/TypeScript with no extra config.

### 7. Secret scanning

Settings → Code security and analysis

- **Secret scanning**: on
- **Push protection**: on (blocks pushes that contain detected credentials)

## Optional

### 8. Status badge

Once the first CI run completes, add a badge to the README:

```markdown
[![CI](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml/badge.svg)](https://github.com/CoolAssPuppy/kizuna/actions/workflows/ci.yml)
```

### 9. Issue templates

`.github/ISSUE_TEMPLATE/` can hold structured templates for bug reports, feature requests, and incident reports. Skip until the project takes external contributions.

### 10. Discussions

Settings → General → Features → Discussions: enable when the project is ready for community input. For now, keep it off.
