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

| Principle     | Key surfaces                                                    | What it covers                                                      |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Connection    | `attendee_profiles`, `channels`, `messages`, `hobby_catalog`    | Profiles, world map, people-matching, channel chat, typing presence |
| Collaboration | `sessions`, `votes`, `session_registrations`                    | Voting, breakout sign-ups, idea boards (P3)                         |
| Clarity       | `registrations`, `flights`, `accommodations`, `itinerary_items` | Personal itinerary, tasks, document sign-offs                       |
| Commitment    | `registration_tasks`, `notifications`                           | Deadline tracking, nudges, year-over-year continuity                |
| Celebration   | `votes`, `messages`, `feed_items`                               | Gamification, recognition, editorial home feed                      |

## Tech stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------- |
| Frontend | Vite 5 + React 18 + TypeScript (strict, exactOptionalPropertyTypes) |
| Routing  | React Router v6 with route-level lazy + Suspense                    |
| Styling  | Tailwind CSS 3 + shadcn/ui (New York) with CSS-variable themes      |
| State    | TanStack Query (server) + Zustand (sparingly, local)                |
| Forms    | react-hook-form + zod                                               |
| i18n     | i18next + react-i18next, English-US default                         |
| PWA      | vite-plugin-pwa with Workbox (precache + stale-while-revalidate)    |
| Backend  | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions (Deno)  |
| Schema   | Declarative SQL in `supabase/schemas/` (no timestamped migrations)  |
| Tests    | Vitest · React Testing Library · Playwright · pgTAP · MSW           |
| Deploy   | Vercel (web) · Supabase Cloud (backend, GitHub Actions later)       |

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
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) (`brew install dopplerhq/cli/doppler`) — optional but recommended; the npm scripts auto-detect it
- Optional: `rsvg-convert` if you want to regenerate favicons (`brew install librsvg`)

### First run

```bash
git clone https://github.com/CoolAssPuppy/kizuna.git
cd kizuna

# Either: sign in to Doppler and bind the repo to the kizuna project
doppler login
doppler setup           # picks the project from doppler.yaml; pick a config

# Or: fall back to a local .env file
cp .env.example .env

# Spin up the local Supabase stack (Postgres, Auth, Storage, Edge Functions).
supabase start

# Apply the declarative schemas, pgTAP, seed, year-specific event, and fixtures.
npm install
npm run db:apply
npm run gen:types

# Run the app. The dev/build/preview scripts wrap with `doppler run --`
# when Doppler is on PATH; otherwise they read .env directly.
npm run dev
```

### Doppler configs

| Config         | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| `dev`          | Shared local defaults (local Supabase URLs, dev placeholders)     |
| `dev_personal` | Your personal overrides — set keys here that should not be shared |
| `stg`          | Staging cloud Supabase + integrations                             |
| `prd`          | Production                                                        |

Each config holds the same 24 keys as `.env.example`. Empty values fall through the integration stub paths gracefully (see [Integrations and graceful degradation](#integrations-and-graceful-degradation)).

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

## Local edge functions

`supabase start` brings up the edge runtime container but does **not** auto-register functions. To exercise the parse-itinerary / send-notification / share-report flows from the SPA, you also need:

```bash
npm run functions:serve
```

That runs `doppler secrets download` into `supabase/.env` (so `OPENAI_API_KEY` and friends are available to the runtime) and then starts `supabase functions serve`. Leave it running in a second terminal alongside `npm run dev`.

## Common commands

| Command                                       | What it does                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                                 | Vite dev server on port 5173                                         |
| `npm run build`                               | Production build (route-split + vendor chunks)                       |
| `npm run preview`                             | Preview the production build locally                                 |
| `npm run typecheck`                           | `tsc --noEmit` across the whole project                              |
| `npm run lint`                                | ESLint over `src` and `tests`                                        |
| `npm run lint:fix`                            | ESLint with autofix                                                  |
| `npm run format`                              | Prettier write                                                       |
| `npm run format:check`                        | Prettier verify (used in CI)                                         |
| `npm run test`                                | Vitest in watch mode                                                 |
| `npm run test:run`                            | Vitest single run (used in CI)                                       |
| `npm run test:coverage`                       | Vitest with coverage report                                          |
| `npm run test:e2e`                            | Playwright end-to-end (local only — not part of CI)                  |
| `npm run db:start`                            | Start local Supabase stack                                           |
| `npm run db:stop`                             | Stop local Supabase stack                                            |
| `npm run db:reset`                            | Reset DB — drops state and reapplies init scripts                    |
| `npm run db:apply`                            | Apply declarative schemas + pgTAP + seed via psql                    |
| `./scripts/reset-remote-db.sh [prd\|stg]`     | TEMPORARY: wipe + re-seed a remote Supabase project via Doppler      |
| `npm run db:diff`                             | Generate a migration from declarative schema diffs                   |
| `npm run db:test`                             | Run pgTAP tests                                                      |
| `npm run functions:env`                       | Sync Doppler secrets into `supabase/.env` for the local edge runtime |
| `npm run functions:serve`                     | Sync env, then `supabase functions serve` (run in a second terminal) |
| `npm run gen:types`                           | Regenerate `src/types/database.types.ts`                             |
| `npm run simulate:community`                  | Replay a scripted realtime chat to 5 channels                        |
| `npx tsx scripts/snapshot-email-templates.ts` | Regenerate `supabase/email-templates/*`                              |

## Project structure

```
src/
  app/             Routing, providers, error boundary, layout, theme
    chrome/        App-shell pieces: header, footer, language picker, terminal header
  components/      Primitives shared across 3+ features (or app shell + a feature)
    ui/            shadcn-generated atoms (untouched)
    terminal/      Branded terminal-aesthetic primitives (TerminalEyebrow, TerminalResults)
  features/        Feature-sliced modules
    admin/         One subfolder per admin tool
      api/         Supabase wrappers
      agenda/      Agenda admin, session dialog, agenda CSV
      conflicts/   Data-conflict resolution screen + panel
      documents/   Document admin + dialog
      events/      Event editor + domain allow-list
      feed/        Editorial feed admin
      ground-transport/  Transport tool (vehicles, passengers)
      invitations/ Invite-attendee screen + dialog
      nudges/      Nudge composer + history
      reports/     Reports screen + per-report fetchers + CSV
      room-assignment/   Room-block import + assignment UI
      scan/        QR scanner screen + payload parser
      stats/       Charts dashboard
      swag/        Swag admin + size templates
      tags/        Tag editor dialog
    agenda/        Public agenda (sessions, proposals, tags)
    auth/          AuthProvider, RequireAuth, SignInScreen, CLI OAuth
    cli/           Command palette + command output + terminal hook
    community/     Profiles, channels, iMessage chat, world map, photos
    documents/     Consent gate, documents tab, audit trail
    events/        useActiveEvent, EventCountdown, /all-events gallery
    guests/        Invitation accept screen, edge-function bindings
    home/          Home dashboard, jet-lag fighter, editorial feed, memories preview
    itinerary/     Personal schedule + offline + QR check-in
      api/         Items + import sub-modules
    notifications/ Bell + dropdown + read state
    profile/       Profile screen + API keys
    registration/  Wizard shell + sections (personal info, dietary, ...)
    welcome/       Logged-out hero
    errors/        NotFound
  hooks/           Hooks shared by 3+ features
  lib/             Cross-cutting utilities
    cli/           CLI dispatcher + command registry
    email/         Shared transactional email theme + templates
    integrations/  Resend, Stripe, OpenAI, HiBob, Slack, ... (graceful when unkeyed)
    edgeFunction.ts callEdgeFunction<T> wrapper with consistent error model
    formatters.ts   Cached Intl.DateTimeFormat helpers
    i18n.ts        i18next setup
    supabase.ts    Singleton client
    theme.ts       Theme tokens + persistence
    timeOfDay.ts   Logged-out hero day/night background selector
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

### Where things live

Each `features/<x>/` folder owns its UI, hooks, and Supabase calls. `src/components/` holds primitives shared by 3+ features (or by app shell + a feature). `src/components/ui/` holds shadcn primitives untouched. `src/app/` holds the router, providers, layout, and chrome (header, footer, language picker). `src/lib/` holds cross-cutting utilities (Supabase client, i18n, formatters, the CLI library). `src/hooks/` holds hooks shared by 3+ features. Tests sit next to the file under test.

Conventions: folder names are kebab-case (single words are fine); component files are PascalCase, hooks and utilities are camelCase; inner `components/` subfolders only when the feature has 10+ component files or the subfolder has a real semantic name (`sections/`, `person/`, `photos/`); `api.ts` for single-resource features and `api/<resource>.ts` once a feature touches three or more distinct tables.

## Routing map

| Path                          | Auth         | Purpose                                                      |
| ----------------------------- | ------------ | ------------------------------------------------------------ |
| `/sign-in`                    | public       | Dual-tab sign-in (employee SSO / guest password)             |
| `/accept-invitation`          | public       | Guest accepts a 7-day signed invitation token                |
| `/share/reports/:token`       | public token | Read-only report shared with hotels / bus operator           |
| `/`                           | required     | Home dashboard with feed, countdown, jet-lag, facts          |
| `/all-events`                 | required     | Event gallery with per-browser event override                |
| `/registration`               | required     | Wizard router (jumps to next pending step)                   |
| `/registration/:stepPath`     | required     | Personal info, dietary, accessibility, passport, swag, ...   |
| `/consent`                    | required     | Consent gate for documents requiring acknowledgement         |
| `/documents`                  | required     | Read-only document library with version status               |
| `/documents/:documentId/sign` | required     | Sign or re-acknowledge a document                            |
| `/documents/new`              | admin        | Admin create flow                                            |
| `/itinerary`                  | required     | Personal schedule with offline cache + QR check-in           |
| `/agenda`                     | required     | Public session agenda with day picker                        |
| `/community`                  | required     | World map + matches + channel list                           |
| `/community/channels/:slug`   | required     | iMessage-style channel with realtime + typing                |
| `/profile`                    | required     | Profile editor with left-nav sections (personal, community…) |
| `/admin/*`                    | admin only   | Reports, conflicts, stats, agenda, feed, nudges, documents   |
| `*`                           | public       | Not Found                                                    |

Routes other than `/sign-in`, `/accept-invitation`, and `/share/*` show the `AppHeader` and `AppFooter`. Logged-out visitors see no chrome regardless of route.

## Database

48 tables defined declaratively in `supabase/schemas/`. RLS is enabled on every table by a single `do $$ ... loop ... execute format(...) ... end $$` block at the top of `90_rls.sql`; the service-role key never touches client code. To verify the count yourself: `grep -c '^create table' supabase/schemas/*.sql`.

### Why declarative schemas instead of timestamped migrations

Schemas live as plain SQL files under `supabase/schemas/` (`00_extensions.sql`, `10_enums.sql`, `20_identity.sql`, ...). `npm run db:apply` re-applies every file in alphabetical order against a clean database. There are **no** `supabase/migrations/*.sql` files in this repo. The trade-off:

- **Pro:** the schema is the single source of truth. A diff between two branches is a diff of the schema files. New developers read a small handful of well-named files instead of replaying a hundred migrations.
- **Pro:** every reset starts from a known-good state. CI's pgTAP run never inherits drift.
- **Con:** to push a schema change to a hosted Supabase project, you generate a migration with `npm run db:diff -f <name>` and apply it with `supabase db push`. The diff is the deploy artefact.

This pattern is documented in `supabase/schemas/README.md`. It's a deliberate fit for an app where the schema is the load-bearing primitive — not where the data is.

### Why a JWT custom claim for `app_role`

Supabase Auth issues JWTs with a top-level `role` claim that maps to a Postgres role (`anon` / `authenticated` / `service_role`). RLS policies that say `using (auth.role() = 'authenticated')` rely on that claim staying intact. Kizuna needs **four** application-level roles — `employee`, `guest`, `admin`, `super_admin` — and they're orthogonal to the Postgres role mapping.

The fix: a Custom Access Token Hook (`supabase/schemas/85_auth_hooks.sql` and `[auth.hook.custom_access_token]` in `supabase/config.toml`) injects `app_role` and `is_leadership` claims from `public.users` into every JWT. RLS policies read them through `public.auth_role()` (which decodes `auth.jwt() ->> 'app_role'`) and `public.is_leadership_user()`. The standard `role` claim stays `authenticated`/`anon`, so Postgres role permissions still work.

### Why Supabase Vault for secrets

The `pgcrypto` symmetric key for passport-number encryption (`KIZUNA_PASSPORT_KEY`) is stored in **Supabase Vault**, not as a database GUC, environment variable, or hard-coded fixture. The encryption RPC (`public.set_passport`) reads the key via `vault.create_secret`/`vault.read_secret` so:

1. The key never appears in `pg_settings`, `pg_stat_activity`, or any logfile a `service_role` query might capture.
2. The key never ships in `.env.example` or any tracked file.
3. Rotating the key is a matter of writing a new vault secret and updating the function reference — no schema change, no service restart.

The same pattern would apply to any other server-side secret (HMAC keys, API tokens) that can't go in env. For SPA-visible config (`VITE_*`), env is fine; for cron-job secrets and crypto keys, Vault.

### Highlights

- **Identity** — `users`, `employee_profiles`, `guest_profiles`, `guest_invitations`, `additional_guests`, `accessibility_preferences`, `emergency_contacts`. `users.is_leadership` is a boolean flag (orthogonal to role) writable only by admins via the `users_leadership_change_guard` trigger and `set_user_leadership` RPC.
- **Registration** — `registrations` + `registration_tasks` (the trigger-maintained `completion_pct` lives here), `passport_details` (encrypted via pgcrypto, no admin SELECT policy), `dietary_preferences`.
- **Logistics** — `flights`, `accommodations`, `accommodation_occupants`, `transport_requests`, `transport_vehicles`, `swag_sizes` (polymorphic on `user_id` OR `additional_guest_id`).
- **Events** — `events`, `sessions`, `session_registrations`, `session_favorites`, `dinner_seating`, `itinerary_items` (materialised by triggers).
- **Documents** — `documents`, `document_acknowledgements` (legal audit trail with scrolled / explicit / device-type signals).
- **Community** — `attendee_profiles` (bio, hobbies, hometown, current city), `channels` (slug + name + creator), `messages` (channel slug routing key + soft delete + edited_at), `hobby_catalog` (curated typeahead seeds), `votes`.
- **Infra** — `report_snapshots` (signed share tokens), `notifications` (with `read_at` + RPCs), `data_conflicts`, `hibob_sync_log`, `feed_items`.

The `[auth.hook.custom_access_token]` hook in `supabase/config.toml` injects an `app_role` and `is_leadership` JWT claim from `public.users` so RLS policies can read them without conflicting with Supabase's standard `authenticated` / `anon` mapping.

## Storage layout

Four buckets, all private — clients use `createSignedUrl` for display. Identity content (`avatars`) is keyed on `user_id`; everything else is keyed on `event_id` via the leading path segment, _not_ per-event buckets. The four-bucket / path-prefix split keeps RLS in one place and lets the same employee carry their avatar across many events.

```
avatars/                                 # identity-scoped, cross-event
  <user_id>/
    avatar.<ext>

event-content/                           # admin-managed branding + editorial
  <event_id>/
    about/
      logo.<ext>                         # events.logo_path
      cover.<ext>                        # events.hero_image_path
    feed/
      <feed_item_id>/
        <file>                           # feed_items.image_path

documents/                               # admin-uploaded PDFs
  <event_id>/
    <document_id>.pdf                    # documents.pdf_path

community-media/                         # user-uploaded chat + gallery
  <event_id>/
    chats/
      <channel_slug>/
        <message_id>/
          <file>                         # messages.media_url
    gallery/
      <user_id>/
        <media_item_id>/
          <file>
```

RLS lives in `supabase/schemas/95_storage.sql`. Three of the four buckets share the helper `public.storage_caller_can_read_event(name)` which extracts the leading path segment, casts to `uuid`, and returns true iff the caller is admin OR registered for that event OR the event is `invite_all_employees=true` and the caller is an active employee. Writes are admin-only on `event-content` and `documents`; on `community-media` writes also enforce the gallery sub-folder match against `auth.uid()`. pgTAP coverage is in `supabase/tests/storage__rls.sql`.

**Adding a new bucket?** Mirror the helper + policy block at the top of `95_storage.sql`, document the path shape in this README, in CLAUDE.md, and in AGENTS.md, and add a pgTAP file under `supabase/tests/storage__*.sql` covering at minimum: admin write, non-admin write rejected, and a registered-vs-outsider read pair.

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

i18n is i18next + react-i18next with `en-US` as the source-of-truth locale. Eight locales ship: `en-US`, `de-DE`, `es-ES`, `fi-FI`, `fr-FR`, `it-IT`, `pt-BR`, `pt-PT`. en-US is the fallback; missing keys in any other locale fall through. The footer flag dropdown enumerates whatever locales `i18n.ts` exposes.

Adding or expanding a language:

1. Open `src/locales/<lang>/common.json` (or create one mirroring `en-US/common.json`)
2. Run `tsx scripts/check-locale-parity.ts` to list missing keys against en-US
3. Add the locale to `SUPPORTED_LOCALES` in `src/lib/i18n.ts` if new, and register it in `resources`

Every visible string flows through `t()` — there is no raw English in JSX. Locale parity is checked in CI via `npm run i18n:check`.

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

Plus a handful of guest invitations (now carrying age bracket + fee), dietary preferences, accessibility notes, and emergency contacts. Eight people are flagged as leadership (the C-suite plus department heads).

`supabase/fixtures/02_sample_community.sql` adds attendee_profiles (bios, hobbies, hometowns, current cities, ground-transport need) for 14 of the seeded users, five user-created channels, and starter messages so the channel list looks alive on first load.

`supabase/fixtures/03_sample_itineraries.sql` seeds 12 inbound + 12 outbound flights spread across 9 arrival windows. Multiple cities map to the same flight tuple so the Ground Transport Tool's same-flight grouping has real demo content.

All three files are applied automatically by `npm run db:apply`. Every fictional account uses the password `kizuna-dev-only`.

### Pushing sample data to staging or production

`scripts/reset-remote-db.sh` is a TEMPORARY launch-window utility that drops the remote `public` schema, re-applies declarative schemas, and re-seeds. It reads every credential from Doppler so nothing lands on disk.

```bash
# Defaults to --config prd
./scripts/reset-remote-db.sh

# Target staging
./scripts/reset-remote-db.sh stg

# Skip the "type RESET to confirm" prompt (use carefully)
./scripts/reset-remote-db.sh prd --yes
```

Prerequisites in the chosen Doppler config: `VITE_SUPABASE_URL`, `SB_DB_PASSWORD` (find under Settings → Database in the Supabase dashboard), and optionally `SB_DB_REGION` (defaults to `us-east-1`). Doppler reserves the `SUPABASE_` prefix for its native sync target, so the secrets we own use the `SB_` prefix. Delete this script once Phase 1 launch is settled.

After resetting + re-seeding the remote DB, re-create the seeded auth users via the Admin API so they can actually sign in with the dev password:

```bash
npm run seed:remote-users -- stg     # or prd
```

Hosted Supabase rejects auth.users rows whose `encrypted_password` was inserted via raw SQL `crypt(...)`. The seed script uses `@supabase/supabase-js`'s Admin API and consumes `VITE_SUPABASE_URL` + `SB_SECRET_KEY` from the named Doppler config. Idempotent — existing users get their passwords reset; missing users are created.

## Testing

| Layer                    | Tool                                      | Run                                                              |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------- |
| Unit & component         | Vitest + React Testing Library + jest-dom | `npm run test:run`                                               |
| End-to-end               | Playwright (Chrome + mobile Pixel 7)      | `npm run test:e2e` (local only — see CI note in Common commands) |
| Database (RLS, triggers) | pgTAP                                     | `npm run db:test`                                                |
| Network mocking          | MSW                                       | imported per-test                                                |

Test counts move every commit, so the badge of truth is CI rather than this README. Vitest covers pure helpers, API wrappers, and component smoke paths. pgTAP covers RLS (including the admin-read policy on attendee_profiles), leadership-flag guard, channel ownership, passport encryption, registration completion trigger, itinerary materialisation, channel access control, the flight-change cascade that unassigns vehicles, the guest age-bracket pricing + payment gate, and the delete-event cascade. The repo follows a strict TDD bias: tests for pure helpers go in before the component or feature that consumes them.

The project also enforces a no-`useEffect` discipline for data fetching and state derivation. See `~/.claude/skills/no-use-effect/SKILL.md` and `tasks/lessons.md` for the rule and the five replacement patterns.

## Testing the CLI and MCP server locally

Kizuna ships an agent surface that runs end-to-end against your local Supabase stack — no npm publish required, no production project needed. Three pieces:

- **`supabase/functions/cli/`** — the HTTP edge function that authenticates a PAT and dispatches commands.
- **`packages/kizuna-cli/`** — a Node bin (`kizuna`) with login, logout, whoami, and pass-through for any registered command.
- **`packages/kizuna-mcp/`** — an MCP server that bridges the registry to Claude Desktop, Cursor, or Claude Code.

### 1. Start the stack

```bash
supabase start                    # Postgres + Auth + Storage + Edge runtime
npm run db:apply                  # schemas + pgTAP + seed + sample fixtures
supabase functions serve --env-file supabase/.env --no-verify-jwt
```

`--no-verify-jwt` lets the function accept a PAT in the Authorization header. The function still verifies the PAT against Postgres via `verify_api_key`; it just skips Supabase's anon-key gate for local dev.

### 2. Issue a personal access token

In a separate browser, sign in to the running app at <http://localhost:5173>, then:

1. Open `/profile/api-keys`
2. Click **Create API Key**, pick a scope (`read` is enough for read commands), and submit.
3. Copy the token from the one-time reveal dialog. The token starts with `kzn_`.

If you'd rather skip the dashboard and exercise the OAuth flow, see "Bootstrap via OAuth" below.

### 3. Try the local CLI without installing it

```bash
# From the repo root, with @strategicnerds/kizuna-cli installed via npm install:
node --experimental-strip-types packages/kizuna-cli/src/bin/kizuna.ts \
  login --url http://127.0.0.1:54321 --paste <kzn_...> --state manual

# Or use tsx if you'd rather:
npx tsx packages/kizuna-cli/src/bin/kizuna.ts login \
  --url http://127.0.0.1:54321 --paste <kzn_...> --state manual

# Run a real command:
npx tsx packages/kizuna-cli/src/bin/kizuna.ts me itinerary --format md
```

Or `npm link` the package once and the `kizuna` binary lives on your PATH for the duration of the link:

```bash
cd packages/kizuna-cli && npm link
kizuna login --url http://127.0.0.1:54321 --paste <kzn_...> --state manual
kizuna me itinerary --format md
cd ../.. && npm unlink kizuna   # remove the link when done
```

The `--paste`/`--state` form is the manual fallback. The full OAuth dance runs without those flags:

```bash
kizuna login --url http://127.0.0.1:54321 --scope read
# Browser opens to /cli/oauth-authorize. After clicking Authorize, the
# callback page POSTs the code to a localhost server the CLI binds for
# this run. The token lands in ~/.kizuna/config.json (chmod 0600).
```

### 4. Try the local MCP server

The MCP server is a separate npm package. Point it at your local Kizuna and a PAT:

```bash
KIZUNA_URL=http://127.0.0.1:54321 \
KIZUNA_TOKEN=kzn_read_xxxxxx \
npx tsx packages/kizuna-mcp/src/bin/kizuna-mcp.ts
```

Wire it into Claude Desktop by editing `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kizuna-local": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/kizuna/packages/kizuna-mcp/src/bin/kizuna-mcp.ts"],
      "env": {
        "KIZUNA_URL": "http://127.0.0.1:54321",
        "KIZUNA_TOKEN": "kzn_read_xxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop. Kizuna's tools (`kizuna_me`, `kizuna_attendees`, `kizuna_me_itinerary`, etc.) appear in the tool picker. Each tool's input schema is generated from the registry's zod schemas, so the agent sees structured arguments rather than a raw CLI string.

### 5. Verify the wiring

A quick smoke test once everything is live:

```bash
# Should return the schema as JSON.
kizuna schema | head -40

# Should return your profile.
kizuna me

# Should produce Markdown.
kizuna me itinerary --format md
```

Errors come back as `{ "ok": false, "error": { "code": "...", "message": "..." } }` with a `request_id` for cross-referencing the edge function logs.

### 6. Run the test suites

```bash
npm run test:run                   # vitest (registry, parser, dispatcher, every command)
deno test supabase/functions       # edge function contract tests
supabase test db                   # pgTAP for api_keys, oauth_codes, cli_audit_log
```

The CLI does not need to be published to npm to be exercised — `npm link`, `tsx`, or a direct `node` invocation are all first-class paths during development.

## Deployment

Phase 1 ships locally. Production deploys land with M10:

- Vercel for the web bundle (`vercel.json` already locked: SPA rewrites, HSTS, X-Frame-Options DENY, Permissions-Policy, asset cache headers)
- Supabase Cloud for the backend (GitHub Actions to run `supabase db push` on merge)
- Vault-stored integration secrets

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — agent rules and architectural invariants
- [`TECH_DEBT_AUDIT.md`](./TECH_DEBT_AUDIT.md) — current rolling audit of debt + status
- [`docs/github-setup.md`](./docs/github-setup.md) — repo + CI setup checklist
- [`tasks/todo.md`](./tasks/todo.md) — milestone tracker
- [`tasks/lessons.md`](./tasks/lessons.md) — patterns we keep re-discovering
- [`supabase/schemas/README.md`](./supabase/schemas/README.md) — declarative schema workflow
- [`supabase/tests/README.md`](./supabase/tests/README.md) — pgTAP conventions
- [`supabase/email-templates/README.md`](./supabase/email-templates/README.md) — email template workflow

---

Built with care for the Supabase team. Open-source release planned post-Supafest 2027.
