# Kizuna

> Kizuna (絆) means "an enduring bond." It is the event and community platform powering Supafest, Supabase's annual company retreat, plus Select developer events and community meetups. Built natively on Supabase. Designed to be open-sourced as a showcase of the product itself.

[![CI](https://img.shields.io/badge/CI-typecheck%20%E2%80%A2%20lint%20%E2%80%A2%20test%20%E2%80%A2%20build-success)](#)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#)

---

## Table of contents

- [What this is](#what-this-is)
- [The 5C framework](#the-5c-framework)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Local setup](#local-setup)
- [Common commands](#common-commands)
- [Project structure](#project-structure)
- [Routing map](#routing-map)
- [Database](#database)
- [Auth model](#auth-model)
- [Integrations and graceful degradation](#integrations-and-graceful-degradation)
- [Themes and i18n](#themes-and-i18n)
- [Email templates](#email-templates)
- [Sample data](#sample-data)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## What this is

Kizuna replaces a stack of Notion, Slack, WhatsApp, Google Sheets, and email with a single mobile-first Progressive Web App that runs on Supabase. It handles every aspect of running a 650-person international event:

- Registration with consent gating, dietary preferences, passport details, and dependents
- Personal itinerary cached for offline use (the 90-minute YYC → Banff bus has spotty signal)
- Real-time chat, photo sharing, and people-matching (Phase 2)
- Admin dashboard with live shareable reports for hotels and transport providers
- HiBob, Perk, Stripe, Slack, Resend, and Notion integrations with conflict-aware sync
- Full legal audit trail for every consent and document acknowledgment

The Phase 1 deadline is **2026-08-01** — the date by which we must begin compiling attendee and rooming lists for Supafest 2027.

## The 5C framework

Every design decision in this codebase maps to one of these:

| Principle     | Key tables                                              | What it covers                                       |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Connection    | attendee_profiles, messages                             | Profiles, people-matching, world map, chat           |
| Collaboration | sessions, votes, session_registrations                  | Voting, breakout sign-ups, idea boards               |
| Clarity       | registrations, flights, accommodations, itinerary_items | Personal itinerary, tasks, document sign-offs        |
| Commitment    | registration_tasks, notifications                       | Deadline tracking, nudges, year-over-year continuity |
| Celebration   | votes, messages, photos                                 | Gamification, recognition, photo sharing             |

## Tech stack

| Layer    | Choice                                                           |
| -------- | ---------------------------------------------------------------- |
| Frontend | Vite 5 + React 18 + TypeScript (strict)                          |
| Styling  | Tailwind CSS 3 + shadcn/ui (New York) with CSS-variable themes   |
| State    | TanStack Query (server) + Zustand (sparingly, local)             |
| Forms    | react-hook-form + zod                                            |
| i18n     | i18next + react-i18next, English-US default                      |
| PWA      | vite-plugin-pwa with Workbox (precache + stale-while-revalidate) |
| Backend  | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)     |
| Schema   | Declarative SQL in `supabase/schemas/`                           |
| Tests    | Vitest · React Testing Library · Playwright · pgTAP · MSW        |
| Deploy   | Vercel (web) · Supabase Cloud (backend, GitHub Actions later)    |

## Architecture at a glance

```
+--------------------+              +-------------------+
|   PWA (Vercel)     |   Supabase   |  Postgres + RLS   |
|  Vite + React 18   |  client SDK  |  35 tables, 18    |
|  Workbox offline   +<------------>+  triggers, 60+    |
|  shadcn UI themes  |              |  policies         |
+--------+-----------+              +---------+---------+
         ^                                   |
         | Realtime broadcasts               | Edge Functions
         |                                   v
         |                          +--------+---------+
         |                          | Deno runtime     |
         |                          | invitation, accept,|
         |                          | stripe-checkout, |
         |                          | stripe-webhook   |
         |                          +--------+---------+
         |                                   |
         |                                   v
         |                +------+------+------+------+
         +--------------->+ Resend Stripe Slack Notion |
                          | HiBob Perk Okta            |
                          +----------------------------+
```

Three load-bearing primitives:

1. **Sync source tagging.** Every field originating from HiBob or Perk carries `field_source` and `field_locked` companions. User overrides write to `data_conflicts` for admin review. We never silently overwrite synced data.
2. **Materialised `itinerary_items`.** A real table, not a view, kept in sync by triggers on `sessions`, `flights`, `transport_requests`, and `accommodation_occupants`. One fast offline query, no joins.
3. **`registrations.completion_pct` is trigger-maintained.** Never compute it in app code.

## Local setup

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker Desktop (for `supabase start`)
- Optional: `rsvg-convert` if you want to regenerate favicons (`brew install librsvg`)

### First run

```bash
git clone <this-repo> kizuna
cd kizuna
cp .env.example .env

# Spin up the local Supabase stack (Postgres, Auth, Storage, Edge Functions).
supabase start

# Apply the declarative schemas + seed.
npm install
npm run db:apply
npm run gen:types

# Run the app.
npm run dev
```

Visit <http://localhost:5173>. The Sign In screen exposes two dev shortcut buttons:

- **Pretend you're an employee** → signs you in as `luke.skywalker@kizuna.dev`
- **Pretend you're an admin** → signs you in as `jean-luc.picard@kizuna.dev`

These render only when `import.meta.env.DEV` is true. They never ship in production.

### Apply the sample fixtures

For a richer demo (60 fictional employees across five departments), apply the optional fixture file:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/fixtures/sample_employees.sql
```

See [`supabase/fixtures/sample_employees.sql`](./supabase/fixtures/sample_employees.sql) for the full character roster.

## Common commands

| Command                                       | What it does                                       |
| --------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                 | Vite dev server on port 5173                       |
| `npm run build`                               | Production build                                   |
| `npm run preview`                             | Preview the production build locally               |
| `npm run typecheck`                           | `tsc --noEmit` across the whole project            |
| `npm run lint`                                | ESLint over `src` and `tests`                      |
| `npm run lint:fix`                            | ESLint with autofix                                |
| `npm run format`                              | Prettier write                                     |
| `npm run format:check`                        | Prettier verify (used in CI)                       |
| `npm run test`                                | Vitest in watch mode                               |
| `npm run test:run`                            | Vitest single run (used in CI)                     |
| `npm run test:coverage`                       | Vitest with coverage report                        |
| `npm run test:e2e`                            | Playwright end-to-end                              |
| `npm run db:start`                            | Start local Supabase stack                         |
| `npm run db:stop`                             | Stop local Supabase stack                          |
| `npm run db:reset`                            | Reset DB — drops migrations + reapplies            |
| `npm run db:apply`                            | Apply declarative schemas + pgTAP + seed via psql  |
| `npm run db:diff`                             | Generate a migration from declarative schema diffs |
| `npm run db:test`                             | Run pgTAP tests                                    |
| `npm run gen:types`                           | Regenerate `src/types/database.types.ts`           |
| `npx tsx scripts/snapshot-email-templates.ts` | Regenerate `supabase/email-templates/*`            |

## Project structure

```
src/
  app/             Routing, providers, error boundary, layout, theme
  components/      Shared UI (header, footer, avatar, shadcn primitives)
    ui/            shadcn-generated atoms
  features/        Feature-sliced modules
    admin/         Reports, conflict resolution, CSV export
    auth/          AuthProvider, RequireAuth, SignInScreen, dev shortcuts
    documents/     Consent gate, documents tab, audit trail
    events/        useActiveEvent
    guests/        Invitation accept screen, edge function bindings
    itinerary/     Personal schedule + offline + QR check-in
    registration/  Wizard shell + steps (personal info, dietary, ...)
    welcome/       Home screen
  lib/             Cross-cutting utilities
    email/         Shared transactional email theme + templates
    integrations/  Resend, Stripe, JWT helpers (graceful when unkeyed)
    i18n.ts        i18next setup
    supabase.ts    Singleton client
    theme.ts       Theme tokens + persistence
  locales/         i18n resource files (en-US default)
  styles/          Tailwind + CSS variables for themes
  test/            Test setup and helpers
  types/           Generated Supabase types
supabase/
  schemas/         Declarative SQL — source of truth for the DB
  tests/           pgTAP tests
  functions/       Edge functions (Deno/TS)
  email-templates/ Paste-into-dashboard HTML templates
  fixtures/        Optional sample data
  seed.sql         Default local seed
tests/
  e2e/             Playwright specs
public/            Static assets, favicons, PWA manifest icons
.github/workflows/ CI (typecheck, lint, format, test, build, e2e)
tasks/             Plan and lessons documents
```

## Routing map

| Path                      | Auth       | Purpose                                                                |
| ------------------------- | ---------- | ---------------------------------------------------------------------- |
| `/sign-in`                | public     | Dual-tab sign-in (employee SSO / guest password) + dev pretend buttons |
| `/accept-invitation`      | public     | Guest accepts a 7-day signed invitation token                          |
| `/`                       | required   | Home with nav tiles                                                    |
| `/registration`           | required   | Wizard router (jumps to next pending step)                             |
| `/registration/:stepPath` | required   | Personal info, passport, emergency contact, dietary, swag, transport   |
| `/consent`                | required   | Consent gate for documents requiring acknowledgement                   |
| `/documents`              | required   | Read-only document library with version status                         |
| `/itinerary`              | required   | Personal schedule with offline cache + QR check-in                     |
| `/admin`                  | admin only | Live reports, conflict resolution, CSV export                          |
| `*`                       | public     | Not Found                                                              |

Routes other than `/sign-in` and `/accept-invitation` show the `AppHeader` and `AppFooter`. Logged-out visitors see no chrome regardless of route — there's nothing useful to show until you're signed in.

## Database

35 tables defined declaratively in `supabase/schemas/`. RLS is enabled on every table. Highlights:

- `users`, `employee_profiles`, `guest_profiles`, `guest_invitations`, `children`, `emergency_contacts`
- `registrations` + `registration_tasks` (the trigger-maintained `completion_pct` lives here)
- `passport_details` (encrypted via pgcrypto, no admin SELECT policy)
- `flights`, `accommodations`, `accommodation_occupants`, `transport_requests`, `transport_vehicles`, `swag_items`, `swag_selections`
- `events`, `sessions`, `session_registrations`, `dinner_seating`, `itinerary_items` (materialised)
- `documents`, `document_acknowledgements` (legal audit trail)
- `attendee_profiles`, `messages`, `votes` (community, P2)
- `report_snapshots`, `notifications`, `data_conflicts`, `hibob_sync_log`

The `[auth.hook.custom_access_token]` hook in `supabase/config.toml` injects an `app_role` JWT claim from `public.users.role` so RLS policies can read it without conflicting with Supabase's standard `authenticated` / `anon` mapping.

## Auth model

Two paths in:

1. **Employee SSO** — `signInWithSSO({ domain })` against an Okta domain set via `VITE_OKTA_DOMAIN`. With no Okta keys, the dev fallback signs in `prashant@kizuna.dev` against the seeded password.
2. **Guest email + password** — created via the `accept-guest-invitation` edge function once a 7-day signed JWT is verified.

Roles live in `public.users.role` and propagate to JWT via the Custom Access Token Hook. RLS reads `app_role` through `public.auth_role()`.

Every route that requires sign-in goes through `<RequireAuth />`. Admin routes pass `allow={['admin','super_admin']}` so non-admin users see a localized blocked message instead of a redirect loop.

## Integrations and graceful degradation

HiBob, Perk, Stripe, Resend, Slack, Notion, and Okta integrations all run in two modes:

1. **Live** — credentials present in env, real API calls
2. **Stubbed** — credentials missing, integration returns deterministic mock responses, logs a single warning at module load, never throws

This lets the entire app run locally without any third-party setup. See `src/lib/integrations/` and the edge functions under `supabase/functions/`.

| Integration | Live trigger                                      | Stub behavior                                                               |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Resend      | `RESEND_API_KEY` set                              | Records sent messages in an in-memory outbox                                |
| Stripe      | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` set | Stub redirect URL with `simulated=1` query param; webhook verifies-or-warns |
| HiBob       | `HIBOB_API_KEY` set (M8)                          | Sync edge function logs and returns mock data                               |
| Slack       | `SLACK_BOT_TOKEN` set (M9)                        | Notifications log to console only                                           |
| Notion      | `NOTION_API_KEY` set (M9)                         | Document sync skips and reports zero changes                                |

## Themes and i18n

Three themes ship — Light (default Supabase), Dark (Supabase inverted), and Barbie (pink, playful). They're selected via the dropdown in the footer and persisted to `localStorage`. Every visual token is a CSS variable defined in `src/styles/globals.css`. A designer can re-skin Kizuna without touching component code.

i18n is i18next + react-i18next with `en-US` as the default and only locale today. Adding a new language is a matter of:

1. Create `src/locales/<lang>/common.json` with translations
2. Add the locale to `SUPPORTED_LOCALES` in `src/lib/i18n.ts`
3. Register the resource in the `i18n.init` call

The footer's flag dropdown enumerates whatever locales `i18n.ts` exposes.

## Email templates

`src/lib/email/` is the single source of truth for transactional email. Three layers:

- `theme.ts` — palette tokens. The dark Supabase theme.
- `template.ts` — `renderEmail()` wraps every email in shared chrome.
- `messages.ts` — pre-baked content for invitations, receipts, deadline reminders.

Hosted Supabase Auth templates (confirm-signup, magic-link, invite, reset-password, change-email, reauthenticate) live as paste-ready HTML in `supabase/email-templates/`. Regenerate them with:

```bash
npx tsx scripts/snapshot-email-templates.ts
```

Updating the brand is a one-file edit (`src/lib/email/theme.ts`) followed by re-running the snapshot script.

## Sample data

`supabase/fixtures/sample_employees.sql` seeds 60 fictional employees across five departments, themed for fun:

- **Executive** — Star Trek captains
- **Engineering** — Star Wars
- **Marketing** — Harry Potter
- **Sales** — Battlestar Galactica
- **Support** — The Simpsons

Plus a handful of guest invitations and dietary preferences. Apply with:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/fixtures/sample_employees.sql
```

Every fictional account uses the password `kizuna-dev-only`.

## Testing

| Layer                    | Tool                                      | Run                         |
| ------------------------ | ----------------------------------------- | --------------------------- |
| Unit & component         | Vitest + React Testing Library + jest-dom | `npm run test:run`          |
| End-to-end               | Playwright (Chrome + mobile Pixel 7)      | `npm run test:e2e`          |
| Database (RLS, triggers) | pgTAP                                     | `supabase test db`          |
| Network mocking          | MSW                                       | imported per-test as needed |

The repo follows a strict TDD bias: tests for pure helpers go in before the component or feature that consumes them. See `tasks/lessons.md` for the patterns we lean on.

## Deployment

Phase 1 ships locally only. Production deploys land with M10:

- Vercel for the web bundle (auto-built from `main`)
- Supabase Cloud for the backend (GitHub Actions to run `supabase db push` on merge)
- Vault-stored integration secrets

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — agent rules and architectural invariants
- [`tasks/todo.md`](./tasks/todo.md) — milestone tracker
- [`tasks/lessons.md`](./tasks/lessons.md) — patterns we keep re-discovering
- [`supabase/schemas/README.md`](./supabase/schemas/README.md) — declarative schema workflow
- [`supabase/tests/README.md`](./supabase/tests/README.md) — pgTAP conventions
- [`supabase/email-templates/README.md`](./supabase/email-templates/README.md) — email template workflow

---

Built with care for the Supabase team. Open-source release planned post-Supafest 2027.
