# Kizuna - Claude Code Project Instructions

> Kizuna (絆) is the event and community platform powering Supafest, Supabase's annual company retreat. Built natively on Supabase, intended to be open-sourced as a showcase of the product itself.

## North Star

**Phase 1 deadline: 2026-08-01.** This is the date by which the registration cycle must begin. Hard deadline.

**Quality bar:** This codebase will be reviewed by peers. The author wants to earn the trust and respect of the Supabase engineering org. Every line should be defensible. Idiomatic Vite, idiomatic Supabase, idiomatic React 18.

## The 5C framework

Every design decision should map to one of these:

- **Connection** — profiles, people-matching, chat, world map
- **Collaboration** — session voting, breakout sign-ups, shared planning
- **Clarity** — itinerary, tasks, document sign-offs
- **Commitment** — deadlines, nudges, year-over-year continuity
- **Celebration** — photos, gamification, leaderboards, recognition

## Tech stack (locked)

- **Frontend:** Vite 5 + React 18 + TypeScript (strict) + Tailwind CSS 3 + shadcn/ui (New York)
- **Routing:** React Router v6
- **State:** TanStack Query (server) + Zustand (local, sparingly)
- **Forms:** react-hook-form + zod
- **PWA:** vite-plugin-pwa with Workbox (precache + stale-while-revalidate)
- **i18n:** i18next + react-i18next (English-US default; structured for additional locales)
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Schema management:** Declarative schemas in `supabase/schemas/` (NOT timestamp migrations)
- **Testing:** Vitest + React Testing Library + jest-dom (unit/component) · Playwright (E2E) · pgTAP (database) · MSW (API mocking)
- **Deploy:** Vercel (web) + Supabase Cloud (backend, later via GitHub Actions)

## Non-negotiable rules

### TDD is non-negotiable

Tests before code. Period. Database policies and triggers get pgTAP tests first. Components get Vitest tests first. End-to-end flows get Playwright tests.

### RLS on every table

All 35 tables have RLS enabled. The application layer cannot bypass policies. Role claims read from the JWT issued by Supabase Auth. **Never** use the service role key in client code.

### Never silently overwrite synced data

Every field originating from HiBob or Perk carries `field_source` and `field_locked` companion columns. User overrides write to `data_conflicts` for admin review. This is the spine of the integration story.

### Localize all strings

No raw English in JSX. Every user-visible string flows through `t()`. Locale files live in `src/locales/<lang>/<namespace>.json`. Default and fallback: `en-US`.

### Fail gracefully without integration credentials

HiBob, Perk, Slack, Stripe, Resend, Notion — all integrations must run in two modes:

1. **Live** — credentials present in env, real API calls
2. **Stubbed** — credentials missing, integration code returns deterministic mock responses, logs a warning, never throws

This lets us build the entire app locally without any third-party setup.

### Encrypt passport numbers at rest

`passport_details.passport_number` uses `pgcrypto.pgp_sym_encrypt`. There is **no admin SELECT policy** on `passport_details` — admins literally cannot read passport numbers. Only the owning user can decrypt their own row.

## Repository layout

```
kizuna/
├── src/                    # Vite React PWA
│   ├── app/                # Routing, layouts, providers
│   ├── components/         # Shared UI (shadcn primitives + composed)
│   │   ├── ui/             # shadcn/ui generated components
│   │   └── ...             # Domain components
│   ├── features/           # Feature-sliced (registration, itinerary, admin, …)
│   │   └── <feature>/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── api/        # Supabase client wrappers
│   │       └── *.test.tsx
│   ├── lib/                # Cross-cutting utilities (supabase client, i18n, dates)
│   ├── locales/            # i18n resource files
│   │   └── en-US/
│   ├── styles/
│   └── types/              # Generated Supabase types live here
├── supabase/
│   ├── schemas/            # Declarative schemas (table + policy + trigger SQL)
│   ├── tests/              # pgTAP tests
│   ├── functions/          # Edge functions (Deno/TS)
│   └── seed.sql            # Local development seed data
├── tests/
│   └── e2e/                # Playwright specs
├── public/                 # Static assets, favicon, manifest
├── .github/workflows/      # CI (typecheck, lint, test, e2e)
├── tasks/
│   ├── todo.md             # Source of truth for milestone tracking
│   └── lessons.md          # Rolling log of corrections and patterns
└── CLAUDE.md               # This file
```

## Development workflow

### Starting a session

1. Read `CLAUDE.md` (this file)
2. Read `tasks/todo.md` to see the current milestone
3. Read `tasks/lessons.md` for any corrections from prior sessions
4. Run `npm install` then `supabase start` to spin up local Postgres

### Common commands

```bash
npm run dev               # Vite dev server (http://localhost:5173)
npm run build             # Production build
npm run preview           # Preview production build locally
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run lint:fix          # ESLint with autofix
npm run format            # Prettier write
npm test                  # Vitest in watch mode
npm run test:run          # Vitest single run
npm run test:coverage     # Vitest with coverage
npm run test:e2e          # Playwright
supabase start            # Start local Supabase
supabase db reset         # Re-apply schemas + seed
supabase db diff          # Generate migration from declarative schemas
supabase test db          # Run pgTAP tests
npm run gen:types         # Generate TypeScript types from local Supabase
```

### Definition of done (per milestone)

A milestone is **not** complete until all of these pass:

1. `npm run typecheck` — zero errors, zero `any`
2. `npm run lint` — zero errors, zero warnings
3. `npm run test:run` — all unit/component tests passing
4. `supabase test db` — all pgTAP tests passing (when DB changes)
5. `npm run test:e2e` — relevant E2E specs passing
6. `npm run build` — clean production build
7. `/simplify` skill run, all findings addressed
8. `/clean-and-refactor` skill run, all findings addressed
9. Single commit with message in present tense

## Design system notes

- shadcn/ui components live in `src/components/ui/`. Generated via `npx shadcn add <component>`.
- All theming via CSS variables in `src/styles/globals.css`. A designer can re-skin without touching component code.
- Copy lives in i18n files, not JSX. A designer can rewrite labels without touching code.
- Spacing, radius, motion all flow through Tailwind tokens. Easy to override in `tailwind.config.ts`.
- For non-trivial visual work, invoke the `frontend-design` skill.
- **TODO:** wire up Paper MCP when available for design-tool integration.

## Notes for future Claude sessions

- This project is autonomous-build-friendly. The main agent should commit aggressively at milestone boundaries and run `/simplify` + `/clean-and-refactor` between milestones.
- Use subagents liberally to keep main context clean. Delegate research, exploration, and parallel tasks.
- After **every** correction from the user, append a rule to `tasks/lessons.md`.
- The user is non-technical but cares deeply about quality. When in doubt, choose the option a staff engineer would defend in code review.
