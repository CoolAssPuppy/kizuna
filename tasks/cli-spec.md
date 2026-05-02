# Kizuna CLI and command palette spec

> Status: draft, ready for first implementation pass.
> Author: Prashant + Claude.
> Last updated: 2026-05-02.
> Implementation order is M1 → M5. Each milestone ships behind no flag — these features are public.

## Why this exists

Two things share the bottom of the Kizuna chrome and the top-left of the keyboard, but they are unrelated products:

- **Cmd-K palette.** Cute gimmick. Jumps to pages. Never grows.
- **CLI.** The actual product. An agent surface for an offsite app, designed so a Claude or Cursor session can answer "what is on my itinerary tomorrow," "who else likes snowboarding," "send a nudge to Alice about her passport," without a human in the loop.

The bet behind the CLI is that every SaaS product is about to need one of these. Kizuna ships it natively on Supabase, which means RLS is the agent permission model. The agent never sees what its human user could not see.

This makes Kizuna a lead magnet. A company running an offsite clones the repo, points it at their Supabase project, and their attendees can ask their AI assistants about the itinerary out of the box. The codebase sells the thesis.

## Audiences and surfaces

One registry. Three skins.

| Audience             | Surface                       | Auth                        | Format                                     |
| -------------------- | ----------------------------- | --------------------------- | ------------------------------------------ |
| Attendee at a laptop | Footer CLI in the running app | Session JWT (cookie)        | JSON or Markdown, in a panel above the bar |
| Scripter or CI run   | `npx kizuna ...`              | PAT in env                  | JSON to stdout, MD with `--format=md`      |
| Agent                | MCP server (`@kizuna/mcp`)    | PAT, bootstrapped via OAuth | JSON over MCP transport                    |

All three call the same dispatcher. Anything you can do in the footer, you can do from the npx CLI or an agent, modulo scope.

## Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │   src/lib/cli/registry.ts                    │
                    │   - Command<TInput, TOutput> definitions     │
                    │   - zod input + output schemas               │
                    │   - scope (public | user | admin | super)    │
                    │   - examples + summary + description         │
                    └──────────────────────────────────────────────┘
                                       │
                    ┌──────────────────────────────────────────────┐
                    │   src/lib/cli/dispatcher.ts                  │
                    │   parse → validate → authorize → handle      │
                    │   → format(json | md)                        │
                    └──────────────────────────────────────────────┘
                          │              │              │
                          │              │              │
            ┌─────────────┘              │              └─────────────┐
            ▼                            ▼                            ▼
   Footer CLI (M2)         supabase/functions/cli/ (M3)     packages/kizuna-mcp/ (M4)
   src/components/         POST /functions/v1/cli           standalone npm package
   FooterTerminal.tsx      PAT or session JWT auth          MCP tools auto-derived
                                                            from registry zod schemas
                                       │
                          packages/kizuna-cli/ (M3)
                          npx kizuna ...
                          thin HTTP wrapper
```

The registry is the single source of truth. Adding a command means: write the zod schema, write the handler, ship. The footer, edge function, and MCP server pick it up automatically.

## File layout

```
src/lib/cli/
  registry.ts                  # Command<TInput,TOutput> registry, scope types
  context.ts                   # CommandContext type (supabase, user, t, abort)
  dispatcher.ts                # parse + validate + authorize + handle + format
  parser.ts                    # tokenizer for verb-noun + flags + refs
  formatters/
    json.ts
    markdown.ts
  commands/
    help.ts
    schema.ts
    me.ts
    me-itinerary.ts
    me-sessions.ts
    me-documents.ts
    me-roommates.ts
    me-transport.ts
    me-notifications.ts
    attendees.ts
    sessions.ts
    events.ts
    event.ts
    agenda.ts
    photos.ts
    channels.ts
  index.ts                     # re-export public API for footer + edge fn

src/components/
  CommandPalette.tsx           # cmd-K palette (M1)
  FooterTerminal.tsx           # replaces CommandPaletteBar (M2)
  FooterTerminal.test.tsx
  CommandOutput.tsx            # collapsible output panel
  CommandOutput.test.tsx

src/features/profile/api-keys/
  ApiKeysSection.tsx           # rendered inside ProfileScreen (M3)
  CreateApiKeyDialog.tsx
  RevealOnceDialog.tsx
  api.ts                       # list / create / revoke RPC wrappers
  hooks.ts                     # TanStack Query hooks
  types.ts

src/features/auth/cli-oauth/
  AuthorizeScreen.tsx          # /cli/oauth-authorize page (M3)
  CallbackScreen.tsx           # /cli/oauth-callback page (M3)
  api.ts

supabase/functions/cli/
  index.ts                     # POST handler (M3)
  authenticate.ts              # PAT or JWT
  parseRequest.ts
  index.test.ts

supabase/schemas/
  76_api_keys.sql              # api_keys table + RLS (M3)
  77_cli_audit_log.sql         # cli_audit_log table + RLS (M5)

supabase/tests/
  api_keys__rls.sql
  api_keys__create_revoke.sql
  cli_audit__write.sql

packages/kizuna-cli/           # M3
  package.json
  bin/kizuna.ts
  src/
    config.ts
    httpClient.ts
    formatOutput.ts
  README.md

packages/kizuna-mcp/           # M4
  package.json
  bin/kizuna-mcp.ts
  src/
    server.ts
    toolFromCommand.ts
    oauth.ts
  README.md
```

## Core types

```ts
// src/lib/cli/context.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TFunction } from 'i18next';
import type { Database } from '@/types/database.types';
import type { User } from '@/features/auth/AuthContext';

export interface CommandContext {
  supabase: SupabaseClient<Database>;
  user: User; // already authenticated; never null inside handlers
  role: 'attendee' | 'admin' | 'super_admin';
  t: TFunction;
  signal: AbortSignal;
}
```

```ts
// src/lib/cli/registry.ts
import { z, type ZodType } from 'zod';
import type { CommandContext } from './context';

export type CommandScope = 'public' | 'user' | 'admin' | 'super_admin';

export interface Command<TInput, TOutput> {
  /** Verb path, e.g. ['me', 'itinerary']. */
  readonly path: ReadonlyArray<string>;
  readonly summary: string;
  readonly description: string;
  readonly examples: ReadonlyArray<string>;
  readonly scope: CommandScope;
  readonly input: ZodType<TInput>;
  readonly output: ZodType<TOutput>;
  readonly handler: (input: TInput, ctx: CommandContext) => Promise<TOutput>;
}

const REGISTRY = new Map<string, Command<unknown, unknown>>();

export function registerCommand<TInput, TOutput>(cmd: Command<TInput, TOutput>): void {
  const key = cmd.path.join(' ');
  if (REGISTRY.has(key)) {
    throw new Error(`Command already registered: ${key}`);
  }
  REGISTRY.set(key, cmd as Command<unknown, unknown>);
}

export function getCommand(path: ReadonlyArray<string>): Command<unknown, unknown> | undefined {
  return REGISTRY.get(path.join(' '));
}

export function listCommands(scope: CommandScope): ReadonlyArray<Command<unknown, unknown>> {
  return Array.from(REGISTRY.values()).filter((c) => isReachable(c.scope, scope));
}

function isReachable(required: CommandScope, current: CommandScope): boolean {
  const order = ['public', 'user', 'admin', 'super_admin'] as const;
  return order.indexOf(current) >= order.indexOf(required);
}
```

```ts
// src/lib/cli/dispatcher.ts
export type CommandResult =
  | { ok: true; data: unknown; format: 'json' | 'md' }
  | {
      ok: false;
      error: {
        code:
          | 'unauthorized'
          | 'forbidden'
          | 'not_found'
          | 'validation_error'
          | 'parse_error'
          | 'rate_limit'
          | 'internal';
        message: string;
        details?: unknown;
      };
    };

export interface DispatchInput {
  raw: string;
  format?: 'json' | 'md';
}

export async function dispatch(input: DispatchInput, ctx: CommandContext): Promise<CommandResult> {
  /* ... */
}
```

The handler returns the typed `TOutput`. The dispatcher serializes via the chosen formatter. JSON is the default. Markdown is rendered by a per-command `markdown` adapter — see "Output formats" below.

## Command grammar

```
COMMAND  := VERB (NOUN | REF)? FLAGS*
VERB     := identifier            // e.g. "me", "attendees", "admin"
NOUN     := identifier            // e.g. "itinerary", "sessions"
REF      := "@" handle            // person ref, e.g. @alice
          | ":" id                // resource id, e.g. :01h... or :42
FLAGS    := "--" key ("=" value | " " value)?
```

Flags can appear in any order. `--format=md` and `--format md` are both legal. Boolean flags are `--mandatory` (true) or `--no-mandatory`.

`me` and `attendees` are special: a bare verb resolves to the verb's default noun (`me` → `me`, `attendees` → `attendees list`). The parser keeps a `defaultNoun` map.

## Output formats

Every command supports two output formats. JSON is the structured truth; Markdown is the human-readable version of the same data.

- **JSON.** The `output` zod schema validates the handler's return value. Output is the raw object.
- **Markdown.** Each command file optionally exports `toMarkdown(output: TOutput): string`. If absent, the dispatcher falls back to a generic JSON-as-fenced-block renderer.

The footer terminal renders Markdown via the existing react-markdown chain. The npx CLI prints raw text. The MCP server returns Markdown as the `text` content type and JSON as a structured `tool_result`.

```ts
// example: src/lib/cli/commands/me-itinerary.ts
export const meItineraryMarkdown = (out: MeItineraryOutput): string => {
  if (out.items.length === 0) return '_No itinerary items yet._';
  return out.items
    .map((it) => `- **${formatTime(it.startsAt)}** ${it.title} _(${it.location ?? 'TBD'})_`)
    .join('\n');
};
```

## Initial command catalog

These ship in M2 (read-only). Mutations and admin commands ship in M5.

| Command                                                            | Scope  | Summary                                         |
| ------------------------------------------------------------------ | ------ | ----------------------------------------------- |
| `help`                                                             | public | Print usage.                                    |
| `help <command...>`                                                | public | Print usage for a specific command.             |
| `schema`                                                           | public | Emit the full registry as JSON Schema.          |
| `schema --mcp`                                                     | public | Emit the registry as MCP tool definitions.      |
| `me`                                                               | user   | Profile snapshot for the authenticated user.    |
| `me itinerary [--day N \| --date YYYY-MM-DD]`                      | user   | Itinerary items, optionally filtered.           |
| `me sessions [--favorited] [--mandatory] [--day N]`                | user   | Sessions the user is registered for.            |
| `me documents [--unsigned]`                                        | user   | Documents the user can sign.                    |
| `me roommates`                                                     | user   | Current room block + roommate list.             |
| `me transport`                                                     | user   | Transport request status (arrival + departure). |
| `me notifications [--unread] [--limit N]`                          | user   | Notifications, newest first.                    |
| `attendees [--hobby X] [--dietary X] [--team X] [--arriving DATE]` | user   | List attendees matching filters.                |
| `attendees @user`                                                  | user   | Single attendee profile.                        |
| `sessions [--track X] [--day N] [--mandatory] [--has-capacity]`    | user   | All sessions for the active event.              |
| `sessions :id`                                                     | user   | One session with attendees + capacity.          |
| `events [--past] [--future]`                                       | user   | Events the user has access to.                  |
| `event [:id \| active]`                                            | user   | Event details. Defaults to active event.        |
| `agenda [--day N]`                                                 | user   | Full event agenda.                              |
| `photos [--mine] [--tagged-me] [--hashtag X]`                      | user   | Photos visible to the user.                     |
| `channels`                                                         | user   | Community channels and unread counts.           |

### Example zod sketches

```ts
// me-itinerary.ts
const Input = z.object({
  day: z.number().int().min(1).max(14).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  format: z.enum(['json', 'md']).optional(),
});
const ItineraryItem = z.object({
  id: z.string().uuid(),
  itemType: z.enum(['session', 'flight', 'transport', 'accommodation', 'custom']),
  title: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  location: z.string().nullable(),
  source: z.object({ table: z.string(), id: z.string().uuid() }),
});
const Output = z.object({
  eventId: z.string().uuid(),
  items: z.array(ItineraryItem),
  generatedAt: z.string().datetime(),
});
```

```ts
// attendees.ts
const Input = z.object({
  hobby: z.string().optional(),
  dietary: z.string().optional(),
  team: z.string().optional(),
  arriving: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  user: z.string().optional(), // @handle resolves here
  limit: z.number().int().positive().max(500).default(50),
  format: z.enum(['json', 'md']).optional(),
});
const Output = z.object({
  matches: z.array(
    z.object({
      userId: z.string().uuid(),
      handle: z.string(),
      fullName: z.string(),
      team: z.string().nullable(),
      hobbies: z.array(z.string()),
      arrivingAt: z.string().datetime().nullable(),
    }),
  ),
  total: z.number().int().min(0),
});
```

## Authentication

Three audiences, three trust models. All converge on a Supabase client constructed with the right token and let RLS handle the rest.

### Footer CLI (in-app)

Already authenticated. Use the existing `getSupabaseClient()` helper. The `CommandContext.supabase` is the same client the rest of the app uses. The user's session JWT carries their `app_role` claim.

### npx CLI

Uses a personal access token (PAT). Stored in `~/.kizuna/config.json`. PAT is sent as `Authorization: Bearer <token>` to the edge function.

### MCP server

Uses a PAT, bootstrapped through OAuth. See "OAuth bootstrap" below.

### PAT structure

PATs look like `kzn_<scope>_<random>`, e.g. `kzn_user_3f7a9b...`. The string is shown to the user **once**, at creation time. Only the `pgcrypto` hash is stored.

```sql
-- supabase/schemas/76_api_keys.sql
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  scope api_key_scope not null,
  token_hash text not null,                  -- pgp_sym_encrypt of full PAT
  token_last4 text not null,                 -- shown in dashboard
  expires_at timestamptz,                    -- null = never
  last_used_at timestamptz,
  last_used_ip inet,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create type api_key_scope as enum ('read', 'write', 'admin');

create unique index api_keys_token_hash_unique
  on public.api_keys(token_hash);

create index api_keys_user_active
  on public.api_keys(user_id)
  where revoked_at is null;
```

RLS:

- `api_keys_self_read` — `user_id = auth.uid()`
- `api_keys_self_insert` — `user_id = auth.uid()`
- `api_keys_self_update_revoke` — `user_id = auth.uid()` and the only updatable column is `revoked_at`
- No SELECT for admins (the same passport-style "we cannot read your keys" promise)
- `token_hash` is encrypted with the per-app key from a Supabase Vault secret

Postgres functions:

- `create_api_key(p_name text, p_scope api_key_scope, p_expires_at timestamptz default null) returns table(id uuid, token text)` — returns the cleartext PAT _once_, never again
- `revoke_api_key(p_id uuid) returns void`
- `verify_api_key(p_token text) returns table(user_id uuid, scope api_key_scope)` — used by the edge function

The dashboard never sees the token after creation.

### OAuth bootstrap (for the MCP server)

The MCP server needs to acquire a PAT on behalf of the user. The standard pattern is the OAuth code flow with a localhost redirect, but a localhost redirect page lives outside our chrome and feels like a different product. The user has explicitly asked that the callback page match the rest of the site.

Solution: the redirect URI is `https://<kizuna-host>/cli/oauth-callback`, which is a real Kizuna page. That page extracts the code from the URL, posts it to `http://localhost:<port>/callback` (the local server the MCP started), and renders a success state in the Kizuna chrome. The user closes the tab and returns to their agent.

Flow:

1. User runs `npx @kizuna/mcp init` (or the agent prompts on first connect).
2. The local process binds a random port and opens `https://<kizuna-host>/cli/oauth-authorize?scope=read+write&state=<csrf>&redirect=http://localhost:<port>/callback`.
3. `/cli/oauth-authorize` (a `RequireAuth`-gated React page) shows: "Allow Claude Desktop to access your Kizuna data with read+write permissions?" — buttons "Authorize" and "Cancel".
4. On Authorize, the page calls a Postgres function `mint_oauth_code(p_scope, p_state, p_redirect)` that returns a short-lived (60s) one-time code. The page redirects to `https://<kizuna-host>/cli/oauth-callback?code=<code>&state=<csrf>&redirect=http://localhost:<port>/callback`.
5. `/cli/oauth-callback` is server-rendered (or runs after auth) inside the Kizuna chrome. It POSTs `{code, state}` to the local port, which exchanges the code for a PAT via `exchange_oauth_code(p_code, p_state)`, stores it in `~/.kizuna/config.json`, and 204s.
6. The callback page reads the 204 response, swaps to a "you are connected, you can close this tab" state, still inside Kizuna chrome.
7. If the local POST fails (port closed, user pasted into wrong device), the page surfaces a manual fallback: "Copy this code and paste it into your terminal." That preserves the look-and-feel even when the loopback piece breaks.

The Kizuna-chromed callback is critical to the lead-magnet story. A clone running at `https://offsite.examplecorp.com` will match its own brand automatically because the callback is part of the cloned site, not a static asset bundled with the npm package.

OAuth code table:

```sql
create table public.oauth_codes (
  code text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  scope api_key_scope not null,
  state text not null,
  redirect text not null,
  expires_at timestamptz not null default now() + interval '60 seconds',
  consumed_at timestamptz
);
```

`exchange_oauth_code` mints a PAT row in `api_keys` and marks the code consumed. RLS denies all client access; only the edge function can read it via the service role within a SECURITY DEFINER function.

## /profile/api-keys page

Slot it at the bottom of the profile section nav, after `transport`, with `subject: 'self'`.

```ts
// src/features/profile/ProfileScreen.tsx — append to SECTIONS
{
  id: 'api-keys',
  icon: KeyRound,
  labelKey: 'profile.nav.apiKeys',
  render: () => <ApiKeysSection />,
  subject: 'self',
},
```

Translations live under `profile.nav.apiKeys` and `profile.apiKeys.*`. The label is "API Keys" (Capital case, per the project header convention).

### Layout

- A `CardShell` titled "API Keys" with a button "Create API Key" in the top-right of the card header.
- Below: a list of keys. Each row shows: name, scope badge, "..." last4, created date, last used (or "never used"), revoke button.
- Empty state: copy explaining what API keys are, what they're for, and a single CTA "Create your first API key."
- Revoked keys move into a collapsed "Revoked" section at the bottom, sorted newest-first, capped at 20.

### Create dialog

Fields:

- Name (required, 1-80 chars). Help text: "What is this key for? You can rename it later."
- Scope (radio): Read-only · Read + write · Admin (admin option only renders if `useIsAdmin()` is true)
- Expiry (radio): 30 days · 90 days · 1 year · Never. Default: 90 days.

Submit calls `create_api_key`, receives the cleartext token, opens `RevealOnceDialog` showing the token in a monospace block with a copy button and a warning "this is the only time this token will be shown." Closing the dialog returns to the list.

### Revoke

Confirm-dialog: "Revoke <name>? Apps using this key will lose access immediately." Calls `revoke_api_key`. Optimistic update.

### Realtime

Subscribe to `api_keys` filtered by `user_id` so creating, revoking, and last-used updates flow into the list without a refetch.

## HTTP edge function

`supabase/functions/cli/index.ts`. POST only.

### Request

```json
{
  "command": "me itinerary --day 2 --format md",
  "format": "json"
}
```

`format` is the _transport_ format and overrides the `--format` flag if both are present. Valid values: `json` | `md`.

### Auth

`Authorization: Bearer <token>`. Two token types accepted:

- A Kizuna PAT (`kzn_*`). Validated via `verify_api_key`. The function then constructs a Supabase client with the user's JWT (minted in-function via a SECURITY DEFINER helper that returns a scoped JWT bound to `user_id` and the PAT's scope as a custom claim).
- A standard Supabase session JWT. Validated via `auth.getUser()`. The footer never hits this endpoint, but reusing the same auth path makes server-side rendering and admin tooling possible.

If neither validates, return 401.

### Authorize

After auth, look up the command, check `cmd.scope` against the caller's scope. If the PAT scope is `read` and the command scope is `user` (which means writeable mutation), return 403.

Scope matrix:

| Command scope  | PAT `read` | PAT `write` | PAT `admin`      | Session JWT (attendee) | Session JWT (admin) |
| -------------- | ---------- | ----------- | ---------------- | ---------------------- | ------------------- |
| `public`       | yes        | yes         | yes              | yes                    | yes                 |
| `user` (read)  | yes        | yes         | yes              | yes                    | yes                 |
| `user` (write) | no         | yes         | yes              | yes                    | yes                 |
| `admin`        | no         | no          | yes              | no                     | yes                 |
| `super_admin`  | no         | no          | yes (super only) | no                     | super only          |

The registry distinguishes read vs. write at the `Command` level via a `mutation: boolean` field added in M5.

### Response

```json
{
  "ok": true,
  "format": "json",
  "data": { ... },
  "request_id": "01h..."
}
```

Or:

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Unknown flag --foobar",
    "details": { "flag": "--foobar" }
  },
  "request_id": "01h..."
}
```

`request_id` is a ULID. Logged to the function logs and (after M5) to `cli_audit_log` for mutations.

### Rate limits

Use Supabase's built-in rate limit headers via the standard pattern. 60 req/min per PAT for read commands, 10 req/min for mutations. Exceeding returns 429 with `error.code = "rate_limit"` and `Retry-After` header.

## Footer terminal

Replaces `src/components/CommandPaletteBar.tsx` with `FooterTerminal.tsx`. The bar stays at the bottom of every authenticated route, mounted in `AppLayout.tsx`.

### Visual

The current cosmetic layout — `$` prompt, blinking caret, monospace muted placeholder — stays. The placeholder text changes from "type / for command palette" to "type a command, or `/` for the palette · `?` for help".

When the user clicks the bar (or presses `/`), it expands upward into a 320-px-max output panel with command history and current results.

### Keyboard

- `/` from anywhere (when no input is focused) → focus the bar.
- `Cmd-K` → open the **palette** (M1), not the terminal.
- `Esc` while the bar is focused → blur and collapse.
- `↑` / `↓` while focused → cycle through history (per-tab `sessionStorage`, last 50).
- `Ctrl-L` → clear output panel.
- `Tab` while typing → autocomplete next token (commands + flags + known refs).
- `Enter` → dispatch.

### Output panel

Above the bar. Each result is a card with:

- Header: command echoed back, run time (e.g. "162ms"), format toggle (`{ }` JSON · `MD` Markdown).
- Body: rendered output. JSON via `<JsonView />` (collapsible tree). MD via the existing react-markdown chain.
- Footer: copy button (copies in the active format), "open as JSON" / "open as MD" view, error-report link if `ok: false`.

The panel keeps the last 5 results in DOM, older ones drop off.

### Streaming

Phase 1 commands are not streamed — they're all single-query reads. M5 mutations may stream. The dispatcher exposes `AbortSignal` from day one so this is not a refactor later.

## Cmd-K palette (M1)

Strictly a navigation gimmick. No coupling to the registry.

```ts
// src/components/CommandPalette.tsx
const ROUTES = [
  { path: '/', label: t('nav.home'), keywords: ['home', 'dashboard'] },
  { path: '/itinerary', label: t('nav.itinerary'), keywords: ['schedule'] },
  // ...
  {
    path: '/admin/conflicts',
    label: t('nav.adminConflicts'),
    keywords: ['conflicts'],
    scope: 'admin',
  },
];
```

The route manifest is generated at build time by a small script `scripts/build-route-manifest.ts` that walks `src/app/router.tsx` and `src/features/admin/AdminRoute.tsx`, so adding a new screen adds a palette entry automatically. Admin routes only render for users with the admin role.

Library: `cmdk`. The shadcn `<Command>` primitive is the wrapper.

## NPM package: @kizuna/cli (M3)

```
packages/kizuna-cli/
  package.json           # "bin": { "kizuna": "./dist/bin/kizuna.js" }
  src/
    bin/kizuna.ts        # entrypoint
    config.ts            # ~/.kizuna/config.json read/write
    httpClient.ts        # POST /functions/v1/cli, retries, rate-limit handling
    formatOutput.ts      # JSON to stdout, MD via marked-terminal
    auth.ts              # `kizuna login` opens browser to OAuth flow
```

```sh
npx kizuna login                              # bootstraps PAT via OAuth
npx kizuna me itinerary --day 2
npx kizuna attendees --hobby snowboarding --format md
npx kizuna --help
npx kizuna logout                             # revokes PAT, clears config
```

Config:

```json
{
  "url": "https://kizuna.supabase.com",
  "tokenName": "default",
  "tokens": {
    "default": {
      "value": "kzn_user_xxxxxxxx",
      "scope": "write",
      "expiresAt": null
    }
  }
}
```

`--profile <name>` switches profiles. Useful when an attendee is also an admin of a different event.

## MCP server: @kizuna/mcp (M4)

Standalone npm package, runs stdio MCP transport.

```sh
npx @kizuna/mcp                              # starts MCP server on stdio
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "kizuna": {
      "command": "npx",
      "args": ["@kizuna/mcp"],
      "env": {
        "KIZUNA_URL": "https://kizuna.supabase.com",
        "KIZUNA_TOKEN": "kzn_user_xxxxxxxx"
      }
    }
  }
}
```

If `KIZUNA_TOKEN` is missing, the server prints the OAuth URL to stderr on first request and waits for the user to complete the flow. The same Kizuna-chromed callback page is used.

### Tool generation

Each command in the registry becomes one MCP tool. Tool name: `kizuna_<verb>_<noun>` (e.g. `kizuna_me_itinerary`). The zod input schema is converted to MCP's JSON Schema input via `zod-to-json-schema`. Tool description = command summary. Annotations on the tool indicate scope.

A single resource `kizuna://schema` returns the full registry (same as the `schema` command). Agents can read it once and discover the surface.

### Streaming

MCP supports streaming notifications. Long commands (none in M2 read-only) can pipe progress events. M5 mutations should emit `progress` events for nudge-cohort or bulk-assignment commands.

## Mutations and admin commands (M5)

The unresolved decision from planning was: where do mutations live?

**Recommendation: handlers call existing Postgres functions or RPCs. Never duplicate business logic in the registry handler.**

Rationale:

- The Postgres function is already covered by pgTAP, already enforces RLS, already audited.
- Mutations from the React UI go through the same function, so the registry handler is just a "thin" wrapper. Adding a CLI command for an existing UI mutation is a 10-line file.
- New mutations not yet wired in the UI start as a Postgres function first, so the function is testable without touching React.

Decision tree for a new mutation:

```
Is there a Postgres function for it?
├─ Yes → registry handler calls it via .rpc(), maps the result, done.
└─ No → does it cross system boundaries (Slack, Resend, Stripe)?
        ├─ Yes → it lives in an Edge Function. Registry handler invokes the Edge Function.
        └─ No  → write a new Postgres function with pgTAP coverage. Then the registry calls it.
```

This keeps the registry stupid and the database smart. It also means an admin running `admin nudge @alice ...` from the CLI exercises the exact same code path as the admin running it from the UI.

### Initial mutation catalog

| Command                                        | Scope        | Backed by                                      |
| ---------------------------------------------- | ------------ | ---------------------------------------------- |
| `me favorite-session :id`                      | user (write) | upsert into `session_registrations`            |
| `me unfavorite-session :id`                    | user (write) | delete from `session_registrations`            |
| `me rsvp :id yes\|no`                          | user (write) | `session_registrations.attendance`             |
| `me sign-document :id`                         | user (write) | existing `sign_document(p_doc_id)` Postgres fn |
| `me set-hobby <name>`                          | user (write) | upsert into `attendee_profiles.hobbies`        |
| `me update-dietary <text>`                     | user (write) | upsert into `dietary_preferences`              |
| `admin nudge @user "..."`                      | admin        | existing `send_nudge` flow + Resend            |
| `admin nudge --cohort registration-incomplete` | admin        | bulk variant, streams progress                 |
| `admin assign-room @user <room>`               | admin        | new fn `assign_room(p_user, p_room)`           |
| `admin conflicts list`                         | admin        | reuse `data_conflicts` query                   |
| `admin conflicts approve :id`                  | admin        | new fn `resolve_conflict(p_id, 'approve')`     |
| `admin conflicts reject :id`                   | admin        | same, `'reject'`                               |
| `admin reports rooms\|transport\|registration` | admin        | reuses `report_snapshots`                      |

### Audit log

```sql
-- supabase/schemas/77_cli_audit_log.sql
create table public.cli_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  request_id text not null,
  command text not null,
  scope api_key_scope not null,
  outcome text not null check (outcome in ('ok', 'error')),
  error_code text,
  duration_ms int not null,
  ran_at timestamptz not null default now()
);
```

Every mutation writes a row. Reads do not, to keep the table a useful security signal. Admin-only SELECT.

## Testing strategy

Per the project's TDD rule, tests come first.

### Vitest

- `src/lib/cli/parser.test.ts` — every supported syntax: bare verb, verb-noun, `@user`, `:id`, mixed flags, `--key=value`, `--key value`, boolean flags, unknown flags
- `src/lib/cli/dispatcher.test.ts` — parse error, validation error, unauthorized, forbidden, not found, success
- One file per command in `src/lib/cli/commands/*.test.ts` covering the handler against a seeded local Supabase
- `src/components/FooterTerminal.test.tsx` — keybindings, history, output rendering, format toggle, copy

### pgTAP

- `api_keys__rls.sql` — self-read, self-insert, self-update revoke only, no admin SELECT
- `api_keys__lifecycle.sql` — create returns plaintext once, hash stored, verify works, revoke flips access
- `cli_audit__write.sql` — function-driven inserts, no client writes
- `oauth_codes__expiry.sql` — codes expire, consumed-once, mismatched state rejected

### Edge function tests

- `supabase/functions/cli/index.test.ts` — runs against local supabase via `supabase functions serve`
- Cases: no auth (401), bad PAT (401), expired PAT (401), good PAT but wrong scope (403), good PAT good scope unknown command (404), success path

### Playwright

- `tests/e2e/cmd-k.spec.ts` — open palette, type "itin", press Enter, lands on `/itinerary`
- `tests/e2e/footer-cli.spec.ts` — focus footer, type `me itinerary`, see output, toggle MD, copy
- `tests/e2e/api-keys.spec.ts` — create, copy, revoke; admin scope only renders for admins
- `tests/e2e/cli-oauth.spec.ts` — visit `/cli/oauth-authorize?...`, click Authorize, land on `/cli/oauth-callback`, success state renders in Kizuna chrome

## i18n

Every user-visible string in palette, terminal, output panels, dialogs, and OAuth pages goes through `t()`. The English locale is `src/locales/en-US/common.json`. Keys to add (non-exhaustive):

- `palette.placeholder`
- `palette.empty`
- `terminal.placeholder`
- `terminal.help`
- `terminal.copy`
- `terminal.copied`
- `terminal.format.json`
- `terminal.format.md`
- `terminal.error.unauthorized`
- `terminal.error.forbidden`
- `terminal.error.notFound`
- `terminal.error.validation`
- `profile.nav.apiKeys`
- `profile.apiKeys.title`
- `profile.apiKeys.empty`
- `profile.apiKeys.create`
- `profile.apiKeys.revoke`
- `profile.apiKeys.scope.read`
- `profile.apiKeys.scope.write`
- `profile.apiKeys.scope.admin`
- `profile.apiKeys.expiry.30d` ... `never`
- `profile.apiKeys.revealOnce.warning`
- `cliOauth.authorize.title`
- `cliOauth.authorize.scopes`
- `cliOauth.authorize.allow`
- `cliOauth.authorize.deny`
- `cliOauth.callback.success`
- `cliOauth.callback.fallback`
- `cliOauth.callback.errorPort`

Command summaries and descriptions are also localized so `help` works in the user's language. Verbs and flags stay English (CLI convention).

## Telemetry and observability

Reads are not logged (RLS already gates them and the volume would be noise). Mutations write `cli_audit_log` and surface in `/admin/integrations` after M5.

Edge function logs include `request_id`, `command`, `scope`, `duration_ms`, `outcome`. Errors with `code = "internal"` are forwarded to the existing error reporter.

A future dashboard at `/admin/cli-usage` (post-M5) shows per-PAT volume, per-command latency, error rates.

## Showcase deliverables

These are non-negotiable for the lead-magnet story.

- **M2:** A 60-second Loom of an attendee opening the footer, asking "what's on my itinerary tomorrow," getting JSON, toggling to MD, copying.
- **M3:** A 60-second Loom of `npx kizuna login` → first command. Registered as `https://kizuna.supabase.com/cli` landing page CTA.
- **M4:** A 90-second Loom of "Hey Claude, who at the offsite likes snowboarding and what's their flight?" running end-to-end through Claude Desktop. **This is the screenshot in the deck.**
- **M5:** A 90-second Loom of an admin saying "Hey Claude, send a passport reminder to anyone whose passport details are missing." Live, on real seed data.

Each Loom lives in the project Notion under `Kizuna / Demos`. The README links to all four.

## Risks and open questions

- **Token format vs. Supabase conventions.** Supabase's existing PAT format is `sbp_*`. Using `kzn_*` is more consistent with our own brand but reviewers from Supabase will ask why we didn't reuse `sbp_*` infra. Recommendation: keep `kzn_*`. They're our tokens, scoped to our app's row data, not Supabase platform tokens. Document the choice in an ADR.
- **MCP transport.** Stdio is the default for Claude Desktop and Cursor. SSE / HTTP MCP is becoming common. Ship stdio in M4; add SSE in a follow-up if there is demand.
- **Fork-and-clone story.** Anyone cloning Kizuna gets the OAuth flow for free, but they'll need to whitelist their domain in the redirect-URI list of the auth helper. Document in the README setup section.
- **Schema introspection security.** `schema` is `public` scope, which means even unauthenticated callers can list every command. That's intentional — knowing the surface is not knowing how to use it; auth and RLS still gate execution. But verify with a security review before M3 ships.
- **Rate-limit infrastructure.** Supabase rate limits are per-IP via the Edge Network. We need per-PAT limits, which is a small Postgres-side counter. Ship a stub in M3 (per-IP only), wire per-PAT in a M3.5 follow-up before the lead-magnet push.
- **Markdown formatter conventions.** Each command implements `toMarkdown` independently. Without a style guide they drift. Add `tasks/cli-md-style.md` after the first three commands ship and codify the patterns: lead with bold, dates as relative + absolute, lists as bulleted, tables for tabular data only.

## Glossary

| Term            | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| Registry        | The Map of `Command<TIn,TOut>` definitions.                                   |
| Dispatcher      | The function that turns a string into a `CommandResult`.                      |
| Surface         | One of footer / HTTP / MCP — a way the registry is exposed.                   |
| Scope           | A capability boundary on a command. `public`, `user`, `admin`, `super_admin`. |
| PAT             | Personal access token. Long-lived, scoped, revocable.                         |
| OAuth bootstrap | The browser dance an MCP server does to acquire a PAT.                        |
| Format          | JSON or MD, the wire format of a command's output.                            |
