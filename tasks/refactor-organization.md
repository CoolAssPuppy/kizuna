# Codebase organization refactor

> A standalone plan, separate from `tasks/todo.md`. Goal: make the file layout impeccable for handoff to senior engineers (including security review).

## Outcomes

- Feature-sliced design applied **consistently** across `src/features/*`.
- `src/components/` is a small set of truly-shared primitives, not a 24-file grab bag.
- `src/components/ui/` stays exactly as-is (shadcn primitives).
- App-shell chrome lives in `src/app/chrome/`, not `components/`.
- The CLI/terminal feature is a real feature in `src/features/cli/`, not stranded across `components/` and `hooks/`.
- All folder names are kebab-case (per `rules/code-style.md`).
- `features/admin/` is reorganized into per-tool subfolders so a new engineer can find any admin screen in one hop.
- Tiny single-screen "features" (`welcome/`, `errors/`) stay put for predictable routing surfaces (intentional consistency carve-out, justified below).

## Conventions enforced after this refactor

1. **Folder names** are kebab-case. Single words are fine (`agenda/`, `photos/`).
2. **File names**: PascalCase for components, camelCase for hooks and utilities, lowercase-with-dashes only for shadcn primitives in `components/ui/`.
3. **Feature layout**:
   - `<feature>/<Screen>.tsx`, `<feature>/<Component>.tsx` at the root.
   - Inner `components/` subfolders **only** when (a) the feature has 10+ component files, or (b) the subfolder has a real semantic name (`sections/`, `person/`, `photos/`). No "components/" for components' sake.
   - `api.ts` for single-resource features; `api/<resource>.ts` once a feature touches three or more distinct tables.
   - Tests colocated next to the file under test.
4. **`src/components/`** — only primitives used by **3+ features** (or by both `app/` and a feature). Anything used by one feature lives in that feature.
5. **`src/hooks/`** — only hooks used by **3+ features**. Single-feature hooks live in the feature.
6. **`src/app/`** — routing, layout, providers, app-shell chrome. Never imports from a feature for shell purposes.

## Phase 0 — pre-flight

Goal: prove the tree is green before touching anything. If anything fails, stop and fix first.

- [ ] `git status` clean on `main`
- [ ] `git pull` up-to-date
- [ ] `npm install`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] Tag baseline: `git tag pre-refactor-org`

## Phase 1 — kebab-case folders + lib relocations

**Risk:** trivial. Pure renames + one move.

**Folder renames** (`git mv` to preserve history):

- `src/features/admin/groundTransport/` → `src/features/admin/ground-transport/`
- `src/features/admin/roomAssignment/` → `src/features/admin/room-assignment/`

**File moves**:

- `src/features/welcome/timeOfDay.ts` → `src/lib/timeOfDay.ts`
- `src/features/welcome/timeOfDay.test.ts` → `src/lib/timeOfDay.test.ts`

**Import updates** (run after the moves):

- All `from '@/features/admin/groundTransport/*'` → `from '@/features/admin/ground-transport/*'`
- All `from '@/features/admin/roomAssignment/*'` → `from '@/features/admin/room-assignment/*'`
- All `from '@/features/welcome/timeOfDay'` → `from '@/lib/timeOfDay'`

**Verification**:

- [ ] `npm run typecheck` zero errors
- [ ] `npm run lint` zero errors
- [ ] `npm run test:run` all pass
- [ ] `npm run build` clean
- [ ] `npm run format`

**Commit**: `refactor: kebab-case admin folders and lift timeOfDay to lib`

## Phase 2 — extract `features/cli/`

**Risk:** low. Single feature pulled out of three locations.

The terminal/CLI is a real feature: a command palette UI, a hook, and a renderer. The dispatcher and command registry already live in `lib/cli/` (correct — that's a library). We pull the UI and hook into a feature folder.

**Create** `src/features/cli/`.

**Moves**:

- `src/components/CommandPalette.tsx` → `src/features/cli/CommandPalette.tsx`
- `src/components/CommandOutput.tsx` → `src/features/cli/CommandOutput.tsx`
- `src/components/CommandOutput.test.tsx` → `src/features/cli/CommandOutput.test.tsx`
- `src/hooks/useTerminal.ts` → `src/features/cli/useTerminal.ts`

**Stays put** (this is the CLI library, not the feature):

- `src/lib/cli/` — unchanged.

**Stays put** (these are visual *primitives*, used outside the CLI feature too — by welcome/sign-in/community/home/etc.):

- `TerminalEyebrow`, `TerminalHeader`, `TerminalResults` — handled in Phase 3.

**Import updates**:

- `from '@/components/CommandPalette'` → `from '@/features/cli/CommandPalette'`
- `from '@/components/CommandOutput'` → `from '@/features/cli/CommandOutput'`
- `from '@/hooks/useTerminal'` → `from '@/features/cli/useTerminal'`

**Verification**: typecheck, lint, tests, build, format. All green.

**Commit**: `refactor: extract cli feature from shared components and hooks`

## Phase 3 — split `src/components/`

**Risk:** moderate. Many small import updates, but mechanical.

Today `src/components/` has 24 files at the top doing six different jobs. After this phase it has ~10 files: shared primitives only.

**3a — Create `src/app/chrome/`** for app-shell pieces. These are imported by `AppLayout.tsx`, never by feature screens.

Move:

- `src/components/AppFooter.tsx` → `src/app/chrome/AppFooter.tsx`
- `src/components/FooterTerminal.tsx` → `src/app/chrome/FooterTerminal.tsx`
- `src/components/FooterTagline.tsx` → `src/app/chrome/FooterTagline.tsx`
- `src/components/HeaderUserMenu.tsx` → `src/app/chrome/HeaderUserMenu.tsx`
- `src/components/LanguagePicker.tsx` → `src/app/chrome/LanguagePicker.tsx`
- `src/components/ThemePicker.tsx` → `src/app/chrome/ThemePicker.tsx`
- `src/components/OfflineBanner.tsx` → `src/app/chrome/OfflineBanner.tsx`
- `src/components/MobilePrompt.tsx` → `src/app/chrome/MobilePrompt.tsx`
- `src/components/SupabaseWordmark.tsx` → `src/app/chrome/SupabaseWordmark.tsx`

**3b — Create `src/components/terminal/`** for the terminal-aesthetic visual primitives. They're reused across welcome, sign-in, home dashboard, community — true shared primitives, but distinct enough to deserve a subfolder.

Move:

- `src/components/TerminalEyebrow.tsx` → `src/components/terminal/TerminalEyebrow.tsx`
- `src/components/TerminalHeader.tsx` → `src/components/terminal/TerminalHeader.tsx`
- `src/components/TerminalResults.tsx` → `src/components/terminal/TerminalResults.tsx`

**3c — Promote `PdfUploader.tsx` to a shared primitive.**

`StorageImageUploader.tsx` already lives in `src/components/`. The CLAUDE.md treats `PdfUploader` as its sibling. Make that real:

- `src/features/admin/PdfUploader.tsx` → `src/components/PdfUploader.tsx`

**3d — `src/components/` final shape**:

```
src/components/
  ui/                     # shadcn (untouched)
  terminal/               # TerminalEyebrow, TerminalHeader, TerminalResults
  AirlineLogo.tsx         # shared between itinerary and admin/ground-transport
  Avatar.tsx
  CardShell.tsx
  CountrySelect.tsx
  EmailField.tsx
  EventGate.tsx
  PdfUploader.tsx
  RolePill.tsx
  RouteErrorBoundary.tsx
  StatusDot.tsx
  StorageImageUploader.tsx
```

**Import updates** (mechanical find/replace):

| Old | New |
|---|---|
| `from '@/components/AppFooter'` | `from '@/app/chrome/AppFooter'` |
| `from '@/components/FooterTerminal'` | `from '@/app/chrome/FooterTerminal'` |
| `from '@/components/FooterTagline'` | `from '@/app/chrome/FooterTagline'` |
| `from '@/components/HeaderUserMenu'` | `from '@/app/chrome/HeaderUserMenu'` |
| `from '@/components/LanguagePicker'` | `from '@/app/chrome/LanguagePicker'` |
| `from '@/components/ThemePicker'` | `from '@/app/chrome/ThemePicker'` |
| `from '@/components/OfflineBanner'` | `from '@/app/chrome/OfflineBanner'` |
| `from '@/components/MobilePrompt'` | `from '@/app/chrome/MobilePrompt'` |
| `from '@/components/SupabaseWordmark'` | `from '@/app/chrome/SupabaseWordmark'` |
| `from '@/components/TerminalEyebrow'` | `from '@/components/terminal/TerminalEyebrow'` |
| `from '@/components/TerminalHeader'` | `from '@/components/terminal/TerminalHeader'` |
| `from '@/components/TerminalResults'` | `from '@/components/terminal/TerminalResults'` |
| `from '@/features/admin/PdfUploader'` | `from '@/components/PdfUploader'` |

**Verification**: typecheck, lint, tests, build, format.

**Commit**: `refactor: split shared components into app chrome and primitives`

## Phase 4 — reshape `features/admin/`

**Risk:** highest of any phase. Largest number of files moved. Mitigated by per-tool grouping: each move is one tool, one commit if needed.

Today `features/admin/` has 18 `.tsx` at the root and 8 subfolders, with no clear principle for which is which. Target: each admin "tool" gets its own subfolder. Layout files and `api/` stay at the root.

**Target shape**:

```
src/features/admin/
  AdminLayout.tsx
  AdminRoute.tsx
  AboutScreen.tsx
  api/                          # unchanged
  agenda/
    AgendaAdminScreen.tsx       # was features/admin/AgendaAdminScreen.tsx
    SessionDialog.tsx           # was features/admin/SessionDialog.tsx
    sessionDraft.ts             # was features/admin/sessionDraft.ts
    agendaCsv.ts                # was features/admin/agendaCsv.ts
    agendaCsv.test.ts           # was features/admin/agendaCsv.test.ts
    AdminProposalsList.tsx      # already there
    AdminProposalsList.test.tsx # already there
    IconAction.tsx              # already there
    SessionListItem.tsx         # already there
  conflicts/
    ConflictsScreen.tsx         # was features/admin/ConflictsScreen.tsx
    ConflictsPanel.tsx          # was features/admin/ConflictsPanel.tsx
    conflicts.ts                # was features/admin/conflicts.ts
  documents/
    DocumentsScreen.tsx         # was features/admin/DocumentsScreen.tsx
    DocumentDialog.tsx          # was features/admin/DocumentDialog.tsx
  events/
    EventEditScreen.tsx         # was features/admin/EventEditScreen.tsx
    DomainsInput.tsx            # was features/admin/DomainsInput.tsx
    DomainsInput.test.tsx       # was features/admin/DomainsInput.test.tsx
  feed/
    FeedScreen.tsx              # was features/admin/FeedScreen.tsx
  ground-transport/             # already kebab from Phase 1
    GroundTransportToolScreen.tsx  # was features/admin/GroundTransportToolScreen.tsx
    NewVehicleDialog.tsx        # already there
    VehicleSidebar.tsx          # already there
    grouping.ts                 # already there
    grouping.test.ts            # already there
  invitations/                  # unchanged structure
  nudges/
    NudgesScreen.tsx            # was features/admin/NudgesScreen.tsx
    NudgeDialog.tsx             # was features/admin/NudgeDialog.tsx
  reports/
    ReportsScreen.tsx           # was features/admin/ReportsScreen.tsx
    ReportTable.tsx             # was features/admin/ReportTable.tsx
    csv.ts                      # was features/admin/csv.ts
    csv.test.ts                 # was features/admin/csv.test.ts
    dietary.ts                  # already there
    payments.ts                 # already there
    registration.ts             # already there
    rooming.ts                  # already there
    shared.ts                   # already there
    swag.ts                     # already there
    transport.ts                # already there
    index.ts                    # already there
  room-assignment/              # already kebab from Phase 1
    RoomAssignmentToolScreen.tsx   # was features/admin/RoomAssignmentToolScreen.tsx
    ImportRoomBlockDialog.tsx   # already there
    autoAssign.ts               # already there
    autoAssign.test.ts          # already there
    csv.ts                      # already there
    csv.test.ts                 # already there
    testRoomBlock.ts            # already there
  scan/
    ScanQrScreen.tsx            # was features/admin/ScanQrScreen.tsx
    scannerApi.ts               # already there
  stats/
    StatsScreen.tsx             # was features/admin/StatsScreen.tsx
  swag/                         # unchanged structure
  tags/
    TagsDialog.tsx              # was features/admin/TagsDialog.tsx
```

**Approach**: do this tool-by-tool to keep diffs reviewable, but ship as one commit. Order:

1. `agenda/` (5 file moves)
2. `conflicts/` (3 file moves)
3. `documents/` (2 file moves)
4. `events/` (3 file moves)
5. `feed/` (1 file move)
6. `ground-transport/` (1 file move)
7. `nudges/` (2 file moves)
8. `reports/` (4 file moves)
9. `room-assignment/` (1 file move)
10. `scan/` (1 file move)
11. `stats/` (1 file move)
12. `tags/` (1 file move)

After each tool: typecheck + lint to catch broken imports immediately. Then ship the lot as one commit.

**Import updates**: every consumer of these files. The router (`src/app/router.tsx`) and `AdminLayout.tsx` are the main ones; a handful of cross-tool imports (e.g. `csv.ts` is shared between rooms/reports — verify no breakage).

**Verification**:

- [ ] `npm run typecheck` zero errors
- [ ] `npm run lint` zero errors
- [ ] `npm run test:run` all pass
- [ ] `npm run test:e2e` (admin flows specifically) pass
- [ ] `npm run build` clean
- [ ] `npm run format`
- [ ] Manual smoke: `npm run dev`, click through each admin tool, confirm routing works.

**Commit**: `refactor: group admin features by tool`

## Phase 5 — per-feature normalization

**Risk:** low to moderate. One feature per commit. Each is small and self-contained.

### 5a — `features/agenda/`: flatten inner `components/`

8 components total (4 in `components/`, 4 at root) — the inner folder adds noise. Flatten.

Moves:

- `src/features/agenda/components/FilterTab.tsx` → `src/features/agenda/FilterTab.tsx`
- `src/features/agenda/components/ProposalsList.tsx` → `src/features/agenda/ProposalsList.tsx`
- `src/features/agenda/components/SessionCard.tsx` → `src/features/agenda/SessionCard.tsx`
- `src/features/agenda/components/SessionCard.test.tsx` → `src/features/agenda/SessionCard.test.tsx`
- Delete empty `src/features/agenda/components/`.

Import updates: `from '@/features/agenda/components/X'` → `from '@/features/agenda/X'`.

**Commit**: `refactor(agenda): flatten components subfolder`

### 5b — `features/home/`: flatten inner `components/` and consolidate

9 components total — flatten and disambiguate `MemoriesSection`.

Moves:

- `src/features/home/components/EventEtaPanel.tsx` → `src/features/home/EventEtaPanel.tsx`
- `src/features/home/components/EventStatsPanel.tsx` → `src/features/home/EventStatsPanel.tsx`
- `src/features/home/components/HomeQueue.tsx` → `src/features/home/HomeQueue.tsx`
- `src/features/home/components/SidebarEditorialCard.tsx` → `src/features/home/SidebarEditorialCard.tsx`
- Delete empty `src/features/home/components/`.

Renames (for clarity vs `features/community/photos/MemoriesSection.tsx`):

- `src/features/home/HomeMemoriesSection.tsx` → `src/features/home/MemoriesPreview.tsx`
- Update the React component name inside from `HomeMemoriesSection` to `MemoriesPreview`.

Import updates: `from '@/features/home/components/X'` → `from '@/features/home/X'`; `HomeMemoriesSection` → `MemoriesPreview`.

**Commit**: `refactor(home): flatten components and rename memories preview`

### 5c — `features/itinerary/`: split `api.ts` into `api/`

The feature has `api.ts` (CRUD) plus `importApi.ts` (parsing/import) plus `useItineraryImport.ts`. Three resource clusters: items, import, types. Crossing the threshold for `api/`.

Moves:

- `src/features/itinerary/api.ts` → `src/features/itinerary/api/items.ts`
- `src/features/itinerary/importApi.ts` → `src/features/itinerary/api/import.ts`
- New: `src/features/itinerary/api/index.ts` — re-export everything from `items.ts` and `import.ts` so callers can `from '@/features/itinerary/api'`.

Import updates: any `from '@/features/itinerary/api'` keeps working through the new barrel; `from '@/features/itinerary/importApi'` becomes `from '@/features/itinerary/api/import'` (or via the barrel).

**Commit**: `refactor(itinerary): split api into resource modules`

### 5d — `features/community/`: minor consolidation

Community is the largest feature; `person/` and `photos/` subfolders are semantic and should stay. The 12 flat files at the root are real domain code (chat, profile, map, helpers). I considered grouping markdown helpers into a subfolder, but it would split tightly-coupled files (`MarkdownText.tsx` ↔ `markdown.ts`). **No change** beyond confirming layout.

Verification only:

- [ ] Confirm all flat files at root have a clear single responsibility
- [ ] Confirm no consumer of community imports anything renamed in earlier phases

**Commit**: none if no changes (skip).

### 5e — `features/admin/CheckinAccessCard.tsx`-style stragglers in home

After 5b this is already handled. Verify `src/features/home/CheckinAccessCard.tsx` still has consumers and stays at root (which is now consistent — no more inner `components/`).

### 5f — relocate `hooks/useDragReorder.ts`?

Used only by registration's reorder UI and one admin reorder UI. Two consumers — borderline. Decision: **leave in `src/hooks/`**. Two features qualifies as shared, and `useDragReorder` is a generic util (drag/keyboard a11y reorder), not a registration concept.

No move.

### 5g — relocate `hooks/useHydratedFormState.ts`, `useDebouncedValue.ts`, `useMountEffect.ts`, `useSupabaseUpload.ts`?

Audit each:

- `useDebouncedValue.ts` — generic, multiple consumers. Stay.
- `useHydratedFormState.ts` — generic, multiple consumers. Stay.
- `useMountEffect.ts` — generic primitive (replacement for the no-useEffect rule's escape hatch). Stay.
- `useSupabaseUpload.ts` — Supabase-specific, multiple consumers. Stay.

No moves.

## Phase 6 — documentation refresh

**Risk:** zero — text only.

Update three places that document layout:

- `README.md` — repository layout section. Reflect the new `app/chrome/`, slimmed `components/`, `features/cli/`, admin per-tool subfolders.
- `CLAUDE.md` — "Repository layout" tree. Same updates.
- `AGENTS.md` (if it exists) — same updates.

Add a one-paragraph "Where things live" section to README:

> **Where things live.** Each `features/<x>/` folder owns its UI, hooks, and Supabase calls. `src/components/` holds primitives shared by 3+ features (or by app shell + a feature). `src/components/ui/` holds shadcn primitives untouched. `src/app/` holds the router, providers, layout, and chrome (header, footer, language picker). `src/lib/` holds cross-cutting utilities (Supabase client, i18n, formatters, the CLI library). `src/hooks/` holds hooks shared by 3+ features. Tests sit next to the file under test.

**Commit**: `docs: update layout docs to match refactored tree`

## Final verification

- [ ] `npm run typecheck` zero errors
- [ ] `npm run lint` zero errors
- [ ] `npm run test:run` all pass
- [ ] `supabase test db` all pass (no DB changes, sanity only)
- [ ] `npm run test:e2e` all pass
- [ ] `npm run build` clean, bundle size unchanged
- [ ] `npm run format`
- [ ] Manual smoke through every top-level route in `npm run dev`
- [ ] `git diff pre-refactor-org HEAD --stat` reviewed for sanity (only renames + import path updates expected; no functional diffs)

## Rollback plan

Each phase is a single commit. Revert any phase by `git revert <sha>`. The `pre-refactor-org` tag is the absolute rollback point.

## Out of scope (deferred, with reasoning)

- **Move `features/welcome/` and `features/errors/` into `app/`**: keeping them as features preserves the predictable "every route lives in a feature" mental model. Net win is small, churn is non-trivial, and security review benefits from the convention. Consciously left.
- **Restructure `features/community/` further**: any extra grouping there (chat/, map/, etc.) splits tightly-coupled files. Refused on principle (don't centralize, but also don't shred coherent feature code).
- **Promote `AirlineLogo.tsx` to a feature**: it's used by both itinerary and admin/ground-transport, which is exactly the "primitive used by 3+ surfaces" case (counting `app/chrome/MobilePrompt`). Stays in `components/`.
- **Touch `lib/cli/`**: it's already a clean library. CLI dispatcher and command registry are not feature concerns.
- **Touch shadcn primitives in `components/ui/`**: never. Generated; treat as external.

## Estimated effort

Six commits, ~3-4 hours of careful work. Most cost is in Phase 4 (admin reshape) and verifying imports after each phase. No functional changes — every move is a rename + import update.
