# Kizuna - Implementation Plan

> **Phase 1 deadline: 2026-08-01**
> Today: 2026-04-30 → 13 weeks runway

This is the source of truth for milestone tracking. Update inline as work progresses. After each milestone: commit, run `/simplify` and `/clean-and-refactor`, fix findings, then move on.

## Pending: Paper design pass

Paper MCP hit its weekly limit on the first call (2026-04-30). When the user upgrades or the quota resets, run the Paper design work:

- All shipped screens at desktop (1440x900) and mobile (390x844)
- Currently shipped: SignInScreen, WelcomeScreen, ConsentGate, DocumentsTab, NotFound
- Mirror the CSS variables from src/styles/globals.css (Supabase green primary hsl(153 60% 53%), Inter font)
- Use the frontend-design skill for layout polish
- Keep the design easy for a designer to take over and refine

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

### M1 - Database schema, RLS, triggers (TDD) [complete]

**Goal:** 33 tables defined declaratively with full RLS, triggers, and pgTAP coverage. Type generation working.

- [x] Extensions: pgcrypto, citext
- [x] Enums for every role, status, source, type
- [x] Core identity: users, employee_profiles, guest_profiles, guest_invitations, children, emergency_contacts
- [x] Registration: registrations, registration_tasks, profile_custom_fields, profile_field_responses, passport_details, dietary_preferences
- [x] Logistics: flights, accommodations, accommodation_occupants, transport_requests, transport_vehicles, swag_items, swag_selections
- [x] Events: events, sessions, session_registrations, dinner_seating, itinerary_items
- [x] Reporting: report_snapshots
- [x] Community: attendee_profiles, messages, votes
- [x] Documents: documents, document_acknowledgements
- [x] Infrastructure: notifications, data_conflicts, hibob_sync_log
- [x] RLS policies on every table (62 policies via helpers `is_admin`, `is_self_or_admin`, `channel_has_access`)
- [x] Custom Access Token auth hook to inject `app_role` into JWT
- [x] Trigger: update_registration_completion() on registration_tasks
- [x] Trigger: flights → transport_requests needs_review cascade
- [x] Triggers: itinerary_items materialisation from sessions, flights, transport, accommodations
- [x] Functions: set_passport / get_passport_number with pgcrypto encryption
- [x] Trigger: touch_updated_at on all tables with updated_at columns
- [x] Unique constraint on itinerary_items(user_id, item_type, source_id) — fixes silent dedup bug caught by simplifier
- [x] pgTAP tests: 9 files, 25 assertions covering RLS, encryption, completion trigger, flight cascade, channel access, dedup, and constraints
- [x] Seed: 1 event, 4 employees + 1 guest, 5 sessions, 2 documents, 14 registration tasks
- [x] Type generation pipeline (npm run gen:types) — 1965-line database.types.ts
- [x] db:apply script handling schemas, pgTAP isolation, seed
- [x] code-simplifier and refactor-scan run, all critical/suggested findings addressed
- [x] Commit: `feat(db): declarative schema with full RLS and pgTAP coverage`

**M1 review:**
- 33 tables (spec lists "35" but two — photos, ideas — are P3 territory; deferred)
- 62 RLS policies, 18 triggers, 9 SQL functions
- pgTAP tests: 9 files, 25 assertions, all green
- Frontend gates green: typecheck, lint, 5/5 vitest, 2/2 playwright, build
- Bug found and fixed by simplifier: itinerary_items lacked unique constraint, so `on conflict do nothing` was a silent no-op. Added partial unique index on (user_id, item_type, source_id) where source_id is not null and updated triggers to reference it. Wrote regression test.
- Architectural decision: app role lives in JWT custom claim `app_role` (not `role`) so Supabase's standard `authenticated`/`anon` postgres role mapping continues to work. Custom Access Token hook reads from public.users.role.

### M2 - Auth, identity, providers [complete]

**Goal:** Authenticated app shell with role-aware routing, employee SSO stub, guest email/password.

- [x] Supabase client setup (singleton, publishable key)
- [x] AuthProvider with session management via onAuthStateChange (INITIAL_SESSION on mount)
- [x] AuthContext split out so AuthProvider only exports the component (react-refresh)
- [x] Employee SSO stub via signInWithSSO with Okta domain; graceful dev fallback to seeded employee credentials when keys absent
- [x] Guest email + password sign-in / sign-up via signInWithPassword + signUp
- [x] Sign-out (no double dispatch — onAuthStateChange handles state clear)
- [x] RequireAuth route guard with allow list, loading state, redirect with from-state
- [x] Welcome screen (role-aware, sign-out wired)
- [x] Role helpers: useRole, useIsAdmin, useIsSuperAdmin, hasRole
- [x] shadcn primitives: Input, Label
- [x] Sign-in screen with employee/guest tabs, sign-up toggle, error surface
- [x] Vitest: 14 tests across utils, hooks, sso, WelcomeScreen (with mocked client firing INITIAL_SESSION)
- [x] Playwright: 4 specs (smoke + auth)
- [x] code-simplifier and refactor-scan run, all critical/suggested findings addressed
- [x] Commit: `feat(auth): role-aware authentication with SSO stub`

**M2 review:**
- Architectural cleanups during refactor-scan: removed race between manual getSession() and onAuthStateChange (now listener-only), fixed wrong OAuth provider call (was 'azure', now signInWithSSO with Okta domain), removed double dispatch on signOut, surfaced loadAppUser errors via AuthState.error instead of swallowing into console.warn.
- renderWithProviders default flipped: withAuth now defaults to false to prevent test leakage of the Supabase singleton; tests opt in.
- Quality gates green: typecheck, lint, format, 14/14 vitest, 4/4 playwright, build.

### M3 - Consent gate and document management [complete]

**Goal:** Consent gate with full legal audit trail, document versioning, re-acknowledgement on version bump.

- [x] Document rendering (react-markdown + remark-gfm)
- [x] Scroll-to-bottom enforcement (pure isScrolledToBottom helper, tested)
- [x] Explicit checkbox gate (Radix-based shadcn Checkbox)
- [x] Audit trail capture: scrolled, explicit, deviceType (IP captured server-side)
- [x] document_acknowledgements upsert keyed on (user, event, doc_key, doc_version)
- [x] Document version comparison via fetchDocuments needsAcknowledgement field
- [x] Re-acknowledgement flow on version bump (tested via api unit test)
- [x] DocumentsTab (permanent read-only reference)
- [x] ConsentScreen + DocumentsScreen route wrappers reading active event
- [x] useActiveEvent hook
- [x] Vitest: 20 documents tests (deviceType, scroll, api, ConsentGate)
- [x] Playwright: route gating spec
- [x] code-simplifier run, findings addressed
- [x] Commit: `feat(consent): document gate with legal audit trail`

**M3 review:**
- 34 vitest tests across 8 files passing; 6 playwright specs passing
- ConsentGate enforces scroll-to-bottom AND explicit checkbox before submit; both signals plus device type travel to acknowledge() so the audit trail is complete
- Document version bump flow validated: when documents.version > latest acknowledgements row, needsAcknowledgement flips back to true
- Idempotent upsert lets us safely retry on network failures without creating duplicate acknowledgement rows

### M4 - Registration wizard [complete]

**Goal:** Multi-step registration for employees, with per-task progress tracking and idempotent save/resume.

- [x] Wizard shell with step navigation, Progress bar, and StepShell form chrome
- [x] PersonalInfo step (preferred_name, legal_name with user_entered source, base_city)
- [x] DietaryStep (restrictions, allergies, alcohol_free, severity, notes)
- [x] EmergencyContactStep
- [x] PassportStep using set_passport RPC (encrypted) + isExpiryRiskyForEvent helper (tested)
- [x] ChildrenStep (multi-row add/remove, special_needs)
- [x] SwagStep (per-item opt-in, sizing, fit preference)
- [x] TransportStep (transfer needs Y/N — actual transport_requests row gets materialised by Perk sync in M8)
- [x] Per-task completion via markTaskComplete; completion_pct maintained by Postgres trigger
- [x] Save and resume on every step (loadX → hydrate → saveX upsert)
- [x] Vitest: wizardSteps + expiryWarning helpers (47 total)
- [x] Playwright: route gating
- [x] Commits: feat(registration) part 1 + part 2

**Deferred from M4 (deliberately, not blockers for Phase 1 employee registration):**
- Custom fields step (profile_custom_fields driven, can be admin-only Phase 2)
- Guest details step (belongs with M5 invitation lifecycle)
- ChildrenStep marking a children-specific registration_task (would require enum extension)

**M4 review:**
- All gates green: typecheck, lint, format, 47/47 vitest, 8/8 playwright, build
- Pure helpers (wizardSteps, expiryWarning) tested in isolation
- exactOptionalPropertyTypes lessons captured in api.ts (conditional spread for id field)
- Each step hydrates from DB before allowing submit — prevents accidental empty overwrites

**M4.1 — Section unification (post-M4 dedup) [complete]:**
- Collapsed each registration domain into a single `Section` component used by both wizard and profile.
- New layer at `src/features/registration/sections/`: SectionChrome (mode-aware shell), useSectionSubmit (busy/error + toast vs markTaskComplete branching), and 7 sections (PersonalInfo, Dietary, EmergencyContact, Passport, Children, Swag, Transport).
- Deleted 7 *Step.tsx files and 3 *Card.tsx files.
- Bug fix that prompted the refactor: profile `EmergencyContactCard` and `DietaryCard` only rendered a subset of fields, so saving from profile silently nulled phone_secondary, notes, allergies, and severity. The unified Section captures the full schema.
- EditProfileScreen now mirrors all 7 wizard steps, delivering on "registration steps all need to be reflected in profile".
- 105/105 vitest, lint clean, typecheck clean.

**M4.2 — Identity, profile, accessibility, openai, api split [complete]:**
- Renamed `children` table → `additional_guests`, replaced date_of_birth with age int, dropped child_meal_tier enum.
- Profile collapse: `/profile` now renders the editor directly (no more `/profile/edit`). Avatar in header.
- New AccessibilitySection (mobility, vision, hearing, neurodivergent, chronic, other) inserted after Dietary in the wizard and present on Profile. accessibility_preferences table + RLS + i18n.
- registration api.ts split into per-domain files under `api/` with an index.ts barrel (was 380 lines).
- OpenAI integration scaffold (graceful stub): `src/lib/integrations/openai.ts` shares the parser prompt + types with the parse-itinerary edge function. 6 vitest cases.
- Footer pickers redesigned as segmented controls (icons for theme, flags for language).
- db-apply auto-applies fixtures (sample_employees) so the dev sign-in shortcut works after every reset.

**M4.3 — Itinerary, timezones, event config [complete]:**
- New Itinerary screen: gradient Hero with live countdown, day-grouped vertical timeline with per-type icon chips and `kizuna-fade-in` stagger animation.
- ImportItineraryDialog (paste / upload / email tabs; paste live, others coming soon). Calls parse-itinerary edge function (graceful 404 fallback).
- saveParsedFlights persists into public.flights with IATA → IANA timezone lookup.
- Timezone first-class: itinerary_items.{starts_tz,ends_tz}, flights.{departure_tz,arrival_tz}, transport_requests.pickup_tz, events.time_zone. Materialisation triggers populate them.
- Event config refactor: `supabase/events/YYYY-supafest.sql` is the single source of truth per year. Copy the file, edit the constants, db:apply. Supafest 2027 dates corrected to Jan 11-15 per Notion.
- Tech-debt audit findings fixed: flights RLS gap (users can now insert manual_obs flights), ImportDialog actually persists flights (was reporting success while writing nothing), ItineraryItemCard renders each row in its row's tz, dietary i18n hardcoded labels removed, toggleArrayMember helper extracted, GuestsSection uses Checkbox with stable keys, additional_guests gains updated_at.
- 111/111 vitest, lint clean, typecheck clean.

### M5 - Guest invitation, payment, lifecycle [complete]

**Goal:** Guest invitation lifecycle with signed tokens, Stripe checkout, webhook reconciliation.

- [x] Web Crypto HS256 invitation token helpers (sign + verify, 7-day default TTL) shared between SPA and edge functions
- [x] Resend wrapper with graceful in-memory outbox when RESEND_API_KEY missing
- [x] Stripe wrapper (createCheckoutSession + feeForTier) with stub redirect when STRIPE_SECRET_KEY missing
- [x] Edge function: create-guest-invitation (RLS-scoped, signs token, writes row, best-effort email)
- [x] Edge function: accept-guest-invitation (verifies token, creates auth.user + public.users + guest_profiles, marks invitation accepted)
- [x] Edge function: create-stripe-checkout (Phase 1 charges adult fee, stubs when unkeyed)
- [x] Edge function: stripe-webhook (HMAC signature verified when STRIPE_WEBHOOK_SECRET present, updates payment_status)
- [x] AcceptInvitationScreen at /accept-invitation?token=... with i18n error mapping
- [x] features/guests/api.ts wrapping functions.invoke with typed callEdgeFunction helper
- [x] Vitest: 15 integration tests (resend, stripe, invitationToken)
- [x] Commit: feat(guests) invitation lifecycle with stripe payment

**Deferred from M5 (intentional, follow-up milestones):**
- Sponsoring-employee notification on guest accept (M9 notifications)
- Receipt + confirmation email after payment success (M9)
- Guest list and invite-management UI for employees (M7 admin)
- Children fee tier (lands when ChildrenStep gets dedicated registration_task_key)

**M5 review:**
- 62 vitest tests across 13 files (15 new for integrations); 8/8 playwright
- Edge functions excluded from ESLint since they're Deno-runtime modules. They share the invitationToken implementation byte-for-byte with the SPA, eliminating drift.
- Graceful-degradation pattern fully proven for Resend and Stripe: each module logs once at boot and returns deterministic stub data without throwing.

### M6 - Personal itinerary and offline [complete]

**Goal:** Personal itinerary screen, materialised query, offline cache via service worker, realtime version push.

- [x] Itinerary screen (day grouping, sort by starts_at) — landed in M4.3
- [x] Itinerary item rendering by `item_type` — per-type icons + chips in itemMeta.ts
- [x] QR check-in code (signed JWT, cached offline) — CheckinCard
- [x] Workbox precache: itinerary, profile, documents
- [x] Workbox runtime: stale-while-revalidate extended to flights, accommodations, accommodation_occupants, transport_requests, sessions, events
- [x] Realtime subscription on `itinerary_items` for current user — supabase channel `itinerary:{userId}:{eventId}`
- [x] Realtime invalidates the TanStack query, which transparently refreshes the cached fetch
- [x] Global OfflineBanner in AppLayout — shows on every signed-in screen when navigator reports offline
- [x] Admin transport manifest report (was missing — spec lists 6 reports, we had 5)
- [ ] Manual offline QA on real device — deferred to M10 hardening
- [x] Commit: `feat(itinerary): offline cache and admin transport manifest`

**M6 review:**
- Service worker now caches the full operational dataset the bus operator needs offline (itinerary, flights, accommodations, transport, sessions, events). Cache name bumped to v2 to invalidate stale entries.
- Realtime push already worked — the existing useItinerary subscription invalidates the TanStack query on any postgres_changes event for the user's itinerary_items rows.
- Admin transport manifest joins flights + transport_vehicles + users so the bus operator handoff has flight number, airline, passenger/bag counts, special equipment, and assigned vehicle in a single CSV row.
- 111/111 vitest, lint clean, typecheck clean, build clean (PWA precache 18 entries, 935 KiB).

### M7 - Admin dashboard and reports [complete]

**Goal:** Admin operations: live reports with shareable signed links, conflict resolution UI, CSV export.

- [x] Admin layout shell — AdminScreen with tabs
- [x] Rooming list report (joins employee_profiles + guest_profiles for proper display name)
- [x] Transport manifest (added in M6)
- [x] Dietary summary
- [x] Swag order
- [x] Full registration report
- [x] Payment reconciliation
- [x] CSV export per report
- [x] Shareable read-only links — random 32-byte tokens stored on report_snapshots, 7-day expiry
- [x] Public read-only report view at /share/reports/:token (no auth, no chrome)
- [x] share-report edge function fetches LIVE rows via service role per spec ("never a frozen snapshot")
- [x] Conflict resolution UI (`data_conflicts`) — landed earlier as ConflictsPanel
- [x] Vitest: 4 new tests for share token generation + URL formatting
- [x] Commit: `feat(m7): live shareable report links with public view`

**M7 review:**
- 115/115 vitest, lint clean, typecheck clean.
- Spec is explicit that shared links render LIVE data, not snapshots. The `report_snapshots` table is a token holder; the edge function joins live tables on every request and returns rows + last_modified.
- AdminScreen was simplified by extracting REPORTS config + ActiveReport sub-component (post-simplify pass). Adding the 7th report (or share-mapping a new one) is a one-line append.
- Token format: 32 random bytes → 43 unpadded base64url chars. URL-safe, effectively unguessable, no JWT signing key needed because the token itself is the secret.
- Recipient experience: hits /share/reports/:token. AppLayout strips chrome on /share/* prefix so no Kizuna nav/footer leaks into the hotel coordinator's view.

### M8 - HiBob and Perk sync [partial]

**Goal:** HiBob bidirectional sync, Perk CSV import, conflict tracking.

- [x] src/lib/integrations/hibob.ts wraps the HiBob /people endpoint with graceful stub mode
- [x] src/lib/integrations/hibobReconcile.ts is a pure planner that diffs HiBob against Kizuna and emits update + conflict plans
- [x] supabase/functions/sync-hibob writes audit row, applies updates, inserts data_conflicts
- [x] hibob_sync_log auditing on every run
- [x] 12 vitest covering API wrapper + reconciliation
- [ ] Perk CSV upload UI + edge function (deferred to M8b)
- [ ] HiBob webhook receiver (deferred to M8b)
- [ ] Manual sync trigger button in admin dashboard (deferred to M8b)

### M9 - Notifications [complete]

**Goal:** Slack DM (employees), Resend email (guests), nudge rate-limiting, deadline reminders.

- [x] Edge function `send-notification` (channel router) — landed pre-M9
- [x] Slack DM wrapper (graceful when SLACK_BOT_TOKEN missing)
- [x] Resend wrapper (graceful when RESEND_API_KEY missing)
- [x] Nudge rate limiting (3 days per task)
- [x] Cron edge function `send-deadline-reminders` — walks open registrations whose event closes within 7 days, finds pending tasks, sends per-channel
- [x] In-app notification center: NotificationBell in header with unread badge + dropdown
- [x] `notifications` table gains `read_at` column + `mark_notification_read()` and `mark_all_notifications_read()` SECURITY DEFINER RPCs (so users can't tamper with subject/body via RLS update)
- [x] Realtime subscription on notifications for the current user — bell updates live
- [x] Vitest: 3 new tests for unreadCount counter
- [x] Commit: `feat(m9): in-app notification center + deadline reminder cron`

**M9 review:**
- 118/118 vitest, lint clean, typecheck clean.
- The cron function authenticates via `x-cron-secret` header (CRON_SECRET env), avoiding the need for an admin JWT for unattended runs. Locally defaults to `dev-cron-secret` so manual testing is one curl away.
- Channel routing matches the brief: employees with a slack_handle get a DM, everyone else gets email. The notification log row is written regardless of delivery outcome — admin audit needs both successes and failures.
- Sender path duplicated between `send-notification` and `send-deadline-reminders`. Flagged for the post-M9 refactoring audit.

### M9.6 - Email-on-payment, dependents, audit pass two [complete]

**Goal:** Close every audit finding from the second `/tech-debt-audit`
run, gate the guest invite email on sponsor payment, and let sponsors
fill in the registration sections for their dependents.

- [x] F001 parse-itinerary auth gate (Critical)
- [x] F002 vite-plugin-pwa CVE bump (semver-major)
- [x] F003 vitest CVE bump (semver-major)
- [x] F004 GroundTransportToolScreen split (593 → 373 LOC)
- [x] F005 GuestsSection split (542 → 277 LOC) + EditInvitationDialog
- [x] F006 userScopedRepository docstring on the as-never cast
- [x] F007 32KB / 2KB body caps on parse-itinerary + rephrase-icebreaker
- [x] F008 CORS justification comment in _shared/cors.ts
- [x] F009 Sentry TODO replaced with reportError shim
- [x] F010-F015 knip dead-export sweep
- [x] Email-on-payment: pending → sent → accepted lifecycle, sponsor
      checkout, fan-out helper, recovery email
- [x] Universal save-toast: top-center solid colour 5s, contract test
- [x] Edit invited adult guests
- [x] Passport country dropdown
- [x] Emergency contact name split
- [x] Dependents-as-full-attendees: shadow users + active-subject context

**Definition of done:**
- typecheck/lint clean (0 warnings)
- 316 vitest, 75 pgTAP
- production build clean (0 vulnerabilities per `npm audit`)
- single commit per logical milestone, pushed to main

### M9.5 - Tech debt + refactor sweep [complete]

**Goal:** Run `/tech-debt-audit`, `/simplify`, and `/clean-and-refactor` against the M0–M9 stack, then address every finding so M10 starts on a clean baseline.

- [x] tech-debt audit ran (32 findings) and all material items resolved
- [x] /simplify pass: extract `useHydratedFormState` across 8 sections; extract `ImportRoomBlockDialog`, `testRoomBlock`, `lib/timezone.ts`
- [x] /clean-and-refactor pass: 10 findings, all addressed
- [x] Critical 1: `rephrase-icebreaker` edge function now requires an auth JWT before hitting OpenAI/cache
- [x] Critical 2: `share-report.transport_manifest` scopes by `event_id` via registrations join — no cross-event leak
- [x] High 3: pgTAP coverage for `update_accommodation_special_requests` + `update_transport_request_special_requests` RPCs (owner happy path, non-occupant rejection, anonymous rejection, whitespace-clears branch)
- [x] High 4: replace module-level `WINDOW_TZ`/`WINDOW_TIME_FMT` with `event.time_zone`-driven factories; `transport_vehicles.pickup_tz` and `transport_requests.pickup_tz` defaults dropped
- [x] High 5: hardcoded `YYC` route label replaced with `event.airport_iata`
- [x] Medium 6: pgTAP coverage for `set_guest_invitation_fee_biu`
- [x] Medium 7: pgTAP coverage for own-row-unpaid branch of `guard_guest_profile_completion`
- [x] Medium 8: `TEST ROOM BLOCK` button gated on `import.meta.env.DEV`
- [x] Low 9: `flights.destination` column comment generalised away from YYC
- [x] Low 10: `transport_vehicles.pickup_tz` / `transport_requests.pickup_tz` defaults removed

**Definition of done:**
- typecheck/lint/test/build clean (314 vitest, 66 pgTAP)
- single commit at sweep boundary

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

---

# Phase 2 — Integrations, gallery, UI revamp

> Generated 2026-05-02. Six integrations + a photo gallery + a UI revamp, sequenced so each milestone ships behind a feature flag and no two land at once.

## Sequencing

| # | Track | Why this slot |
|---|---|---|
| 1 | **Stripe (live mode)** | Already 70% built. Closing the bundled-checkout loop unblocks real registration. |
| 2 | **Resend (live mode)** | Stripe success → invite email. Resend is the dependency under the dependency. |
| 3 | **HiBob bulk + cron** | Replaces the seeded fixture roster with real employees. |
| 4 | **Okta SSO** | Once HiBob seeds `auth.users`, SSO has bodies to attach to. |
| 5 | **Slack notifications** | Cheap, high-signal. Slot it whenever an evening is free. |
| 6 | **Perk sync** | Hardest API access. Start the procurement clock now; ship integration when keys arrive. |
| 7 | **Photo gallery** | Pure feature work, no dependency on the integrations above. |
| 8 | **UI revamp** | Pick a Paper variant, port tokens, sweep `src/components/ui/`. |

Each track below has: **current state · API research · phased plan · gotchas · MVP checklist.**

---

## P2-1 · Stripe — bundled sponsor checkout

### Current state

| Asset | Status |
|---|---|
| `supabase/functions/create-stripe-checkout/index.ts` | Single-guest fallback. |
| `supabase/functions/create-sponsor-fees-checkout/index.ts` | Bundled-checkout entry. Existing logic but lacks idempotency keys and uses raw `fetch` instead of the SDK. |
| `supabase/functions/stripe-webhook/index.ts` | Receives the success event. Signature verification in place; row updates need to move into a transactional Postgres function. |
| `supabase/functions/_shared/sponsorPaymentFanOut.ts` | Webhook → guest-invitation status fan-out. |
| Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Doppler, all configs). |

### Research summary

- **Stripe Checkout Session in `payment` mode** with `line_items` keyed by guest. Hosted UI keeps PCI scope at zero, supports Apple Pay / Google Pay / Link out of the box.
- **Idempotency keys** must wrap every `sessions.create`. Stable shape: `sponsor-checkout-${sponsorId}-${unpaidHash}`. SPA double-taps and 502 retries collapse to one charge.
- **Webhook** verifies `stripe-signature` via `constructEventAsync` (Deno requires the async variant), expands `line_items`, loops over per-line `metadata.guest_invitation_id` / `metadata.additional_guest_id`. Wrap all row updates in a `mark_guest_paid()` Postgres function so the `guest_invitations.status → 'sent'` flip and `additional_guests.payment_status → 'paid'` happen in one transaction. Idempotent so retries are safe.
- **Test cards:** `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (3DS), `4000 0000 0000 0341` (3DS that fails).
- **Refunds: admin-triggered, not automatic.** Sponsors sometimes cancel a guest then add a different one; auto-refund-then-recharge is bad UX. Surface a "Refund $X" button on `/admin/guests/:id` calling `stripe.refunds.create` and writing a `refund_events` row.
- **Production hardening:** webhook URL `https://<project>.supabase.co/functions/v1/stripe-webhook`, subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Branding logo + primary `#3ECF8E`, statement descriptor `SUPAFEST`, Apple Pay domain verification.

### Plan

- **P2-1.1 · Idempotency + transactional fan-out** (1d): switch to `npm:stripe@17` SDK with `Stripe.createFetchHttpClient()`; add `Idempotency-Key`; stamp per-line `product_data.metadata`; add top-level `metadata: { sponsor_id, kind }`.
- **P2-1.2 · `mark_guest_paid()` Postgres function** (½d): single transaction, idempotent, pgTAP test for replay safety.
- **P2-1.3 · Webhook hardening** (½d): `constructEventAsync`, four event types, calls `mark_guest_paid()`.
- **P2-1.4 · Admin refund flow** (1d): `/admin/guests/:id` "Refund $X" button + `refund_events` table.
- **P2-1.5 · Production go-live** (½d): live keys, webhook registered, Apple Pay domain verified, branding.

### Gotchas

- `Idempotency-Key` is per-API-key-scope; live and test never collide. Don't reuse keys across modes.
- Stripe SDK auto-stringifies dates wrong on Deno without `httpClient: Stripe.createFetchHttpClient()`. Required.
- Webhook handler must return 200 within 30s. If `mark_guest_paid` is slow under load, push to `pg_net` and ack immediately.

### MVP checklist
- [ ] `npm:stripe@17` wired in `create-sponsor-fees-checkout`
- [ ] Idempotency-Key on every `sessions.create`
- [ ] Per-line `product_data.metadata` carries both ids
- [ ] `mark_guest_paid()` Postgres function + pgTAP test
- [ ] Webhook subscribes to four events, calls the function
- [ ] `stripe listen` end-to-end confirmed locally with success + 3DS cards

---

## P2-2 · Resend — transactional email

### Current state

| Asset | Status |
|---|---|
| `supabase/functions/send-notification/index.ts` | Exists. Verify content. |
| `supabase/functions/send-deadline-reminders/index.ts` | Exists. Verify content. |
| Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (Doppler). |
| No verified domain, no template system. |

### Research summary

- **Plain `fetch` against `https://api.resend.com/emails`**, not `npm:resend`. One dependency fewer; the API is a single POST.
- **Templating: React Email** (`@react-email/components`, `@react-email/render`). Type-safe props, `render(<Email/>)` returns inlined HTML. Templates live in `src/emails/`. Raw HTML strings drift across 8–12 templates; MJML adds an XML build step.
- **Idempotency:** Resend supports `Idempotency-Key` (24h window). Mint deterministically: `sha256(${event_type}:${user_id}:${context_id})`. Pair with `sent_emails` table on the same hash for double safety.
- **Bounce / complaint webhook:** new `resend-webhook` edge function verifies `svix-signature` (Resend uses Svix), upserts `email_suppressions` on `email.bounced` and `email.complained`. Every send pre-checks suppressions.
- **Pricing:** 60 × ~10 over 6 months ≈ 600 sends. **Free tier** (3,000/month, 100/day) covers it.
- **Rate limit:** 2 req/sec default. Admin broadcast uses the `batch` endpoint (up to 100 per call).
- **Local stub:** when `RESEND_API_KEY` missing OR `RESEND_MODE=stub`, helper logs HTML and returns a fake message id.

### Sender domain DNS records

```
SPF   TXT  v=spf1 include:amazonses.com ~all
DKIM  TXT  resend._domainkey  → CNAME to Resend's DKIM host
DMARC TXT  v=DMARC1; p=none; rua=mailto:dmarc@kizuna.supabase.com
MX    for the return-path subdomain (send.<domain>)
```

Start at `p=none`, tighten to `quarantine` after the first 30 days clean.

### Plan

- **P2-2.1 · Domain + shared helper** (½d): verify in Resend dashboard. Build `_shared/resend.ts` with `sendEmail()`, `renderEmail()`, suppression check, stub mode.
- **P2-2.2 · Templates + tables** (1d): `src/emails/` (`InvitationEmail`, `PaymentReceipt`, `DeadlineReminder`, `CheckinConfirmation`, `AdminBroadcast`). Migrate `sent_emails` (idempotency key UNIQUE) and `email_suppressions` (email PK) tables, RLS admin-only.
- **P2-2.3 · Wire to Stripe success** (½d): webhook handler emails `InvitationEmail` after `mark_guest_paid`, idempotency `sha256(invitation:${invitation_id}:sent)`.
- **P2-2.4 · Bounce webhook** (½d): Svix signature verification, upsert suppressions.
- **P2-2.5 · Admin broadcast UI** (1d): reuse `/admin/nudges`, preview + `batch` send.

### Gotchas

- `onboarding@resend.dev` only sends to your own verified address. Stop using it the moment a real recipient is in the loop.
- `render()` is sync but heavy; cache when props are stable.
- Always set tag `category` (`transactional` / `broadcast` / `system`).

### MVP checklist
- [ ] Sender domain verified, SPF + DKIM + DMARC live
- [ ] `_shared/resend.ts` with stub mode
- [ ] `sent_emails` + `email_suppressions` tables migrated
- [ ] `InvitationEmail` template wired into Stripe webhook
- [ ] `resend-webhook` handles bounces and complaints

---

## P2-3 · HiBob — HRIS pipe

### Current state

| Asset | Status |
|---|---|
| `supabase/functions/sync-hibob/index.ts` | Real bulk-pull wired. Uses `btoa(${id}:${token})` Basic auth. |
| `supabase/functions/hibob-self/index.ts` | Self-lookup endpoint, same auth. |
| `supabase/functions/_shared/hibobStub.ts` | Deterministic fixtures. |
| Env: `HIBOB_API_KEY`, `HIBOB_WEBHOOK_SECRET`. **Rename to `HIBOB_SERVICE_USER_ID` + `HIBOB_SERVICE_USER_TOKEN`** to match HiBob's actual auth model. |

### Research summary

- **Auth:** HTTP Basic with a Service User (`base64(service_user_id:token)`). Tokens shown once; store in Doppler immediately.
- **Endpoints** (deprecated `GET /v1/people` retired, don't use):
  - `POST https://api.hibob.com/v1/people/search` — primary roster pull. Body: `{ fields: string[], filters?: [...], showInactive: false, humanReadable: 'APPEND' }`.
  - `GET /v1/people/{employeeId}` — single lookup.
  - `GET /v1/avatars/{employeeId}` — avatar URL.
- **Field mapping** (HiBob → `employee_profiles`):

| kizuna column | HiBob path |
|---|---|
| `first_name` | `root.firstName` |
| `last_name` | `root.surname` |
| `preferred_name` | `root.displayName` |
| `legal_name` | `root.fullName` |
| `alternate_email` | `home.privateEmail` |
| `phone_number` | `home.mobilePhone` |
| `department` | `work.department` |
| `team` | `work.custom.<HIBOB_TEAM_FIELD_ID>` |
| `job_title` | `work.title` |
| `start_date` | `work.startDate` |
| `home_country` | `address.country` (ISO-2) |
| `base_city` | `address.city`, fallback `work.site` |
| `slack_handle` | `work.custom.<HIBOB_SLACK_FIELD_ID>` |

- **Webhooks:** `employee-left`, `employee-inactivated`, hire, per-field update events. Signature: **HMAC-SHA512** in **`Bob-Signature`** header. Constant-time compare.
- **Avatars:** `GET /v1/avatars/{id}` returns a URL string. Stream into `avatars` Storage bucket at `avatars/<user_id>.jpg`. Don't store HiBob URLs directly — they expire and require auth.
- **Sync strategy:** layered — (a) bulk pull at deploy + on demand, (b) hourly cron via `pg_cron` calling `sync-hibob` (safety net, source of truth), (c) webhooks for realtime. HiBob v2 webhooks don't guarantee delivery.
- **Sandbox:** paid add-on for existing customers. Local dev relies on the stub.

### Plan

- **P2-3.1 · Rename Doppler secrets** (½d): add `HIBOB_SERVICE_USER_ID` + `HIBOB_SERVICE_USER_TOKEN`, update `_shared/env.ts` and the two edge functions.
- **P2-3.2 · `HiBobClient` interface** (½d): `_shared/hibobClient.ts` with `search()`, `getById()`, `getAvatarUrl()`. `createHiBobClient(env)` returns real or stub.
- **P2-3.3 · Bulk pull → reconcile** (1d): verify end-to-end against production tenant. Confirm `hibob_sync_log` populates and `data_conflicts` triggers when a `field_locked` value would be overwritten. pgTAP for the upsert + conflict policy.
- **P2-3.4 · Hourly cron** (½d): `pg_cron` schedule. Termination flow: `is_active = false` flips within an hour.
- **P2-3.5 · Avatar pipeline** (1d): extend `sync-hibob` to fetch `GET /v1/avatars/{id}`, copy to `avatars` bucket, store the public URL.
- **P2-3.6 · Webhooks** (1d, deferred until cron is stable): HMAC-SHA512 verification, handle hire/leave/inactivate/field-change events.

### Gotchas

- HiBob tokens are unrecoverable after creation. Store immediately.
- `humanReadable: 'APPEND'` returns both raw enum keys AND human labels — UI reads labels, DB stores keys.
- Rate limits unpublished; reports put it at 10–100 req/min/service-user. Prefer one bulk search over per-employee GETs.

### MVP checklist
- [ ] Doppler secrets renamed
- [ ] `HiBobClient` interface + factory
- [ ] Bulk pull verified against production tenant
- [ ] Hourly cron live
- [ ] Avatars synced to the `avatars` bucket
- [ ] Webhook handler optional, deferred until cron is stable

---

## P2-4 · Okta SSO

### Current state

| Asset | Status |
|---|---|
| Env: `VITE_OKTA_CLIENT_ID`, `VITE_OKTA_DOMAIN` (Doppler). | Configured but no callers. |
| `src/features/auth/AuthContext.tsx` | Uses `signInWithPassword` only. |
| `src/features/auth/SignInScreen.tsx` | Email + password form. Has dev-only shortcuts. |
| Greenfield for SSO. |

### Research summary

- **Protocol: SAML 2.0**, not OIDC. Supabase reserves OIDC for "Sign in with…" social providers. Source: <https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml>.
- **Okta side** (Admin → Applications → Create App Integration):
  - Sign-in method: SAML 2.0
  - ACS URL: `https://<project-ref>.supabase.co/auth/v1/sso/saml/acs`
  - Audience URI: `https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata`
  - Name ID format: `EmailAddress`
  - Attribute statements: `email`, `first_name`, `last_name`, `groups` (filter regex `supafest-.*`)
  - Toggle "Sign assertions" — Supabase rejects unsigned.
- **Supabase side** (CLI; dashboard SSO UI is read-only):
```bash
supabase sso add --type saml \
  --project-ref <ref> \
  --metadata-file okta-metadata.xml \
  --domains supabase.com \
  --attribute-mapping-file mapping.json
```
- **JIT, not pre-seeded.** Supabase's SAML flow auto-creates `auth.users` on first successful assertion; existing `ensure_public_user_for_auth_ai` trigger handles the `public.users` mirror.
- **Group mapping:** extend `custom_access_token_hook` to read `auth.users.raw_user_meta_data->'groups'`, write to `public.users.role` and `is_leadership`. Honor `field_source = 'okta'` so we never overwrite a manually-set role.
- **Coexistence:** `/sign-in` checks email domain — `@supabase.com` → `signInWithSSO`, everything else → `signInWithPassword`. Sample employees + dev users keep working.
- **Local testing:** feature flag `VITE_AUTH_MODE=password|sso`, password-only locally. For staging, WorkOS AuthKit or Auth0 free tier expose SAML metadata Supabase accepts.

### Plan

- **P2-4.1 · Provision Okta app** (½d): create SAML app, sign assertions ON, IdP-initiated OFF, group filter, download metadata.
- **P2-4.2 · Register with Supabase** (½d): `supabase sso add --type saml ...`.
- **P2-4.3 · Custom hook extension** (1d): translate `groups` → `app_role` and `is_leadership` in `custom_access_token_hook`. Add `role_source` column with default `'manual'`, set to `'okta'` on JIT. pgTAP for role-precedence.
- **P2-4.4 · SignInScreen branching** (½d): email-domain check, i18n strings.
- **P2-4.5 · End-to-end test** (½d): two test users (admins + leadership groups), verify JWT carries `app_role` + `is_leadership`, RLS still works.

### Gotchas

- **Sign assertions ON.** Toggle in Okta. Supabase rejects unsigned.
- **NameID stability.** If Okta changes a user's email, Supabase treats them as a new user. Lock NameID to immutable Okta `user.id` if HR renames are common.
- **Session skew.** Okta 8h+, Supabase 1h. Refresh-token rotation handles it.
- **The hook fires on EVERY token mint** including refresh. Cheap, but make the role write a no-op when nothing changed.

### MVP checklist
- [ ] Okta SAML app provisioned, sign-assertions ON
- [ ] `supabase sso add` registered
- [ ] `custom_access_token_hook` translates `groups` → role + leadership
- [ ] `/sign-in` branches by email domain
- [ ] Two test users, two groups, end-to-end pass

---

## P2-5 · Slack notifications

### Current state

| Asset | Status |
|---|---|
| Env: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` (Doppler). | Configured. |
| No edge function or callers yet. Greenfield. |

### Research summary

- **Token model:** **bot token (`xoxb-`)**. Granular scopes, survives departures, can post + DM. Incoming webhooks too narrow (one channel per URL, no DM, no Web API). User OAuth for Phase 2 only if we want kizuna ↔ Slack identity linking.
- **Required scopes:** `chat:write`, `chat:write.public`, `users:read`, `users:read.email`, `im:write`. Add `commands` for slash commands later.
- **Block Kit** for rich messages. Plain `text` for notification fallback.
- **DM flow:** `users.lookupByEmail` → `conversations.open` → `chat.postMessage`. Edge cases: `users_not_found`, `user_not_visible`, deactivated — log to `data_conflicts`, never throw.
- **Inbound events** (later, slash commands): verify `v0=HMAC-SHA256(signing_secret, "v0:" + timestamp + ":" + raw_body)`. Reject if timestamp drifts >5min. Constant-time compare.
- **Rate limits:** Tier 4 (~100/min) `chat.postMessage`, Tier 3 (~50/min) `users.lookupByEmail`, Tier 2 (~20/min) `conversations.open`. Respect `Retry-After`.

### Plan

- **P2-5.1 · Slack app + bot token** (½d): create at api.slack.com/apps, add five scopes, install, store `xoxb-` in Doppler.
- **P2-5.2 · `_shared/slack.ts` helper** (½d): `postToChannel()`, `dmUserByEmail()`, stub mode when token missing.
- **P2-5.3 · Registration-complete admin DM** (1d): Postgres trigger on `registrations` (status → `complete`) calls `pg_net` → `slack-notify` edge function → `postToChannel(env.SLACK_ADMIN_CHANNEL_ID, ...)`. Vitest mocks fetch, pgTAP confirms trigger.
- **P2-5.4 · Flight-changed user DM** (1d): trigger on `flights` (departure/arrival change) fans out to `slack-notify`, edge function looks up email and DMs.
- **P2-5.5 · Daily editorial digest** (½d): `pg_cron` 09:00 MDT pulls last 24h editorial posts, single Block Kit message to `#supafest-2027`.

### Gotchas

- `users.lookupByEmail` requires `users:read.email` AND admin must enable email visibility for bots in workspace settings.
- `chat.postMessage` to a channel the bot isn't in needs `chat:write.public`. Without it, `not_in_channel` error.
- Slack event subscription URL is challenged on first registration; the edge function must echo the challenge token.

### MVP checklist
- [ ] Slack app installed, `xoxb-` in Doppler
- [ ] `_shared/slack.ts` with stub mode
- [ ] Registration-complete admin ping live
- [ ] Vitest + pgTAP coverage

---

## P2-6 · Perk (TravelPerk) — corporate travel

### Current state

| Asset | Status |
|---|---|
| Env: `PERK_API_KEY` (Doppler). | Configured but unused. |
| `flights.perk_booking_ref` column exists. | Schema-ready. |
| `flights.source` enum has `'perk'`. | Schema-ready. |
| No client, no edge function. Greenfield. |

### Research summary

- **Most likely product: TravelPerk**, rebranded to "Perk" in 2025. `developers.travelperk.com` redirects to `developers.perk.com`. CSV-then-API trajectory matches their actual product.
- **Auth:** static API key in `Authorization: apikey <KEY>` + required `Api-Version: 1` header. Admin-scoped — never to the browser.
- **Endpoints** (base `https://api.travelperk.com`):
  - `GET /trips`, `GET /trips/{id}` — trip metadata
  - `GET /bookings` (filterable by `trip_id`, traveller email, date range) — segments, PNR, airline, flight number, scheduled times
  - `GET /users` — to map TravelPerk user → kizuna `user_id` by email
- **Field mapping** (booking.segments[i] → kizuna `flights`):

| kizuna column | TravelPerk source |
|---|---|
| `user_id` | lookup `traveller.email` against `auth.users.email` |
| `perk_booking_ref` | `booking.id` |
| `direction` | derived: outbound if `departure_at < event.start`, else return |
| `origin` / `destination` | `segment.origin.iata` / `segment.destination.iata` |
| `departure_at` / `arrival_at` | `segment.departure_datetime` / `segment.arrival_datetime` |
| `airline` | `segment.carrier.name` |
| `flight_number` | `segment.carrier_code` + `segment.flight_number` |
| `source` | `'perk'` |

- **Sync model:** webhooks primary + nightly cron backstop. `GET /bookings?updated_since=...` reconciles missed deliveries.
- **Webhooks:** trip-changed events. HMAC-SHA256 over raw body. Header name not in public docs; confirm with support once creds issue.
- **Sandbox:** free via support request. Suitable for stubbed-mode local dev.
- **Fallback:** if API delayed, `parse-itinerary` (OpenAI) covers the manual-import path.

**Disambiguation needed:** confirm `PERK_API_KEY` is for TravelPerk and not an internal Supabase tool also named Perk.

### Plan

- **P2-6.1 · Confirm vendor + procurement clock** (½d, blocking): confirm with user / IT. File the partner-API access request through TravelPerk support if not already done — the procurement queue is the long pole. Request sandbox in parallel.
- **P2-6.2 · `_shared/perkStub.ts`** (½d): mirror HiBob stub. Deterministic fixtures.
- **P2-6.3 · `_shared/perkClient.ts`** (1d): switches stub vs real. `Authorization: apikey ${env.PERK_API_KEY}`, `Api-Version: 1`. 429 backoff.
- **P2-6.4 · `perkReconcile.ts`** (1d): pure function `Booking[] → flights upserts` keyed on `perk_booking_ref`. Honors `field_source` / `field_locked`. pgTAP.
- **P2-6.5 · `perk-sync` cron** (½d): every 6 hours via `pg_cron`. Calls `fetchBookings({ updated_since })`.
- **P2-6.6 · `perk-webhook`** (deferred until creds): HMAC-SHA256 scaffolded but tolerant of "no signature configured yet."

### Gotchas

- TravelPerk webhook signature header name not in public docs. Plan a back-and-forth with support.
- Booking IDs ≠ PNRs. Use `booking.id` for `perk_booking_ref` (stable across PNR changes).
- Email mismatches (`name+travel@supabase.com` vs. `name@supabase.com`) — surface a `data_conflicts` row when no match.

### MVP checklist
- [ ] Vendor confirmed + sandbox requested
- [ ] `_shared/perkStub.ts`
- [ ] `_shared/perkClient.ts` switching on env
- [ ] `perkReconcile.ts` + pgTAP
- [ ] `perk-sync` cron live in stub mode
- [ ] Real API access tested (sandbox first)

---

## P2-7 · Photo gallery + tagging

### Current state

| Asset | Status |
|---|---|
| `community_media` Storage bucket | Exists with admin/self RLS policies. |
| No `media_items` table, no UI, no tagging. Greenfield. |

### Plan

- **P2-7.1 · Schema** (½d):

```sql
create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.users(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  width int, height int,
  taken_at timestamptz,
  uploaded_at timestamptz not null default now(),
  caption text,
  privacy media_privacy not null default 'event_only'
);

create table public.media_tags (
  media_id uuid not null references public.media_items(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  label text,
  added_by uuid not null references public.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (media_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), label),
  check (user_id is not null or label is not null)
);
```

RLS: `event_only` visible to attendees; `public` to all signed-in; `private` to owner + admins. Tagged-as-me always visible regardless of privacy.

- **P2-7.2 · Upload pipeline** (1d): reuse `useSupabaseUpload`. Client-side EXIF strip (lat/long leak). Edge function with `sharp` generates thumb (320), medium (1024), full. Post-upload: Slack ping.
- **P2-7.3 · Gallery view** (1.5d): `/community/gallery` masonry grid (CSS columns), virtualized via `react-virtuoso`. Lightbox: prev/next, caption, tags, "Tag people" admin action. Filter chips by date / tagged-user / event.
- **P2-7.4 · Tagging UX** (1d): face click in lightbox → person picker (typeahead vs `public.users`). Bulk-tag by `session_id`. Tags trigger Slack DM.
- **P2-7.5 · AI auto-tag** (deferred): OpenAI Vision or AWS Rekognition vs. employee_profiles avatars. Confidence > 0.9 auto-tag, else queue for review. **Never auto-tag minors** — skip media tagged with any `additional_guests` reference.

### Gotchas

- **Minors.** Default `privacy = 'private'` for any media tagged with an `additional_guests` reference.
- **Storage costs.** 60 × 100 photos × 4MB = 24GB. Generate derivatives, serve thumbs from CDN, full only on demand.
- **EXIF.** Strip GPS before storing. Some users will share photos taken at home.

### MVP checklist
- [ ] `media_items` + `media_tags` tables + RLS
- [ ] Upload pipeline with EXIF strip + derivatives
- [ ] `/community/gallery` masonry view
- [ ] Lightbox with tagging
- [ ] Tag-to-Slack-DM notification

---

## P2-8 · UI revamp

### Current state

| Asset | Status |
|---|---|
| `src/components/ui/` | 9 files: button, checkbox, dialog, dropzone, input, label, progress, textarea, toast. Pure shadcn. |
| `src/styles/globals.css` | 6 themes wired: light, dark, barbie, supa, hermione, kirk. Token system in place via CSS variables. |
| Verdict: theme infrastructure is solid. The "very shadcn" feel is from default radius / shadow / typography, not the tokens. |

### Three Paper variants

Live in the `Kizuna` Paper file, on the canvas next to the existing Home Desktop.

- **Variant A — Editorial.** Print-magazine register. Fraunces display + Inter body, single cadmium accent (`#7E1D14`), generous whitespace, asymmetric headline + countdown. Best for "curated content" use cases.
- **Variant B — Alpine field guide.** Caudex display + Inter body, evergreen × ochre lichen on warm bone (`#F4EFE6`), woodcut-style icons, hand-drawn separators. References the Banff venue without being twee.
- **Variant C — Phosphor terminal.** All JetBrains Mono, pure black ground, phosphor green accent. Plays the "Supabase is a developer brand" card straight. Tabular data fits naturally; itinerary timeline reads like CLI history.

### Plan (after the user picks a winner)

- **P2-8.1 · Pick a direction** (½d): review Paper variants. Probably an A/C blend ("editorial in shape, phosphor in moments where data is dense"). Lock mood word, palette, type scale into a Notion brand-voice doc.
- **P2-8.2 · Token migration** (1d): update `globals.css` `:root` with new HSL channel triples. Add chosen serif (Fraunces) + mono (JetBrains Mono) to `index.html` Google Fonts. `tailwind.config.ts` gets `fontFamily.display` and `fontFamily.mono`.
- **P2-8.3 · Component sweep** (2d): one PR per shadcn primitive. Replace radius / shadow / focus ring with new tokens. Default size scale (sm/md/lg) stays — only visual treatment changes.
- **P2-8.4 · Hero treatments** (1d): HomeScreen + ItineraryHero get the variant's hero. LoggedOutHome (day/night background) keeps its current treatment.
- **P2-8.5 · Visual regression baseline** (½d): Playwright screenshot tests for `/`, `/itinerary`, `/registration`, `/admin/agenda`, `/admin/scan`. Lock baselines after migration.

### Gotchas

- Existing themes (`barbie`, `supa`, `hermione`, `kirk`) need to be retired or re-derived from the new token base. Probably retire all but `light` / `dark` / `supa`.
- shadcn Toast and Dialog have animation defaults that look default-shadcn. Override `data-[state=open]:animate-in` keyframes too.

### MVP checklist
- [ ] Paper variant picked, brand-voice doc locked
- [ ] Token migration in `globals.css`
- [ ] All 9 shadcn primitives swept
- [ ] HomeScreen + ItineraryHero hero treatments shipped
- [ ] Playwright visual baseline

---

## Cross-cutting

- **Doppler secret rotation.** Every integration adds 2-4 secrets. Roll the renames (`HIBOB_SERVICE_USER_ID`, etc.) in a single Doppler PR before integration work.
- **Edge function tests.** The `parse-itinerary/index.test.ts` work in flight is the template for `_shared/resend.ts`, `_shared/slack.ts`, `_shared/perkClient.ts`, `_shared/hibobClient.ts`. Wire `npm run test:functions` running `deno test supabase/functions` into CI alongside `supabase test db`.
- **Observability.** Every integration writes to a per-integration log table (`hibob_sync_log` is the prototype). Surface in `/admin/integrations` once 3+ are live.
- **Reset-remote-db hardening.** Currently `reset-remote-db.sh` leaves orphaned `auth.users` without `public.users` rows. Add a `walk auth.users → upsert public.users` step at the end so resets are idempotent for already-signed-up testers.

## Open questions for tomorrow

1. Confirm `PERK_API_KEY` = TravelPerk vs. an internal Supabase tool.
2. Confirm Okta IdP is already provisioned for the company (not new procurement).
3. Confirm Resend domain — `kizuna.supabase.com` vs. a dedicated subdomain.
4. Photo gallery: AI auto-tag in or out for Phase 2?
5. UI direction: which Paper variant lands the killing blow — A, B, C, or hybrid?
