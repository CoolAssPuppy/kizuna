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
