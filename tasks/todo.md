# Kizuna - Implementation Plan

> **Phase 1 deadline: 2026-08-01**
> Today: 2026-04-30 → 13 weeks runway

This is the source of truth for milestone tracking. Update inline as work progresses. After each milestone: commit, run `/simplify` and `/clean-and-refactor`, fix findings, then move on.

## Phase 1 milestones

### M0 - Foundation [complete]

**Goal:** Working repo with Vite + React + TS + Tailwind + shadcn + i18n + PWA + Vitest + Playwright + local Supabase + CI scaffolding.

- [x] Repo init (git, .gitignore, README)
- [x] package.json with dependencies scoped to actual usage
- [x] Vite + React 18 + TypeScript strict (with exactOptionalPropertyTypes, noUncheckedIndexedAccess)
- [x] Tailwind 3 configured
- [x] shadcn/ui initialized (New York, slate base, cssVariables)
- [x] vite-plugin-pwa with Workbox precache + cache-first for static assets
- [x] React Router v6 with welcome and not-found routes
- [x] TanStack Query in providers
- [x] i18next + react-i18next configured (en-US default)
- [x] @supabase/supabase-js client wrapper (singleton)
- [x] Vitest + RTL + jest-dom setup with renderWithProviders helper
- [x] Playwright setup with smoke E2E spec
- [x] ESLint + Prettier with TypeScript strict rules
- [x] Supabase local CLI initialized
- [x] `supabase/schemas/` declarative directory with extension setup
- [x] `supabase/tests/` pgTAP scaffold
- [x] Seed data scaffold
- [x] GitHub Actions: typecheck + lint + format + test + build + e2e
- [x] CLAUDE.md, tasks/todo.md, tasks/lessons.md
- [x] code-simplifier and refactor-scan run, all critical/suggested findings addressed
- [x] First commit: `chore: scaffold project foundation`

**M0 review:**
- Quality gates green: typecheck, lint, 5/5 vitest, 2/2 playwright, format, build (275 KB JS gzipped 88 KB).
- Refactor-scan flagged 11 unused production deps (now removed; will be added back per-feature), tsconfig.node.json strictness gap (fixed), QueryClient lifecycle in renderWithProviders (fixed), legacy withTranslation HOC in ErrorBoundary (refactored to functional ErrorFallback + class ErrorBoundary), speculative /api/itinerary cache (removed).
- Lessons captured in tasks/lessons.md.

### M1 - Database schema, RLS, triggers (TDD)

**Goal:** All 35 tables defined declaratively with full RLS, triggers, and pgTAP coverage. Type generation working.

- [ ] Enable extensions: pgcrypto, citext (if needed)
- [ ] Core identity: `users`, `employee_profiles`, `guest_profiles`, `guest_invitations`, `children`, `emergency_contacts`
- [ ] Registration: `registrations`, `registration_tasks`, `profile_custom_fields`, `profile_field_responses`, `passport_details`, `dietary_preferences`
- [ ] Logistics: `flights`, `accommodations`, `accommodation_occupants`, `transport_requests`, `transport_vehicles`, `swag_items`, `swag_selections`
- [ ] Events: `events`, `sessions`, `session_registrations`, `dinner_seating`, `itinerary_items`
- [ ] Reporting: `report_snapshots`
- [ ] Community: `attendee_profiles`, `messages`, `votes`
- [ ] Documents: `documents`, `document_acknowledgements`
- [ ] Infrastructure: `notifications`, `data_conflicts`, `hibob_sync_log`
- [ ] Enums: all role, status, source, type enums
- [ ] RLS policies on every table (per spec section 7)
- [ ] Trigger: `update_registration_completion()` on `registration_tasks`
- [ ] Trigger: flights → transport_requests `needs_review` cascade
- [ ] Triggers: itinerary_items materialisation (sessions, flights, transport, accommodations)
- [ ] Trigger: passport_number encryption on insert/update
- [ ] pgTAP tests for every RLS policy (positive + negative cases)
- [ ] pgTAP tests for every trigger
- [ ] Seed data: 1 event, ~5 employees, ~3 guests, ~10 sessions
- [ ] Type generation pipeline (`npm run gen:types`)
- [ ] Commit: `feat(db): declarative schema with full RLS and pgTAP coverage`

### M2 - Auth, identity, providers

**Goal:** Authenticated app shell with role-aware routing, employee SSO stub, guest email/password.

- [ ] Supabase client setup (browser-safe, anon key)
- [ ] AuthProvider with session management
- [ ] Employee SSO stub (graceful when no Okta keys)
- [ ] Guest email + password sign-in/sign-up
- [ ] Sign-out
- [ ] Protected route component (role-based)
- [ ] Welcome screen (role-aware)
- [ ] Role helpers (`useRole`, `requireRole`)
- [ ] Vitest coverage for auth utilities
- [ ] Playwright: auth happy path
- [ ] Commit: `feat(auth): role-aware authentication with SSO stub`

### M3 - Consent gate and document management

**Goal:** Consent gate with full legal audit trail, document versioning, re-acknowledgement on version bump.

- [ ] Document rendering (markdown via react-markdown)
- [ ] Scroll-to-bottom enforcement
- [ ] Explicit checkbox gate
- [ ] Audit trail capture (IP, UA, scrolled, explicit, device type)
- [ ] `document_acknowledgements` insert with version pinning
- [ ] Document version comparison hook
- [ ] Re-acknowledgement flow on version bump
- [ ] Documents tab (permanent reference)
- [ ] Vitest coverage for consent component
- [ ] Playwright: consent flow happy path + scroll-to-bottom enforcement
- [ ] Commit: `feat(consent): document gate with legal audit trail`

### M4 - Registration wizard

**Goal:** Multi-step registration for employee and guest paths, with custom fields and per-task progress tracking.

- [ ] Wizard shell with step navigation and progress
- [ ] Personal info step (with HiBob conflict UI)
- [ ] Dietary preferences
- [ ] Passport (encrypted, expiry warning)
- [ ] Emergency contact
- [ ] Children (age-driven meal tier)
- [ ] Swag selection (sizing, fit preferences)
- [ ] Transport requirements
- [ ] Custom fields (event-defined)
- [ ] Guest details (employee path)
- [ ] Per-task completion tracking
- [ ] Save and resume
- [ ] Vitest: each step component
- [ ] Playwright: full registration happy path
- [ ] Commit: `feat(registration): multi-step wizard for employees and guests`

### M5 - Guest invitation, payment, lifecycle

**Goal:** Guest invitation lifecycle with signed tokens, Stripe checkout, webhook reconciliation.

- [ ] Edge function: `create_guest_invitation` (signed JWT, 7-day expiry)
- [ ] Resend integration (graceful when no key) for invite email
- [ ] Guest accept page (token validation, account creation)
- [ ] Stripe checkout edge function (graceful when no key)
- [ ] Stripe webhook handler edge function
- [ ] Payment status updates → `guest_profiles`
- [ ] Receipt + confirmation email
- [ ] Sponsoring employee notification
- [ ] Vitest: invitation utilities, token validation
- [ ] Playwright: invitation accept flow
- [ ] Commit: `feat(guests): invitation lifecycle with stripe payment`

### M6 - Personal itinerary and offline

**Goal:** Personal itinerary screen, materialised query, offline cache via service worker, realtime version push.

- [ ] Itinerary screen (day grouping, sort by starts_at)
- [ ] Itinerary item rendering by `item_type`
- [ ] QR check-in code (signed JWT, cached offline)
- [ ] Workbox precache: itinerary, profile, documents
- [ ] Workbox runtime: stale-while-revalidate for static, cache-first for assets
- [ ] Realtime subscription on `itinerary_items` for current user
- [ ] Version-token push from Realtime → SW re-fetch
- [ ] Offline indicator
- [ ] Manual offline QA on real device
- [ ] Vitest: itinerary utilities, offline state
- [ ] Playwright: itinerary view, offline-mode smoke
- [ ] Commit: `feat(itinerary): personal schedule with offline cache`

### M7 - Admin dashboard and reports

**Goal:** Admin operations: live reports with shareable signed links, conflict resolution UI, CSV export.

- [ ] Admin layout shell
- [ ] Rooming list report
- [ ] Transport manifest
- [ ] Dietary summary
- [ ] Swag order
- [ ] Full registration report
- [ ] Payment reconciliation
- [ ] CSV export per report
- [ ] Shareable signed links (`report_snapshots.share_token`)
- [ ] Read-only public report view (token-gated)
- [ ] Conflict resolution UI (`data_conflicts`)
- [ ] Vitest: report utilities
- [ ] Playwright: admin report happy path
- [ ] Commit: `feat(admin): reports with shareable links and conflict resolution`

### M8 - HiBob and Perk sync

**Goal:** HiBob bidirectional sync, Perk CSV import, conflict tracking.

- [ ] Edge function: `sync_hibob` (graceful when no creds)
- [ ] HiBob webhook receiver
- [ ] Conflict detection: write to `data_conflicts` when `field_locked`
- [ ] Perk CSV upload UI (admin only)
- [ ] Edge function: `import_perk_csv`
- [ ] Flight change detection → `transport_requests.needs_review`
- [ ] `hibob_sync_log` reporting
- [ ] Manual sync trigger from admin dashboard
- [ ] Vitest: conflict detection logic
- [ ] Commit: `feat(sync): hibob and perk integrations with conflict tracking`

### M9 - Notifications

**Goal:** Slack DM (employees), Resend email (guests), nudge rate-limiting, deadline reminders.

- [ ] Edge function: `send_notification` (channel router)
- [ ] Slack DM API wrapper (graceful when no key)
- [ ] Resend templates: invite, waiver, confirm, payment, reminder, itinerary
- [ ] Nudge rate limiting (3 days per task)
- [ ] Cron edge function: deadline reminders
- [ ] In-app notification center
- [ ] `notifications` table append
- [ ] Vitest: rate limiting, channel routing
- [ ] Commit: `feat(notifications): slack and email with rate-limited nudges`

### M10 - Hardening and launch prep

**Goal:** Production-ready quality bar.

- [ ] Accessibility audit (WCAG 2.1 AA), axe-core in CI
- [ ] Performance pass (Lighthouse, bundle size)
- [ ] Security review (RLS verification via /verify-supabase)
- [ ] Load test: 800 user records, 50 sessions, 15k messages
- [ ] Error tracking integration (Sentry stub, graceful)
- [ ] Service worker production tuning
- [ ] README with setup, architecture, contribution guide
- [ ] Architectural Decision Records (ADRs) for key choices
- [ ] Open-source readiness checklist
- [ ] Final commit: `chore: production hardening for phase 1 launch`

## Phase 2-4 (post Phase 1)

- **Phase 2 (Oct-Nov 2026):** Community layer - profiles, matching, messaging, world map, Notion content sync
- **Phase 3 (Dec 2026-Jan 2027):** Engagement - voting, idea boards, SupaCup, surveys, gamification
- **Phase 4 (post-Supafest 2027):** Year-over-year continuity, Perk API (replaces CSV), Select/meetup support, OSS release

## Working agreements

- One commit per milestone (clean, atomic).
- Run `/simplify` and `/clean-and-refactor` between milestones, address all findings before next milestone.
- TDD: tests before code, always.
- No `any`. No raw English in JSX. No service role keys in client. No silent overwrites.
- Keep `tasks/lessons.md` current after every correction or surprising finding.

## Review log (filled in as milestones complete)

(empty - first entries land at M0 completion)
