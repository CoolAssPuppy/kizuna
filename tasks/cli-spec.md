# Kizuna CLI

> Status: implemented. M1–M4 shipped. M5 (cli_audit_log surfacing) is next.
> Last updated: 2026-05-06.
>
> This file is the source of truth for the CLI's _current_ shape. The
> earlier draft mixed plan and reference; this rewrite documents what's
> in the repo today, lists every registered command, and calls out the
> UI surfaces that still have no CLI equivalent.

## What it is

Three surfaces, one registry. Anything you can do in the in-app footer
terminal is the same call as `npx kizuna ...` and the same MCP tool.

| Surface       | Path                                              | Auth                                    | Format                                    |
| ------------- | ------------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| Footer (web)  | `src/components/FooterTerminal.tsx`               | Session JWT                             | JSON or Markdown panel above the bar      |
| Local CLI     | `npx @strategicnerds/kizuna`                      | PAT in `KIZUNA_TOKEN` env               | JSON to stdout, Markdown with `--format md` |
| MCP server    | `npx @strategicnerds/kizuna-mcp`                  | PAT, bootstrapped via `kizuna login`    | Structured JSON over MCP transport        |

All three call the same edge function (`supabase/functions/cli/`), which
calls the shared dispatcher in `src/lib/cli/`. Every command runs as the
authenticated user — RLS is the agent permission model.

## Architecture

```
                       ┌────────────────────────────────────────┐
                       │  src/lib/cli/registry.ts                │
                       │  registerCommand({ path, scope,         │
                       │    input, output, handler, examples })  │
                       └────────────────────────────────────────┘
                                       │
                       ┌────────────────────────────────────────┐
                       │  src/lib/cli/dispatcher.ts              │
                       │  parse → validate → authorize           │
                       │  → handle → format(json | md)           │
                       └────────────────────────────────────────┘
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   src/components/         supabase/functions/   packages/kizuna-mcp/
   FooterTerminal.tsx      cli/index.ts          src/server.ts
   (browser → dispatch     POST /functions/v1/   stdio MCP transport,
    in-process)            cli, PAT or session   tools auto-derived
                           JWT                    from registry zod
                                  │
                       packages/kizuna-cli/
                       src/bin/kizuna.ts
                       (HTTP wrapper around the
                        edge function)
```

The registry is the single source of truth. Adding a command means
writing a zod input + output schema and a handler; the footer, edge
function, and MCP server pick it up automatically because
`packages/kizuna-mcp/src/server.ts` reflects every entry in the registry
into an MCP tool, and the footer / edge function call the same
`dispatch()`.

## File layout

```
src/lib/cli/
  registry.ts               Command<TInput,TOutput> + registerCommand
  context.ts                CommandContext type (supabase, user, t, abort)
  dispatcher.ts             parse + validate + authorize + handle + format
  parser.ts                 verb-noun + flags + refs tokenizer
  serialize.ts              writes a parsed command back to a string (used by MCP)
  formatters/
    markdown.ts
  commands/
    _schemas.ts             shared zod fragments (FormatFlag, IdRef, ...)
    _shared.ts              cross-command helpers (getActiveEvent, ...)
    index.ts                imports every command module for side-effect register
    agenda.ts
    attendees.ts
    channels.ts
    events.ts               events list + event detail + allowed-domains
    help.ts
    invitations.ts          NEW: list / add / remove invitations (admin)
    me.ts                   plus me-* aliases for sub-commands
    me-documents.ts
    me-itinerary.ts
    me-notifications.ts
    me-roommates.ts
    me-sessions.ts
    me-transport.ts
    photos.ts
    schema.ts               machine-readable registry dump
    sessions.ts
    sessions-propose.ts     propose / list / vote / delete
    tags.ts                 list / create / update / delete

src/components/
  CommandPalette.tsx        cmd-K page jumper (separate from CLI)
  FooterTerminal.tsx        in-app CLI surface
  CommandOutput.tsx         collapsible output panel

src/features/profile/api-keys/
  ApiKeysSection.tsx        manage PATs from /profile
  CreateApiKeyDialog.tsx
  RevealOnceDialog.tsx
  api.ts
  hooks.ts

src/features/auth/cli-oauth/
  AuthorizeScreen.tsx       /cli/oauth-authorize
  CallbackScreen.tsx        /cli/oauth-callback (delivers code to local agent)
  api.ts

supabase/functions/cli/
  index.ts                  POST handler
  index.test.ts             contract tests (CORS, methods, JSON parsing)

supabase/functions/cli-oauth-exchange/
  index.ts                  authorization-code → PAT exchange

supabase/schemas/
  76_api_keys.sql           api_keys + oauth_codes + RLS
  77_cli_audit_log.sql      cli_audit_log + RLS

packages/kizuna-cli/
  package.json              "kizuna" bin
  src/
    bin/kizuna.ts
    config.ts
    httpClient.ts
    formatOutput.ts
    oauth.ts                kizuna login (browser handoff)

packages/kizuna-mcp/
  package.json              "kizuna-mcp" bin
  src/
    bin/kizuna-mcp.ts
    server.ts               registers an MCP tool per command
    httpClient.ts
```

## Auth + scope

Three roles flow through the dispatcher: `user`, `admin`, `super_admin`.
PATs carry one of `read | write | admin` scopes. The dispatcher rejects
the command before the handler runs when scope insufficient.

| PAT scope | Reachable commands                                    |
| --------- | ----------------------------------------------------- |
| read      | Public + every `scope: 'user'` command marked non-mutation |
| write     | Above plus `scope: 'user'` mutations (RSVP, propose, vote) |
| admin     | Above plus `scope: 'admin'` (and `super_admin` if granted) |

A super-admin can _grant_ admin-scope tokens (the auth UI checks the
caller's `app_role`); writes still hit RLS the same way as the SPA.

PATs are minted from `/profile` → CLI Personal Access Tokens, or via the
OAuth handoff at `/cli/oauth-authorize` (used by `kizuna login` and the
MCP installer). Token bytes are revealed once; only a hash lives in
`api_keys`.

## Commands today

30 commands across 9 verbs. Every handler is RLS-gated; admin scope just
unlocks the registration path.

### `help` · `schema` (both `public`)

- `help` — list everything reachable for the caller's scope.
- `help <command>` — show the long form of one command.
- `schema` — dump the registry as JSON (machine-readable). MCP calls
  `schema` at startup to derive its tool list.

### `me` family (`user`)

- `me` — profile snapshot for the authenticated user.
- `me itinerary` — your itinerary, optionally filtered by `--day` or `--date`.
- `me sessions` — sessions you're registered for or have favorited.
- `me documents` — documents that apply to you, with sign state.
- `me roommates` — your room block + roommate list.
- `me transport` — your arrival / departure transfer requests.
- `me notifications` — your newest notifications.

### `attendees` (`user`)

- `attendees` — find attendee profiles by handle, hobby, or team.

### `events` family

- `events` (`user`) — list events visible to the caller. `--past` /
  `--future` filter on `end_date`.
- `event` (`user`) — show the active event (default), or `event :<id>` /
  `event active`.
- `events allowed-domains list` (`admin`) — show the active event's
  open-to-all email domains.
- `events allowed-domains add --domain <host>` (`admin`) — append a
  domain. `*.host.tld` form supported for subdomain wildcards.
- `events allowed-domains remove --domain <host>` (`admin`) — remove a
  domain. Existing registrations under that domain are preserved.

### `invitations` family (`admin`)

- `invitations list` — list every invitation on the active event.
- `invitations add --email --first-name --last-name` — single-row
  insert. Email is lowercased; `(event_id, email)` is the PK so a repeat
  raises a conflict the SPA dialog dedupes for the bulk paths.
- `invitations remove --email <addr>` (alias: `invitations remove
  <addr>`) — delete the invitation. The invited person's existing
  registration (if any) is preserved.

### `agenda` (`user`)

- `agenda` — the full event agenda.

### `sessions` family

- `sessions` (`user`) — list sessions on the active event with day /
  track / capacity filters.
- `sessions propose --title --abstract` (`user`) — submit a session for
  community voting.
- `sessions propose list` (`user`) — list every proposal with vote
  counts and your vote state.
- `sessions propose vote :<id>` (`user`) — one-time thumbs-up.
- `sessions propose delete :<id>` (`user`) — remove a proposal you own.

### `tags` family

- `tags list` (`user`) — session tags with color and position.
- `tags create --name --color` (`admin`) — add a tag.
- `tags update :<id> [--name] [--color] [--position]` (`admin`).
- `tags delete :<id>` (`admin`).

### `photos` (`user`) · `channels` (`user`)

- `photos` — list visible photos on the active event.
- `channels` — list community channels.

## UI/CLI parity gaps

The CLI shipped breadth-first across the most-used surfaces (me, agenda,
admin tags + invitations + allowed-domains). Several admin and
attendee surfaces still have no CLI equivalent. These are the open
parity gaps, ordered roughly by user-facing value:

### Attendee writes

| UI surface                           | Status         | Notes |
| ------------------------------------ | -------------- | ----- |
| Profile edit (community section)     | Read only      | `me` returns the profile. No `me set --bio --hometown ...` yet. |
| Document sign (consent gate)         | Missing        | `me documents` lists; no `me documents sign :<id>` to acknowledge. Risk-tier so it needs a deliberate yes-path for agents. |
| Channel messaging                    | Missing        | `channels` lists; no `channels post :<slug> --body` to send. |
| Photo upload                         | Missing        | Inherently file-bound; would need a CLI subcommand that reads a path. |
| Itinerary paste / Perk import        | Missing        | `me itinerary` reads only. The dialog hits an edge function that the CLI could wrap. |
| Registration sections (passport, dietary, accessibility, swag, attending) | Missing | Each section is a couple of fields and the writes already go through SECURITY DEFINER RPCs — wrapping each as `me <section> set` would close the gap quickly. |
| Session RSVP / favorite toggle       | Missing        | `me sessions` reads only; no toggle command. |

### Admin writes

| UI surface                  | Status      | Notes |
| --------------------------- | ----------- | ----- |
| Event create + edit         | Partial     | `events` lists and `events allowed-domains *` exists; no `events create` / `events update`. The `EventEditScreen` form is large but a flag-driven CLI would be straightforward. |
| Feed admin (editorial)      | Missing     | `feed list / create / update / delete / reorder`. |
| Documents admin             | Missing     | `documents admin list / create / update / delete`. |
| Swag admin (catalogue + lock) | Missing  | `swag list / create / update / lock`. |
| Reports CSV exports         | Missing     | `reports rooming / dietary / swag-order / payments / transport / registration` — each already has a server-side function that pieces together the rows; the CLI version would dump CSV. |
| Stats                       | Missing     | `stats` for the dashboard numbers. |
| Nudges (notifications)      | Missing     | `nudges send --user --kind --task` would let scripts run targeted reminders. |
| Conflicts (data_conflicts)  | Missing     | `conflicts list / accept / reject`. |
| Ground transport tool       | Missing     | `transport assign --request --vehicle`. Heavy — the UI does multi-step assignment; a CLI version would be a slimmer "assign one request" verb. |
| Room assignment             | Missing     | Same shape — `rooms assign --user --accommodation`. |
| Scan QR check-in            | Missing     | The QR code already round-trips a signed URL; a `checkin :<token>` verb could re-validate and stamp `attended`. |

### CLI infrastructure (out of scope of feature parity)

- `cli_audit_log` is written to but not surfaced. M5 adds `audit list`
  + a tail-like CLI mode for admins debugging an agent run.
- No streaming output today. Long-running commands (e.g. a future
  `reports` wrapper) return one JSON blob. NDJSON streaming is open.

## Conventions for new commands

When you add a command, do these things in order:

1. **Schema first.** Define the zod `Input` and `Output` in the same
   file as the handler. Strict mode (`.strict()`) on the input so a stray
   flag fails fast.
2. **Localized strings.** Both `summaryKey` and `descriptionKey` resolve
   through i18n (`cli.commands.<name>.{summary,description}`). Add the
   en-US copy and run `npm run i18n:check` — CI will fail otherwise.
3. **Pick a scope.** `user` for any path RLS already gates; `admin` for
   writes the SPA hides behind admin nav; `super_admin` for one-way
   actions like cascading delete.
4. **Examples.** At least two — the most common shape and the
   power-user shape with flags. The MCP server renders these into the
   tool description so agents see them.
5. **`toMarkdown` adapter.** Optional, but every user-facing list
   command should provide one. JSON is the default; Markdown is a
   one-off `--format md` request. Empty states render an italic line
   ("_No invitations yet._").
6. **Handler stays thin.** Talk to `ctx.supabase` (already authenticated).
   Throw the error PostgREST returns; the dispatcher serializes it.
7. **Add a sibling test.** Mock the supabase client and assert the call
   shape. Round-trip tests (parse → dispatch → format) live in
   `dispatcher.test.ts` for the framework; per-command tests cover
   the per-command logic.

## Out of date / replaced

The earlier draft of this spec proposed `events list` to use a
`--scope` flag for past/active/future. It shipped as boolean `--past`
and `--future` because callers wanted both granular shapes (past or
future) without juggling enum values. The spec also planned a
`commands` verb to introspect the registry; that role is filled by
`schema` (machine-readable) and `help` (human-readable). No verb
called `commands` is registered.
