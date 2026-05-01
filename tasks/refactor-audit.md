# Kizuna Codebase Audit (May 1, 2026)

## Scope
- React + Vite + shadcn/ui frontend architecture and component refactor opportunities.
- Supabase schema quality review (duplication, consistency, long-term maintainability).
- OWASP-aligned security audit across web app, edge functions, and database policies.

---

## Executive Summary (Prioritized)

### P0 — Must do before launch
1. **Centralize registration section data access into a typed repository layer** to eliminate repetitive `loadX/saveX` boilerplate and inconsistent error handling. This is currently duplicated across many files and encourages drift over time. Targets: `src/features/registration/api/*.ts`.
2. **Replace channel-as-string chat model with normalized channels/memberships tables** and corresponding RLS policies. Current `messages.channel` free-text design is explicitly marked as a simplification and is a long-term authorization footgun.
3. **Threat-model and harden Stripe flow + edge functions**: add idempotency keys, verify anti-replay behavior, restrict outbound assumptions, and ensure webhook/event reconciliation cannot be abused.
4. **Add schema-level domain constraints for all externally structured strings** (IATA, timezone, URLs, enum-like text fields still modeled as `text`) and enforce with CHECK/domain constraints.

### P1 — High value, low risk
5. **Adopt route-level Suspense boundaries + intent prefetching** to improve perceived performance and align with expert Vite/React patterns.
6. **Codify “no barrel imports in feature internals” rule** for tree-shaking clarity and dependency hygiene.
7. **Create a design-system wrapper layer on top of shadcn primitives** (domain components + strict prop contracts) to prevent presentational duplication across screens.
8. **Standardize query/mutation hooks around a shared API contract** (React Query key factory + error normalization + optimistic update conventions).

### P2 — Strategic improvements
9. **Partition and archive strategy for high-volume tables** (`messages`, `notifications`, `itinerary_items`) before growth pain appears.
10. **Add explicit secure coding ADRs + CI guards** for OWASP controls (headers, CSP, dependency audit, SQL policy tests, edge function auth tests).

---

## Frontend Refactor Opportunities (Vite + React + shadcn)

### 1) Registration API duplication is structurally high
The registration API files repeat the same upsert/load pattern with only table names and payload shapes changed. This is expensive to maintain and easy to desynchronize.

Examples:
- `savePersonalInfo/loadPersonalInfo`. 
- `saveDietary/loadDietary`.
- `saveAccessibility/loadAccessibility`.

**Refactor plan**
- Introduce a generic helper: `createUserScopedUpsertLoader<Table, Row, Insert>()`.
- Move per-section mapping into pure transform functions (input → DB payload, DB row → form model).
- Keep section-specific files thin (schema + mapping + exported hook).
- Add contract tests shared across all section repos.

**Claude Code tasking prompt**
- “Create a generic repository builder for user-scoped tables and migrate registration section APIs incrementally, preserving runtime behavior and tests.”

### 2) Router is already lazy-loaded, but boundary granularity can improve
The app uses route-level lazy imports well, but relies on one top-level `Suspense` fallback.

**Refactor plan**
- Add per-route/per-layout suspense boundaries for heavy areas (admin/documents).
- Add intent prefetch (`onMouseEnter`, `onFocus`, idle prefetch) for likely-next routes.
- Add chunk budget checks in CI (bundle analysis artifact).

### 3) Enforce feature boundaries and dependency direction
The registration API barrel explicitly warns against overuse, which is good, but this should be lint-enforced.

**Refactor plan**
- Add ESLint import rules (ban internal barrel usage in same feature subtree).
- Introduce module boundaries (`app`, `features`, `shared/lib`, `shared/ui`) via path constraints.

### 4) shadcn maturity: move from primitive usage to domain components
Likely duplication exists in forms/cards/status UI patterns across feature folders.

**Refactor plan**
- Build domain-level components: `RegistrationSectionCard`, `AsyncStatePanel`, `RoleGuardedAction`, `EmptyState`.
- Keep shadcn primitives internal to shared UI components, minimizing direct primitive composition in feature screens.
- Document component contracts in Storybook/MDX (or lightweight docs if Storybook is not desired).

### 5) React Query conventions likely fragmented
Given many API modules and feature hooks, key strategy and mutation patterns should be unified.

**Refactor plan**
- Create query key factory by domain.
- Centralize error translation (`PostgrestError` → user-safe error model).
- Define cache invalidation map per mutation.
- Add tests for cache behavior on critical flows (registration completion, document ack, notifications).

---

## Supabase Schema Review & Refactor Suggestions

### 1) Positive baseline
- Strong modular schema segmentation (`00..97`) with clear concern boundaries.
- Good use of enums and trigger-based invariants.
- RLS centralization and helper functions are thoughtful.

### 2) Normalization and duplication concerns

#### A. `messages.channel` as free text (known simplification)
This is the biggest model risk: authorization logic for “who can access channel X” tends to become string parsing and policy sprawl.

**Refactor**
- Add `channels` table (`id`, `type`, `event_id`, `created_by`, metadata).
- Add `channel_members` table (`channel_id`, `user_id`, role).
- Replace `messages.channel text` with `channel_id uuid` FK.
- Move access logic to membership-based RLS.

#### B. Repeated “updated_at touch trigger” registration
The touch-trigger list is manually curated. This is explicit but brittle as table count grows.

**Refactor**
- Either keep explicit list but enforce via schema test (fails if table with `updated_at` lacks trigger), or generate trigger attachment in a controlled DO block from information_schema.

#### C. Structured text should be constrained more aggressively
Fields like timezone names, URL-ish fields, and code formats could be invalid today yet accepted by schema.

**Refactor**
- Introduce domains/checks for IANA timezone pattern, URL format policy, and reusable code constraints.
- Convert repeated ad-hoc checks into named constraints/domains for consistency.

#### D. “Global or event-scoped” rows need explicit uniqueness strategy
For tables like `documents` with nullable `event_id`, be explicit about uniqueness semantics for global rows.

**Refactor**
- Add partial unique indexes for global-vs-event variants where needed.

### 3) Performance/indexing follow-up
- Validate all RLS predicates have supporting indexes.
- Add a benchmark script for top N queries used by app routes.
- Consider partitioning strategy for growth tables.

---

## OWASP-Oriented Security Audit Suggestions

### Methodology map
Use OWASP ASVS + OWASP Top 10 (2021) as checklist baseline and produce evidence artifacts per control.

### A01 Broken Access Control
- Verify every edge function path enforces auth/role as intended.
- Confirm no service-role path is reachable from non-admin requests.
- Add automated tests for forbidden role access in edge functions and RLS tables.

### A02 Cryptographic Failures
- Validate all encryption/decryption wrappers use least privilege and key rotation plan.
- Ensure no sensitive values are exposed in logs, client bundles, or errors.

### A03 Injection
- Supabase query builder mitigates most SQL injection risk, but validate any raw SQL usage in functions/triggers/scripts.
- Ensure dynamic filters/sort fields from client are allowlisted.

### A04 Insecure Design
- Add explicit abuse cases for invitation flows, report sharing tokens, and document acknowledgement workflows.
- Add replay/idempotency defense for payment and notification actions.

### A05 Security Misconfiguration
- Verify production CSP, HSTS, frame-ancestors, and CORS policies are explicit and tested.
- Tighten environment variable handling and default-deny behavior for missing secrets.

### A06 Vulnerable/Outdated Components
- Pin and regularly scan dependencies in CI (`npm audit`/SCA tooling).
- Track Supabase JS, Deno std, and Stripe API compatibility windows.

### A07 Identification & Authentication Failures
- Ensure role claim refresh strategy is defined when role changes.
- Validate session expiry, token invalidation expectations, and step-up controls for sensitive admin actions.

### A08 Software and Data Integrity Failures
- Require signed/verified CI pipeline for schema/function deployment.
- Protect seeds/fixtures from leaking test credentials or unsafe defaults.

### A09 Security Logging & Monitoring Failures
- Add structured audit logs for admin actions and share-link creation/use.
- Define alert thresholds for anomalous access patterns.

### A10 SSRF
- Review any external fetches (Stripe, share/report workflows) for URL allowlisting and outbound control assumptions.

---

## Concrete Backlog You Can Hand to Claude Code (Ordered)

1. **Registration repository unification (P0)**
   - Build generic upsert/load helper.
   - Migrate section APIs incrementally with tests unchanged.
   - Add lint rule preventing duplicate “load/save pair” patterns where helper applies.

2. **Chat schema hardening (P0)**
   - Introduce channels + memberships + migration script.
   - Rewrite message RLS around membership model.
   - Update frontend query layer accordingly.

3. **Edge function hardening pass (P0)**
   - Add idempotency keys to Stripe checkout creation.
   - Add request correlation IDs and structured security logs.
   - Add role/auth regression tests for every function.

4. **Schema constraints pass (P0/P1)**
   - Add domains/check constraints for timezone/code/url fields.
   - Add partial uniqueness for nullable scope columns.
   - Add pgTAP/sql tests validating constraints.

5. **Router and chunk strategy polish (P1)**
   - Add nested Suspense boundaries.
   - Add prefetch-on-intent for heavy routes.
   - Add bundle visualizer and CI budget.

6. **shadcn domain component layer (P1)**
   - Extract repeated UI patterns into shared domain components.
   - Keep primitives behind wrappers.

7. **React Query contract standardization (P1)**
   - Query key factory + mutation invalidation registry.
   - Unified error model and toasts.

8. **OWASP CI gates (P1/P2)**
   - Add static checks, dependency audit, header checks, RLS policy tests, and edge auth tests to CI.

---

## Notes for Execution
- Because this app is pre-launch, prioritize **schema correctness and auth invariants over backward compatibility**.
- Require each refactor PR to include:
  - measurable objective (bundle KB, duplicate LOC removed, policy coverage),
  - migration/test plan,
  - rollback strategy.
