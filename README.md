# Kizuna

> Kizuna (絆) means "an enduring bond." It is the event and community platform powering Supafest, Supabase's annual company retreat, plus Select developer events and community meetups. Built natively on Supabase. Open-sourced as a showcase of the product itself.

[![CI](https://img.shields.io/badge/CI-typecheck%20%E2%80%A2%20lint%20%E2%80%A2%20test%20%E2%80%A2%20pgTAP%20%E2%80%A2%20build-success)](#)
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
- [Realtime + offline](#realtime--offline)
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

- Registration with consent gating, dietary preferences, accessibility needs, passport details, and dependents
- Personal itinerary cached for offline use (the 90-minute YYC → Banff bus has spotty signal)
- Real-time community chat with iMessage-style bubbles, lightweight markdown, image uploads, and typing presence
- A world map of attendees with hometown / current-city pins
- People-matching by hobbies, hometown, and current city
- Admin dashboard with live shareable reports for hotels and transport providers
- Jet-lag fighter that detects timezone offset and serves science-backed tips
- HiBob, Perk, Stripe, Slack, Resend, OpenAI, and Notion integrations with conflict-aware sync
- Full legal audit trail for every consent and document acknowledgment

The Phase 1 deadline is **2026-08-01** — the date by which we must begin compiling attendee and rooming lists for Supafest 2027.

## The 5C framework

Every design decision in this codebase maps to one of these:

| Principle     | Key surfaces                                                       | What it covers                                                          |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Connection    | `attendee_profiles`, `channels`, `messages`, `hobby_catalog`       | Profiles, world map, people-matching, channel chat, typing presence     |
| Collaboration | `sessions`, `votes`, `session_registrations`                       | Voting, breakout sign-ups, idea boards (P3)                             |
| Clarity       | `registrations`, `flights`, `accommodations`, `itinerary_items`    | Personal itinerary, tasks, document sign-offs                           |
| Commitment    | `registration_tasks`, `notifications`                              | Deadline tracking, nudges, year-over-year continuity                    |
| Celebration   | `votes`, `messages`, `feed_items`                                  | Gamification, recognition, editorial home feed                          |

## Tech stack

| Layer    | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| Frontend | Vite 5 + React 18 + TypeScript (strict, exactOptionalPropertyTypes)|
| Routing  | React Router v6 with route-level lazy + Suspense                   |
| Styling  | Tailwind CSS 3 + shadcn/ui (New York) with CSS-variable themes     |
| State    | TanStack Query (server) + Zustand (sparingly, local)               |
| Forms    | react-hook-form + zod                                              |
| i18n     | i18next + react-i18next, English-US default                        |
| PWA      | vite-plugin-pwa with Workbox (precache + stale-while-revalidate)   |
| Backend  | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions (Deno) |
| Schema   | Declarative SQL in `supabase/schemas/` (no timestamped migrations) |
| Tests    | Vitest · React Testing Library · Playwright · pgTAP · MSW          |
| Deploy   | Vercel (web) · Supabase Cloud (backend, GitHub Actions later)      |

## Architecture at a glance

```
+-----------------------+              +-----------------------+
|     PWA (Vercel)      |   Supabase   |   Postgres + RLS      |
|   Vite + React 18     |  client SDK  |   ~37 tables, 60+     |
|   Workbox offline     +<------------>+   policies, 20+       |
|   shadcn UI themes    |   Realtime   |   triggers, JWT hook  |
+-----------+-----------+              +-----------+-----------+
            ^                                       |
            |  presence + postgres_changes          |  Edge Functions
            |                                       v
            |                       +---------------+----------+
            |                       | Deno runtime             |
            |                       | invitation, accept,      |
            |                       | stripe, parse-itinerary, |
            |                       | sync-hibob, send-* cron  |
            |                       +---------------+----------+
            |                                       |
            |                                       v
            |             +-----+-----+-----+-----+-----+-----+
            +------------>+ Resend Stripe Slack Notion Okta   |
                          | HiBob Perk OpenAI Anthropic       |
                          +-----------------------------------+
```

Three load-bearing primitives:

1. **Sync source tagging.** Fields originating from HiBob or Perk carry `field_source` and `field_locked` companions. User overrides write to `data_conflicts` for admin review. We never silently overwrite synced data.
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
git clone https://github.com/CoolAssPuppy/kizuna.git
cd kizuna
cp .env.example .env

# Spin up the local Supabase stack (Postgres, Auth, Storage, Edge Functions).
supabase start

# Apply the declarative schemas, pgTAP, seed, year-specific event, and fixtures.
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

### Try the realtime simulation

Once the app is running, open a community channel and start the simulation in another terminal:

```bash
npm run simulate:community
```

It signs in as 16 sample employees and replays a scripted multi-channel conversation with debounced typing presence. Watch bubbles arrive live and "people are typing…" indicators appear without page reload.

## Common commands

| Command                                       | What it does                                       |
| --------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                 | Vite dev server on port 5173                       |
| `npm run build`                               | Production build (route-split + vendor chunks)     |
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
| `npm run db:reset`                            | Reset DB — drops state and reapplies init scripts  |
| `npm run db:apply`                            | Apply declarative schemas + pgTAP + seed via psql  |
| `npm run db:diff`                             | Generate a migration from declarative schema diffs |
| `npm run db:test`                             | Run pgTAP tests                                    |
| `npm run gen:types`                           | Regenerate `src/types/database.types.ts`           |
| `npm run simulate:community`                  | Replay a scripted realtime chat to 5 channels      |
| `npx tsx scripts/snapshot-email-templates.ts` | Regenerate `supabase/email-templates/*`            |

## Project structure

```
src/
  app/             Routing, providers, error boundary, layout, theme
  components/      Shared UI (header, footer, avatar, shadcn primitives)
    ui/            shadcn-generated atoms
  features/        Feature-sliced modules
    admin/         Reports, conflict resolution, agenda admin, nudges, stats, feed, documents
    auth/          AuthProvider, RequireAuth, SignInScreen, dev shortcuts
    community/     Profiles, channels, iMessage chat, world map, hobby + town matching
    documents/     Consent gate, documents tab, audit trail
    events/        useActiveEvent, EventCountdown, /all-events gallery
    guests/        Invitation accept screen, edge function bindings
    home/          Home dashboard, jet-lag fighter, editorial feed, greetings
    itinerary/     Personal schedule + offline + QR check-in
    notifications/ Bell + dropdown + read state
    profile/       Left-nav profile editor that mounts every section
    registration/  Wizard shell + sections (personal info, dietary, ...)
    welcome/       Logged-out hero
  lib/             Cross-cutting utilities
    email/         Shared transactional email theme + templates
    integrations/  Resend, Stripe, OpenAI, HiBob, Slack, ... (graceful when unkeyed)
    edgeFunction.ts callEdgeFunction<T> wrapper with consistent error model
    formatters.ts   Cached Intl.DateTimeFormat helpers
    i18n.ts        i18next setup
    supabase.ts    Singleton client
    theme.ts       Theme tokens + persistence
    useMountEffect.ts Explicit one-time external sync hook
  locales/         i18n resource files (en-US default)
  styles/          Tailwind + CSS variables for themes
  test/            Test setup and helpers
  types/           Generated Supabase types
scripts/
  db-apply.sh             Reset-aware schema + seed + fixtures applier
  simulate-community.ts   Replays a realtime chat using sample users
  snapshot-email-templates.ts  Regenerates Supabase Auth email HTML
supabase/
  schemas/         Declarative SQL — source of truth for the DB
  tests/           pgTAP tests (11 files, 35+ assertions)
  functions/       Edge functions (Deno/TS)
  email-templates/ Paste-into-dashboard HTML templates
  events/          One file per event year (2025/2026/2027 Supafest)
  fixtures/        01_sample_employees.sql + 02_sample_community.sql
  seed.sql         Default local seed (people + system channels + hobby catalog)
tests/
  e2e/             Playwright specs
public/            Static assets, favicons, PWA manifest icons
.github/workflows/ CI (typecheck, lint, format, test, build, e2e) — wired in M10+
tasks/             Plan, lessons, refactor audit
```

## Routing map

| Path                              | Auth         | Purpose                                                      |
| --------------------------------- | ------------ | ------------------------------------------------------------ |
| `/sign-in`                        | public       | Dual-tab sign-in (employee SSO / guest password)             |
| `/accept-invitation`              | public       | Guest accepts a 7-day signed invitation token                |
| `/share/reports/:token`           | public token | Read-only report shared with hotels / bus operator           |
| `/`                               | required     | Home dashboard with feed, countdown, jet-lag, facts          |
| `/all-events`                     | required     | Event gallery with per-browser event override                |
| `/registration`                   | required     | Wizard router (jumps to next pending step)                   |
| `/registration/:stepPath`         | required     | Personal info, dietary, accessibility, passport, swag, ...   |
| `/consent`                        | required     | Consent gate for documents requiring acknowledgement         |
| `/documents`                      | required     | Read-only document library with version status               |
| `/documents/:documentId/sign`     | required     | Sign or re-acknowledge a document                            |
| `/documents/new`                  | admin        | Admin create flow                                            |
| `/itinerary`                      | required     | Personal schedule with offline cache + QR check-in           |
| `/agenda`                         | required     | Public session agenda with day picker                        |
| `/community`                      | required     | World map + matches + channel list                           |
| `/community/channels/:slug`       | required     | iMessage-style channel with realtime + typing                |
| `/profile`                        | required     | Profile editor with left-nav sections (personal, community…) |
| `/admin/*`                        | admin only   | Reports, conflicts, stats, agenda, feed, nudges, documents   |
| `*`                               | public       | Not Found                                                    |

Routes other than `/sign-in`, `/accept-invitation`, and `/share/*` show the `AppHeader` and `AppFooter`. Logged-out visitors see no chrome regardless of route.

## Database

37 tables defined declaratively in `supabase/schemas/`. RLS is enabled on every table; the service-role key never touches client code.

Highlights:

- **Identity** — `users`, `employee_profiles`, `guest_profiles`, `guest_invitations`, `additional_guests`, `accessibility_preferences`, `emergency_contacts`. `users.is_leadership` is a boolean flag (orthogonal to role) writable only by admins via the `users_leadership_change_guard` trigger and `set_user_leadership` RPC.
- **Registration** — `registrations` + `registration_tasks` (the trigger-maintained `completion_pct` lives here), `passport_details` (encrypted via pgcrypto, no admin SELECT policy), `dietary_preferences`.
- **Logistics** — `flights`, `accommodations`, `accommodation_occupants`, `transport_requests`, `transport_vehicles`, `swag_sizes` (polymorphic on `user_id` OR `additional_guest_id`).
- **Events** — `events`, `sessions`, `session_registrations`, `session_favorites`, `dinner_seating`, `itinerary_items` (materialised by triggers).
- **Documents** — `documents`, `document_acknowledgements` (legal audit trail with scrolled / explicit / device-type signals).
- **Community** — `attendee_profiles` (bio, hobbies, hometown, current city), `channels` (slug + name + creator), `messages` (channel slug routing key + soft delete + edited_at), `hobby_catalog` (curated typeahead seeds), `votes`.
- **Infra** — `report_snapshots` (signed share tokens), `notifications` (with `read_at` + RPCs), `data_conflicts`, `hibob_sync_log`, `feed_items`.

The `[auth.hook.custom_access_token]` hook in `supabase/config.toml` injects an `app_role` and `is_leadership` JWT claim from `public.users` so RLS policies can read them without conflicting with Supabase's standard `authenticated` / `anon` mapping.

## Auth model

Two paths in:

1. **Employee SSO** — `signInWithSSO({ domain })` against an Okta domain set via `VITE_OKTA_DOMAIN`. With no Okta keys, the dev fallback signs in `prashant@kizuna.dev` against the seeded password.
2. **Guest email + password** — created via the `accept-guest-invitation` edge function once a 7-day signed JWT is verified.

Roles live in `public.users.role` and propagate to JWT via the Custom Access Token Hook. RLS reads `app_role` through `public.auth_role()` and the orthogonal `is_leadership` flag through `public.is_leadership_user()`.

Every route that requires sign-in goes through `<RequireAuth />`. Admin routes pass `allow={['admin','super_admin']}` so non-admin users see a localized blocked message instead of a redirect loop.

## Realtime + offline

- **Realtime publication** (`supabase/schemas/97_realtime.sql`) covers `events`, `sessions`, `session_registrations`, `session_favorites`, `feed_items`, `users`, `documents`, `document_acknowledgements`, `data_conflicts`, `notifications`, `itinerary_items`, `flights`, `transport_requests`, `channels`, `messages`. Home, admin, itinerary, notifications, and channels all subscribe.
- **Channel typing presence** is a Supabase Realtime broadcast channel (`community-typing:<slug>`). Debounced at the client to one event per 1.5s and aged out at 5s server-side.
- **Workbox runtime caching** stale-while-revalidates `itinerary_items`, `registrations`, `documents`, `flights`, `accommodations`, `accommodation_occupants`, `transport_requests`, `sessions`, `events` so the bus operator handoff still renders offline.

## Integrations and graceful degradation

HiBob, Perk, Stripe, Resend, Slack, Notion, Okta, and OpenAI integrations all run in two modes:

1. **Live** — credentials present in env, real API calls
2. **Stubbed** — credentials missing, integration returns deterministic mock responses, logs a single warning at module load, never throws

This lets the entire app run locally without any third-party setup.

| Integration | Live trigger                                      | Stub behavior                                                               |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Resend      | `RESEND_API_KEY` set                              | Records sent messages in an in-memory outbox                                |
| Stripe      | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` set | Stub redirect URL with `simulated=1` query param; webhook verifies-or-warns |
| HiBob       | `HIBOB_API_KEY` set                               | Sync edge function logs and returns mock data                               |
| Slack       | `SLACK_BOT_TOKEN` set                             | Notifications log to console only                                           |
| Notion      | `NOTION_API_KEY` set                              | Document sync skips and reports zero changes                                |
| OpenAI      | `OPENAI_API_KEY` set                              | `parse-itinerary` returns an empty itinerary so the UI still renders        |
| Anthropic   | `ANTHROPIC_API_KEY` set                           | Reserved for future LLM workloads (admin assistance, summarisation)         |

## Themes and i18n

Three themes ship — Light (default Supabase), Dark (Supabase inverted), and Barbie (pink, playful). They're selected via the dropdown in the footer and persisted to `localStorage`. Every visual token is a CSS variable defined in `src/styles/globals.css`. A designer can re-skin Kizuna without touching component code.

i18n is i18next + react-i18next with `en-US` as the default and only locale today. Adding a new language is a matter of:

1. Create `src/locales/<lang>/common.json` with translations
2. Add the locale to `SUPPORTED_LOCALES` in `src/lib/i18n.ts`
3. Register the resource in the `i18n.init` call

Every visible string flows through `t()` — there is no raw English in JSX. The footer's flag dropdown enumerates whatever locales `i18n.ts` exposes.

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

`supabase/fixtures/01_sample_employees.sql` seeds 60 fictional employees across five departments, themed for fun:

- **Executive** — Star Trek captains
- **Engineering** — Star Wars
- **Marketing** — Harry Potter
- **Sales** — Battlestar Galactica
- **Support** — The Simpsons

Plus a handful of guest invitations, dietary preferences, accessibility notes, and emergency contacts. Eight people are flagged as leadership (the C-suite plus department heads).

`supabase/fixtures/02_sample_community.sql` builds on top with attendee_profiles (bios, hobbies, hometowns, current cities) for 14 of the seeded users, five user-created channels, and starter messages so the channel list looks alive on first load.

Both files are applied automatically by `npm run db:apply`. Every fictional account uses the password `kizuna-dev-only`.

## Testing

| Layer                    | Tool                                      | Run                |
| ------------------------ | ----------------------------------------- | ------------------ |
| Unit & component         | Vitest + React Testing Library + jest-dom | `npm run test:run` |
| End-to-end               | Playwright (Chrome + mobile Pixel 7)      | `npm run test:e2e` |
| Database (RLS, triggers) | pgTAP                                     | `npm run db:test`  |
| Network mocking          | MSW                                       | imported per-test  |

Vitest currently ships **49 files / 237 tests**. pgTAP ships **11 files / 35+ assertions** covering RLS, leadership-flag guard, channel ownership, passport encryption, registration completion trigger, itinerary materialisation, and channel access control. The repo follows a strict TDD bias: tests for pure helpers go in before the component or feature that consumes them.

The project also enforces a no-`useEffect` discipline for data fetching and state derivation. See `~/.claude/skills/no-use-effect/SKILL.md` and `tasks/lessons.md` for the rule and the five replacement patterns.

## Deployment

Phase 1 ships locally. Production deploys land with M10:

- Vercel for the web bundle (`vercel.json` already locked: SPA rewrites, HSTS, X-Frame-Options DENY, Permissions-Policy, asset cache headers)
- Supabase Cloud for the backend (GitHub Actions to run `supabase db push` on merge)
- Vault-stored integration secrets

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — agent rules and architectural invariants
- [`tasks/todo.md`](./tasks/todo.md) — milestone tracker
- [`tasks/lessons.md`](./tasks/lessons.md) — patterns we keep re-discovering
- [`tasks/refactor-audit.md`](./tasks/refactor-audit.md) — the long-form audit driving P0 hardening work
- [`supabase/schemas/README.md`](./supabase/schemas/README.md) — declarative schema workflow
- [`supabase/tests/README.md`](./supabase/tests/README.md) — pgTAP conventions
- [`supabase/email-templates/README.md`](./supabase/email-templates/README.md) — email template workflow

---

Built with care for the Supabase team. Open-source release planned post-Supafest 2027.
