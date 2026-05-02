# Security and Refactoring Audit (Vite + React + Supabase)

Generated: 2026-05-02 (UTC)
Scope reviewed: `src/**`, `supabase/**`, root build/env files.

## Executive summary
- The codebase demonstrates mature Supabase usage (RLS policies, helper functions, tests), but still has **material data-exposure and hardening gaps**.
- **Top risk:** several tables/buckets intentionally readable by all authenticated users, including document metadata/content and broad community records; this is a design risk if any row is sensitive.
- **Top architectural issue:** heavy use of `select('*')` in client queries creates over-fetch + future drift risk.
- **Top refactor opportunity:** repeated Supabase query/mutation patterns and duplicated feature-level data access wrappers should be centralized.

## Critical security findings
1) **Over-broad authenticated read on documents table**  
- Severity: Critical
- Category: Authorization / Data exposure
- File: `supabase/schemas/90_rls.sql`
- Problem: `documents_authenticated_read` allows every authenticated user to select from `public.documents`.
- Why it matters: if docs include confidential HR/legal/event information, all users can read all rows.
- Exploit scenario: low-privilege user queries all docs across events.
- Fix: scope read to event membership and audience role checks.
- Example patch:
```sql
create policy documents_scoped_read on public.documents
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.registrations r
    where r.user_id = auth.uid()
      and (documents.event_id is null or r.event_id = documents.event_id)
  )
);
```
- Tests: add RLS tests for cross-event denial.
- Priority: P0

## High-risk security findings
1) **Blanket table grants to `anon`/`authenticated` increase blast radius if RLS regresses**
- Severity: High
- Category: Defense in depth
- File: `supabase/schemas/99_grants.sql`
- Problem: `grant all on all tables ... to anon, authenticated`.
- Why: RLS is the only guardrail; one bad policy instantly becomes full table exposure.
- Fix: restrict to needed verbs per role; keep permissive grants only where strictly required.

2) **Edge admin client helper can be misused without explicit per-function guard enforcement**
- Severity: High
- Category: Privilege escalation risk
- File: `supabase/functions/_shared/supabaseClient.ts`
- Problem: `getAdminClient()` is easy to call; controls rely on developer discipline.
- Why: one missing guard in an edge function can bypass RLS.
- Fix: wrap admin client retrieval in a mandatory guard helper returning typed admin context.

## Medium-risk security findings
1) **Widespread `select('*')` over-fetching**
- Severity: Medium
- Category: Least privilege / privacy
- Files: multiple (`src/features/**/api*.ts`, `src/features/documents/api.ts`, `src/features/agenda/api.ts`)
- Problem: broad selection pulls more columns than needed.
- Why: increases accidental sensitive-field exposure and payload size.
- Fix: replace with explicit column lists.

2) **Client env fallback can mask misconfiguration in production**
- Severity: Medium
- Category: Operational security
- File: `src/lib/env.ts`
- Problem: missing env falls back to placeholders and logs error instead of failing fast.
- Why: may hide broken prod config until runtime behavior fails.
- Fix: fail-hard in production builds; keep fallback only in local/dev.

## Low-risk security findings
1) **Inconsistent external link handling patterns**
- Severity: Low
- Category: Browser hardening consistency
- Files: multiple components with external anchors
- Problem: mostly safe, but pattern should be centralized.
- Fix: shared `SafeExternalLink` component.

## Supabase-specific audit
- Strong: comprehensive RLS policy file and dedicated SQL tests in `supabase/tests/*.sql`.
- Risk: policy strategy includes multiple `auth.role() = 'authenticated'` read policies that may be too broad for private datasets.

## Vite-specific audit
- `VITE_` usage appears limited to publishable values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- No obvious client-exposed service-role key found.
- Recommend build guard: fail CI if any `VITE_` var name matches `SECRET|TOKEN|SERVICE`.

## shadcn/ui and frontend component audit
- No `dangerouslySetInnerHTML` found.
- `react-markdown` usage does not appear to enable raw HTML plugin in reviewed files.
- Duplicate loading/error rendering patterns across screens should be standardized.

## Authentication and authorization audit
- Auth model relies properly on Supabase auth + RLS.
- Watchouts: any function/query passing user IDs from UI must remain RLS-backed (several do).

## Database and RLS audit
- Table-by-table matrix requires live DB introspection (`pg_class`/`pg_policies`) to be exhaustive.
- Static review indicates RLS enablement automation plus many specific policies.

## Storage audit
- Storage policies exist for bucket-level controls in `95_storage.sql`.
- Verify that all public-readable buckets are intentional and documented.

## Edge Functions audit
- Shared helper supports user-scoped and admin-scoped clients.
- Missing global rate-limit/idempotency wrapper across functions.

## API and data-fetching audit
- Heavy duplication of feature-local API wrappers and query logic.
- Recommend shared query layer with explicit column fragments and centralized errors.

## Secrets and environment variable audit
- `.env.example` present.
- No obvious committed `.env` secrets observed in reviewed file list.

## Input validation and injection audit
- Validation exists in places but not consistently centralized.
- Recommend schema-first (Zod) at mutation boundaries and edge function request parsing.

## XSS, CSRF, and browser security audit
- No direct DOM XSS sink (`dangerouslySetInnerHTML`) found.
- Markdown rendering appears safer by default settings; keep raw HTML disabled.

## Dependency and supply-chain audit
- Lockfile present (`package-lock.json`).
- Postinstall script copies local asset; low risk but should remain deterministic.

## Error handling, logging, and observability audit
- Error handling patterns vary by feature.
- Recommend unified error taxonomy + audit logging for sensitive writes.

## Duplicated code and duplicated algorithm audit
| Pattern | Files | Duplication type | Risk | Proposed abstraction | New location |
|---|---|---|---|---|---|
| Supabase `select('*')` query wrappers | `src/features/*/api*.ts` | Data-access duplication | Security drift/over-fetch | typed repository helpers | `src/lib/supabase/queries/` |
| Loading/error/empty states | multiple screens | UI duplication | inconsistent failure UX | standard state components | `src/components/shared/states/` |
| Permission checks (`isAdmin`, subject logic) | auth + features | auth logic duplication | accidental bypass | permission predicates | `src/lib/auth/permissions.ts` |

## Refactoring plan
1. Replace `select('*')` with explicit columns in top-traffic endpoints.
2. Introduce shared Supabase repository primitives.
3. Introduce shared auth/permission helpers.
4. Add lint rules for env key exposure and forbidden broad selects.

## Proposed shared libraries
- `src/lib/supabase/queries/*`
- `src/lib/auth/permissions.ts`
- `src/lib/security/url.ts`
- `src/lib/errors/handleError.ts`

## Proposed shared components
- `SafeExternalLink`
- `QueryStateBoundary` (loading/error/empty)
- Shared form error summary

## Proposed hooks and utilities
- `useScopedQuery` (centralized query+error handling)
- `usePermission` / `can()`

## Proposed database and policy changes
- Tighten documents read policy to event/member scope.
- Reassess broad authenticated-read policies for community tables.
- Reduce blanket grants to least required privileges.

## Test plan
- Add SQL RLS tests for cross-event doc access denial.
- Add integration tests for explicit-column query contracts.
- Add lint/test that fails on accidental `VITE_*SECRET*` names.

## Prioritized remediation roadmap
- **Today:** tighten `documents` RLS, remove highest-risk `select('*')` calls.
- **This week:** centralize data-access + permission helpers, add guardrails in CI.
- **This month:** reduce blanket grants and migrate to least-privilege grants.
- **Later:** broader policy performance tuning + audit logging expansion.

## Exact implementation checklist
- [ ] Replace `documents_authenticated_read` with scoped policy.
- [ ] Add SQL tests for doc scoping edge cases.
- [ ] Refactor top 10 API calls away from `select('*')`.
- [ ] Add ESLint custom rule or codemod check for broad selects.
- [ ] Add env-key CI check for `VITE_` secret names.
