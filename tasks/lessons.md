# Lessons learned

> Append entries after every correction or surprising finding. Keep it tight: rule, why, how to apply.

## Format

```
## YYYY-MM-DD - Short title

**Rule:** [the rule itself]

**Why:** [the reason - often a past incident or strong preference]

**How to apply:** [when/where this guidance kicks in]
```

---

## 2026-04-30 - Follow the spec on platform choice

**Rule:** Vite + React 18 PWA, not Next.js, for Kizuna.

**Why:** The 90-min YYC→Banff bus has no signal. Offline access to itinerary, room assignment, and transport details is operational. Vite + Workbox is the cleaner offline-first path. Spec author chose this deliberately. User confirmed.

**How to apply:** Reach for Vite tooling and React Router for any new routing. Do not introduce Next.js or React Server Components. PWA via vite-plugin-pwa.

## 2026-04-30 - Designers must be able to re-skin without code changes

**Rule:** All theming through CSS variables in `src/styles/globals.css`. All copy through i18n. Component code stays untouched when a designer changes brand.

**Why:** This codebase is meant to be picked up and re-skinned by designers (Paper MCP integration planned). Hard-coded colors, spacing, or English strings break that promise.

**How to apply:** Never hard-code hex values in components. Never write English in JSX. Use Tailwind tokens that map to CSS variables. Use the `t()` function for every visible string.

## 2026-04-30 - Fail gracefully without integration credentials

**Rule:** HiBob, Perk, Slack, Stripe, Resend, Notion, Okta integrations must run in two modes: live (creds present) or stubbed (creds missing, deterministic mock, warning logged, no throw).

**Why:** The user wants to build the entire app locally before any third-party setup. Anything that throws on missing creds blocks the whole app.

**How to apply:** Wrap each integration in a single module that checks for env vars at the top. If absent, return a stub implementation. Log the missing var once at boot, not on every call.

## 2026-04-30 - Quality bar is peer review, not personal use

**Rule:** Every line should be defensible by a staff engineer in code review. Idiomatic Vite, idiomatic Supabase, idiomatic React.

**Why:** The user is non-technical but wants to earn the trust of the Supabase engineering org. Sloppy patterns or shortcuts will undermine that goal.

**How to apply:** When two paths exist, choose the one a senior engineer would defend. Prefer explicit over clever. No `any`. No silent error swallowing. Write tests first.

## 2026-04-30 - Only declare dependencies that are actually used

**Rule:** Never speculatively add packages to `package.json` "for the next milestone." Add them when the feature that needs them is being built.

**Why:** Speculative deps inflate bundle size, slow `npm ci`, and signal sloppiness in review. M0 originally listed eleven runtime deps with zero callsites; the refactor-scan caught it.

**How to apply:** When starting a new milestone, only add a dependency at the point of first import. Use `shadcn add <component>` to pull in radix subdeps automatically. Run `depcheck` periodically to catch stragglers.

## 2026-04-30 - exactOptionalPropertyTypes hates `value: undefined`

**Rule:** With `exactOptionalPropertyTypes: true`, an optional field is "either the property is absent or it has a defined value." Setting `prop: undefined` is a type error. Use object spread with conditional keys instead.

**Why:** Bit me on `playwright.config.ts` (`workers: process.env.CI ? 1 : undefined`) and `renderWithProviders` (passing `initialRoute?: string` through to a component expecting a defined value).

**How to apply:** When you want "set this field only sometimes," use `...(condition ? { field: value } : {})`. When passing an optional through to a stricter consumer, default at the boundary (`{ initialRoute = '/' } = {}`).

## 2026-04-30 - Test scaffolding tsconfig hygiene

**Rule:** Don't put `vitest/globals` in `tsconfig.app.json` `types`. Use a triple-slash reference inside the test setup file instead. Also keep tests excluded from the app tsconfig include.

**Why:** Mixing test globals into prod scope means `describe` and `it` are typed as available everywhere, masking accidental usage outside tests.

**How to apply:** `/// <reference types="vitest/globals" />` at the top of `src/test/setup.ts`. App tsconfig include is `["src"]` only. E2E tests under `tests/e2e/` are excluded from ESLint and have their own Playwright runtime.

## 2026-04-30 - One QueryClient per test, not per re-render

**Rule:** When building a `renderWithProviders` helper, instantiate the `QueryClient` inside the helper function (once per test), not inside the wrapper component (which re-runs on every re-render).

**Why:** A wrapper that creates a fresh client on every render breaks cache continuity within a single test, hiding mutation/cache bugs that production wouldn't have.

**How to apply:** Helper signature is `renderWithProviders(ui, options)` → creates one client → passes it to the wrapper as a prop.

## 2026-04-30 - Class ErrorBoundary, functional fallback

**Rule:** Keep the class component for catching render errors (only classes can do this in React) but split the rendered fallback into its own functional file so it can call hooks like `useTranslation`.

**Why:** `withTranslation()` HOC pollutes props with `WithTranslation`, requires renaming exports, and trips the `react-refresh/only-export-components` rule. The two-file split is cleaner and idiomatic.

**How to apply:** `ErrorBoundary.tsx` (class) imports `ErrorFallback.tsx` (function). Class re-renders fallback on error. Fallback freely uses hooks.

## 2026-04-30 - JWT app_role lives in a custom claim, not the standard role claim

**Rule:** App roles (`employee | guest | admin | super_admin`) go in JWT custom claim `app_role`, not the top-level `role` claim. The standard `role` stays `authenticated`/`anon` so Supabase's `auth.role()` and Postgres role mapping work.

**Why:** The spec wrote `auth.jwt() ->> 'role'` which conflicts with Supabase's built-in role mapping. Overriding `role` to `'employee'` would break the `authenticated` checks in `events_authenticated_read` and similar policies, and require dropping Supabase's standard JWT contract.

**How to apply:** Set `app_role` via a Custom Access Token Hook (see `supabase/schemas/85_auth_hooks.sql`). RLS policies read it through `public.auth_role()`. Tests inject it directly with `set local request.jwt.claims to '{... "app_role":"employee" ...}'`.

## 2026-04-30 - `on conflict do nothing` requires a real unique constraint

**Rule:** When you write `on conflict ... do nothing`, the conflict target must point at an actual unique index/constraint. There is no "silent dedup" mode — duplicate inserts succeed without one.

**Why:** Bit me on `itinerary_items`. The materialisation triggers used `on conflict do nothing` but the table had no unique constraint, so duplicate flight/session inserts would silently double the itinerary. Caught by code-simplifier.

**How to apply:** Pair every `on conflict do nothing` with an explicit unique index/constraint and reference it (`on conflict (col1, col2) do nothing`). For partial unique indexes, also append the `where` predicate (`on conflict (cols) where source_id is not null do nothing`).

## 2026-04-30 - pgTAP belongs in its own schema

**Rule:** Install pgTAP via `create extension pgtap with schema tap`, not into public.

**Why:** pgTAP exports many SQL functions (~hundreds). When installed in `public`, they pollute `supabase gen types` output and trigger generated-code lint errors (duplicate type constituents). Isolating in a `tap` schema keeps `public` types clean.

**How to apply:** Always grant `usage` on the `tap` schema and `execute` on its functions to the `authenticated`/`anon` roles, and add `set search_path to public, tap, extensions;` at the top of each test file (else `tap.plan()` is unreachable from the authenticated role).

## 2026-04-30 - Lean on onAuthStateChange exclusively; never call getSession in parallel

**Rule:** In an AuthProvider, subscribe to `onAuthStateChange` only. The listener fires `INITIAL_SESSION` on mount, so the manual `getSession()` is redundant *and* races with the listener.

**Why:** Calling both creates a race: if `INITIAL_SESSION` fires before `getSession()` resolves, two `syncSession` calls happen for the same session. The race is silent today but breaks the moment a downstream effect reacts to state changes.

**How to apply:** AuthProvider's useEffect arms only the listener. Tests mock `onAuthStateChange` to invoke the callback synchronously with the desired session so the provider hydrates without waiting on a real subscription.

## 2026-04-30 - Use signInWithSSO for enterprise IdPs, not signInWithOAuth

**Rule:** Okta / SAML / generic enterprise SSO uses `supabase.auth.signInWithSSO({ domain })`. `signInWithOAuth({ provider: 'azure' })` is for Microsoft Entra (Azure AD) consumer/work accounts and is NOT a generic Okta switch.

**Why:** Initial M2 implementation called `signInWithOAuth({ provider: 'azure' })` while reading `oktaDomain` from env. The Okta config was tested for presence but never actually used at the call site — Azure AD would have been hit regardless. Caught by refactor-scan.

**How to apply:** Pass the Okta domain via `signInWithSSO({ domain: oktaDomain, options: { redirectTo } })`. Configure the SSO provider in the Supabase dashboard so the domain is recognized.

## 2026-04-30 - Don't double-dispatch state on signOut

**Rule:** After `supabase.auth.signOut()` succeeds, do NOT manually dispatch a `cleared` action. `onAuthStateChange` fires `SIGNED_OUT` and the listener handles it.

**Why:** Manual dispatch + listener dispatch = two state transitions for one logical event. Latent bug: any consumer that reacts to clears (logging, analytics) will fire twice.

**How to apply:** signOut just awaits the call and surfaces errors. The listener owns state transitions.

## 2026-04-30 - renderWithProviders default should be opt-in for AuthProvider

**Rule:** Test render helpers default to NOT wrapping in AuthProvider. Tests opt in with `withAuth: true` when the component reads `useAuth`.

**Why:** Default-on means every test triggers the Supabase singleton via `getSupabaseClient()`. State leaks across tests if `__resetSupabaseClientForTests` isn't called religiously. Inverting the default makes the dependency explicit and contains it to tests that actually need it.

**How to apply:** `renderWithProviders(ui)` skips auth. `renderWithProviders(ui, { withAuth: true })` wraps. The opt-in test must also inject a fake client via `__resetSupabaseClientForTests` whose `onAuthStateChange` synchronously fires `INITIAL_SESSION`.

## 2026-04-30 - Don't auto-seed via supabase config when using declarative schemas

**Rule:** Set `[db.seed].sql_paths = []` in `supabase/config.toml`. Run seed yourself after applying schemas.

**Why:** `supabase db reset` runs migrations then seed. Declarative schemas aren't migrations, so reset wipes the DB and seed runs against an empty schema, blowing up. Owning the order ourselves (reset → apply schemas → install pgtap → seed) keeps the loop fast and predictable.

**How to apply:** Use `scripts/db-apply.sh` (wraps the four steps idempotently). The package.json `db:apply` script calls it.

## 2026-04-30 - Event-specific data lives in `supabase/events/`, not `seed.sql`

**Rule:** Event identity (one Supafest year) lives in its own SQL file under `supabase/events/`. `seed.sql` is for *people* fixtures only — auth users, employee_profiles, the lone guest. The two are applied in order by `scripts/db-apply.sh`.

**Why:** Year-end resets: drop the old events file, add the new one. The seed identity stays. Mixing them meant a year transition required hand-editing dates inside an already-busy seed. The user ran into this with the Notion update (Jan 11-15 vs the wrong Apr 12-16 we had).

**How to apply:** Each `events/YYYY-supafest.sql` opens with a `do $$` block that defines the constants (event id, name, dates, time zone, deadlines) and exits early if that event id already exists. Documents, sessions, and starter registrations follow. Add a new year by copying the file and editing the constants.

## 2026-04-30 - Save the data you parsed before reporting success

**Rule:** When an import flow has a "parse" step and a "persist" step, the UI must call both before reporting success to the user. Reporting success after parse-only is a data-loss bug.

**Why:** The first cut of `ImportItineraryDialog` called `parseItineraryViaEdge` and then `onImported()` without ever calling `saveParsedFlights`. The toast said "Imported N items" but nothing landed in `public.flights`. Caught by the post-merge audit, not by the user, but it would have shown up the first time someone tried to import.

**How to apply:** Treat persist as part of the same try/catch as parse. The success toast count comes from the *persist* return value, not the parse result, so the user sees what actually got saved.

## 2026-04-30 - timestamptz isn't enough — render zone matters

**Rule:** Every itinerary-style row needs a render timezone column alongside its timestamptz. A flight from SFO to YYC has departure in PT and arrival in MT; rendering both in the viewer's local clock is wrong.

**Why:** timestamptz stores UTC. `Intl.DateTimeFormat` defaults to the viewer's timezone. Without an explicit IANA name on the row, the data round-trips correctly but renders incorrectly. Adding the columns later means a backfill — easier to bake in from day one.

**How to apply:** New event-time tables (itinerary_items, flights, transport_requests, sessions backed by accommodations) get `*_tz text` columns. Triggers populate from `events.time_zone` (default), `flights.departure_tz/arrival_tz` (per-airport), or `transport_requests.pickup_tz`. The renderer threads the row's tz into `Intl.DateTimeFormat({ timeZone })`.

## 2026-04-30 - One Section per registration domain, two render modes

**Rule:** Each registration domain (personal info, dietary, etc.) lives in exactly one component — `XyzSection` — that takes a `mode` discriminated union for wizard vs profile. There are no mirrored Step/Card pairs.

**Why:** The earlier pattern had `XyzStep.tsx` (wizard) and `XyzCard.tsx` (profile) for each domain. They drifted: profile cards rendered fewer fields than wizard steps, so saving from profile silently overwrote wizard-collected fields with null. The user reported it as "duplication, eliminate it" but the underlying defect was data loss.

**How to apply:** New domains go through `src/features/registration/sections/` only. Use `SectionChrome` for the mode-aware shell (StepShell vs CardShell) and `useSectionSubmit` for the post-save side effects (markTaskComplete + advance vs toast). Both wizard and profile mount the same Section component.

## 2026-05-01 - Per-column write rules belong in a trigger, not RLS

**Rule:** When a column needs different write permissions than the rest of its row (e.g. `users.is_leadership` is admin-only while every user can edit their own `email`), enforce the rule with a `BEFORE UPDATE` trigger on that specific column, not by adding/removing RLS policies.

**Why:** RLS UPDATE policies gate the row, not the column. Splitting by column means either inventing per-column tables or tacking on `with check` clauses that compare every editable column to its old value — both fragile. A single trigger that compares `new.is_leadership IS DISTINCT FROM old.is_leadership` and raises if `not is_admin()` is one assertion in one place.

**How to apply:** Pair the trigger with a SECURITY DEFINER RPC for the blessed write path (e.g. `set_user_leadership(uuid, boolean)`). The RPC does the admin check up front and returns a typed error; the trigger is the belt-and-braces backstop that catches direct UPDATEs from any future code path.

## 2026-05-01 - Don't useEffect for data fetching or state derivation

**Rule:** Reach for TanStack Query (or a parent `key` for remount) instead of `useEffect` whenever the body of the effect either fetches data or sets state derived from other state. Reserve `useEffect` for one-time external sync, and prefer `useMountEffect` for that case so intent is explicit.

**Why:** Effect-based fetching gets race conditions for free, has to reinvent caching/cancellation, and creates extra renders before the data lands. Effect-based state derivation runs N+1 renders. Both are common foot-guns.

**How to apply:** When writing a new component, the order is: hooks → query/mutation → local state → derived values (inline) → handlers → render. If you find yourself typing `useEffect(() => set...(...))`, stop and pick a different rule. See `~/.claude/skills/no-use-effect/SKILL.md`.

## 2026-05-01 - Generic repository for user-scoped tables

**Rule:** Tables keyed on `user_id` (registration sections, accessibility, dietary, etc.) use `createUserScopedRepository` from `src/features/registration/api/userScopedRepository.ts` rather than hand-rolled load/save pairs.

**Why:** The pre-refactor pattern was a six-line load function and a six-line save function per section, only the table name and column list differed. Drift was inevitable; one section forgot a column once and silently overwrote it. The generic helper keeps the column list in one place and the load/save pair stays in lock-step.

**How to apply:** Add a new section by writing `createUserScopedRepository<'table_name', FormShape>({ table, toInsert })` and exporting `repo.load` / `repo.save`. The Supabase generic-typing gymnastics live inside the helper; callers see fully-typed `RowOf<T>` and `InsertOf<T>`.

## 2026-04-30 - Supabase CLI is a system install, not an npm dep

**Rule:** Don't add `supabase` to `package.json` devDependencies. Install via `brew install supabase/tap/supabase` (or system equivalent) and document it in README prerequisites.

**Why:** The npm-distributed package lags the official one. Mixing the two leads to `command not found: supabase` confusion or version mismatch on `db diff`.

**How to apply:** README prerequisites list. CI installs via the official Supabase setup action when we add migration deploys later.

## 2026-05-01 - Don't bake an event timezone into module-level constants

**Rule:** Helpers that format timestamps (`Intl.DateTimeFormat`) take a `timeZone` argument and build the formatter per call (or per render via `useMemo`). Don't export a module-level `WINDOW_TZ = 'America/Edmonton'` constant.

**Why:** Phase 1 ships from Banff but Phase 2 will run from a different city. A module-level constant pretends one timezone fits every event, and the only way to reuse the screen for a Lisbon event is to grep-and-replace strings. Threading `event.time_zone` through the call sites makes the timezone an explicit input, not a hidden assumption.

**How to apply:** Read the active event's `time_zone` (and `airport_iata`) from `useActiveEvent()` and pass it down as a prop. Schema columns (`transport_vehicles.pickup_tz`, `transport_requests.pickup_tz`) drop their `default 'America/Edmonton'` so a missing value surfaces as a NOT NULL violation at insert time instead of silently writing the wrong zone. The Ground Transport Tool now does both.

## 2026-05-01 - SECURITY DEFINER RPCs need admin readback in pgTAP

**Rule:** When a pgTAP test verifies a SECURITY DEFINER RPC's write, perform the readback with `reset role` (postgres) so RLS doesn't hide the row from the very user who just wrote it.

**Why:** A SECURITY DEFINER function bypasses RLS for the write but the surrounding test session still runs as `authenticated <user>`. RLS on the target table can return zero rows on the readback even though the write landed. The first cut of the special_requests test failed for this reason — `lives_ok` reported success and `select special_requests` reported NULL.

**How to apply:** In pgTAP: `set local role authenticated; ... call RPC ... reset role; select <column> from <table>` for the assertion. Then `set local role authenticated;` again before the next negative-path test.

## 2026-05-01 - Toast must be loud or it's invisible

**Rule:** Toasts that confirm a user-initiated action (save, payment, sign-in, recovery email) need to be solid-colour, top-of-viewport, with an icon and 5s minimum duration. A faint outline-only toast in the bottom-right of a tall page IS the same as no toast.

**Why:** A user reported "no toast was seen" across PersonalInfo / Swag / Transport / Passport / EmergencyContact saves. Playwright proved every section was actually saving (200s in the network tab) and the toast was being inserted into the DOM. The toast just lived bottom-right with `border-primary/30 text-foreground` for 3.5s on a 1400px-tall page — easy to miss while focused on the form.

**How to apply:** ToastProvider uses `bg-primary/destructive` solid colour, top-center anchor, lucide icon, 5s TTL. Every Save handler is funnelled through useSectionSubmit so success and error both emit a toast — covered by useSectionSubmit.test.tsx so the contract can't regress silently.

## 2026-05-01 - Dependents are users too (just shadow ones)

**Rule:** When a feature ("fill in registration for my child") needs to write into per-section tables that are keyed on user_id, give that subject a SHADOW row in public.users with a dedicated role rather than threading parallel `additional_guest_id` columns through every per-section table.

**Why:** Considered three options for dependents-as-attendees: (1) add `additional_guest_id` to every per-section table with CHECK constraints, (2) mint a shadow public.users row, (3) widen additional_guests with all the per-section columns. Option 1 doubles the surface area of every RLS policy and turns each load/save pair into a dual-write. Option 3 reverses the one-domain-per-table architecture. Option 2 reuses the existing schema and the existing Section components — RLS picks up the dependent branch via a single helper change.

**How to apply:** The shadow row's `id` joins to additional_guests.user_id so the pairing is bidirectional. RLS uses an `is_self_or_admin` helper that resolves true for the sponsor of any user_id whose role='dependent'. Components read user_id from useActiveSubject (a context that defaults to auth.user) rather than directly from useAuth. ProfileScreen mounts the provider and renders a SubjectSelector pill row when minors exist.
