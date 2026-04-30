# Kizuna

> Kizuna (絆) — an enduring bond. The event and community platform powering Supafest, built natively on Supabase.

This repository is intended to be open-sourced as a showcase of Supabase. While it powers our internal events, the architecture, schema, and patterns are designed to serve any organization running gatherings of any scale.

## What this is

Kizuna replaces a stack of Notion, Slack, WhatsApp, Google Sheets, and email with a single mobile-first Progressive Web App that handles every aspect of running an event:

- Registration with consent gating, dietary preferences, passport details, and dependents
- Personal itinerary with offline cache for low-signal venues
- Real-time chat, photo sharing, and people-matching
- Admin dashboard with live shareable reports for hotels and transport providers
- HiBob/Perk/Stripe/Slack/Resend/Notion integrations with conflict-aware sync
- Full legal audit trail for every consent and document acknowledgment

## Tech stack

| Layer    | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Frontend | Vite + React 18 + TypeScript (strict)                        |
| Styling  | Tailwind CSS 3 + shadcn/ui (New York)                        |
| State    | TanStack Query · Zustand                                     |
| Forms    | react-hook-form + zod                                        |
| i18n     | i18next + react-i18next                                      |
| PWA      | vite-plugin-pwa with Workbox                                 |
| Backend  | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Schema   | Declarative SQL in `supabase/schemas/`                       |
| Tests    | Vitest · React Testing Library · Playwright · pgTAP · MSW    |
| Deploy   | Vercel (web) · Supabase Cloud (backend)                      |

## Local setup

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker Desktop (for `supabase start`)

### First run

```bash
git clone <this-repo> kizuna
cd kizuna
cp .env.example .env

# Start the local Supabase stack (Postgres, Auth, Storage, ...).
# This prints a publishable key (sb_publishable_*) — copy it into .env.
supabase start

# Apply the declarative schemas to the local DB.
npm install
npm run db:apply
npm run gen:types

# Run the app.
npm run dev
```

The app is now live at <http://localhost:5173>.

### Common scripts

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Vite dev server on port 5173                            |
| `npm run build`         | Production build                                        |
| `npm run preview`       | Preview the production build locally                    |
| `npm run typecheck`     | `tsc --noEmit` across the whole project                 |
| `npm run lint`          | ESLint over `src` and `tests`                           |
| `npm run lint:fix`      | ESLint with autofix                                     |
| `npm run format`        | Prettier write                                          |
| `npm run test`          | Vitest in watch mode                                    |
| `npm run test:run`      | Vitest single run (used in CI)                          |
| `npm run test:coverage` | Vitest with coverage report                             |
| `npm run test:e2e`      | Playwright end-to-end                                   |
| `npm run db:start`      | Start local Supabase stack                              |
| `npm run db:stop`       | Stop local Supabase stack                               |
| `npm run db:reset`      | Reset DB — applies migrations + seed                    |
| `npm run db:apply`      | Apply declarative schemas directly via psql (fast loop) |
| `npm run db:diff`       | Generate a migration from declarative schema diffs      |
| `npm run db:test`       | Run pgTAP tests                                         |
| `npm run gen:types`     | Regenerate `src/types/database.types.ts`                |

## Project structure

```
src/
  app/             Routing, providers, error boundary
  components/      Shared UI (shadcn primitives + composed)
    ui/            shadcn-generated atoms
  features/        Feature-sliced modules
  lib/             Cross-cutting utilities (supabase, i18n, env, helpers)
  locales/         i18n resource files (en-US default)
  styles/          Tailwind + CSS variables
  test/            Test setup and helpers
  types/           Generated Supabase types
supabase/
  schemas/         Declarative SQL — source of truth for the DB
  tests/           pgTAP tests
  functions/       Edge functions (Deno/TS)
  seed.sql         Local development seed
tests/
  e2e/             Playwright specs
```

## Localization

All visible strings flow through `t()`. Locale files live in
`src/locales/<lang>/<namespace>.json`. The default and fallback is `en-US`.
Adding a new language is a matter of creating the directory and registering
the resource in `src/lib/i18n.ts`.

## Theming for designers

Every visual token lives as a CSS variable in `src/styles/globals.css`. A
designer can re-skin Kizuna without touching component code: change the HSL
values for `--primary`, `--background`, `--radius`, etc.

## Integrations and graceful degradation

HiBob, Perk, Slack, Stripe, Resend, Notion, and Okta integrations all run in
two modes:

1. **Live** — credentials present in env, real API calls
2. **Stubbed** — credentials missing, integration returns deterministic mock
   responses, logs a warning, never throws

This means the entire app can be built and tested locally without any
third-party setup. See `src/lib/integrations/` (added in M5+) for the
implementation.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — agent instructions and architectural rules
- [`tasks/todo.md`](./tasks/todo.md) — milestone tracker
- [`tasks/lessons.md`](./tasks/lessons.md) — accumulated lessons and corrections

## Contributing

This is an early-stage internal project being built toward an open-source
release. Issues and PRs are welcome once we make the repo public.

## License

To be determined.
