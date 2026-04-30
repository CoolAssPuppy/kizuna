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

## 2026-04-30 - Supabase CLI is a system install, not an npm dep

**Rule:** Don't add `supabase` to `package.json` devDependencies. Install via `brew install supabase/tap/supabase` (or system equivalent) and document it in README prerequisites.

**Why:** The npm-distributed package lags the official one. Mixing the two leads to `command not found: supabase` confusion or version mismatch on `db diff`.

**How to apply:** README prerequisites list. CI installs via the official Supabase setup action when we add migration deploys later.
