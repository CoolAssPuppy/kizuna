// Dispatcher tests run against a synthetic registry so they exercise
// the dispatch pipeline (parse, scope check, zod validation, handler,
// output shape, format) without touching Supabase or the real
// commands. The real commands have their own tests under commands/.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { CommandContext, CliPatScope, CliTranslate } from './context';
import { dispatch, resolveCommand } from './dispatcher';
import { __resetRegistryForTests, registerCommand } from './registry';

const t: CliTranslate = (key) => key;

function ctx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    supabase: {} as CommandContext['supabase'],
    user: { id: 'u1', email: 'a@example.com', role: 'employee' },
    role: 'attendee',
    patScope: null,
    t,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function registerFakes() {
  registerCommand({
    path: ['ping'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: ['ping'],
    scope: 'user',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ pong: z.boolean() }),
    handler: () => Promise.resolve({ pong: true }),
    toMarkdown: () => '**pong**',
  });

  registerCommand({
    path: ['validated'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    input: z
      .object({
        format: z.enum(['json', 'md']).optional(),
        args: z.array(z.string()).optional(),
        limit: z.number().int().positive(),
      })
      .strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: () => Promise.resolve({ ok: true as const }),
  });

  registerCommand({
    path: ['admin', 'op'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'admin',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: () => Promise.resolve({ ok: true as const }),
  });

  registerCommand({
    path: ['mutate'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    mutation: true,
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: () => Promise.resolve({ ok: true as const }),
  });

  registerCommand({
    path: ['boom'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: () => Promise.reject(new Error('handler exploded')),
  });

  registerCommand({
    path: ['bad-output'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: () => Promise.resolve({ ok: false } as never),
  });

  registerCommand({
    path: ['me'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ surface: z.literal('me') }),
    handler: () => Promise.resolve({ surface: 'me' as const }),
  });

  registerCommand({
    path: ['me', 'itinerary'],
    summaryKey: 'k.summary',
    descriptionKey: 'k.description',
    examples: [],
    scope: 'user',
    input: z
      .object({ format: z.enum(['json', 'md']).optional(), args: z.array(z.string()).optional() })
      .strict(),
    output: z.object({ surface: z.literal('me-itinerary') }),
    handler: () => Promise.resolve({ surface: 'me-itinerary' as const }),
  });
}

beforeEach(() => {
  __resetRegistryForTests();
  registerFakes();
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetRegistryForTests();
});

describe('resolveCommand', () => {
  it('resolves a single-word command', () => {
    const resolved = resolveCommand('ping');
    expect(resolved?.path).toEqual(['ping']);
  });

  it('prefers the longest matching path', () => {
    expect(resolveCommand('me itinerary')?.path).toEqual(['me', 'itinerary']);
    expect(resolveCommand('me')?.path).toEqual(['me']);
  });

  it('returns null for an unknown command', () => {
    expect(resolveCommand('nope')).toBeNull();
  });

  it('throws CommandParseError on empty input', () => {
    expect(() => resolveCommand('')).toThrow();
  });

  it('captures positional args after the verb path', () => {
    const resolved = resolveCommand('ping foo bar');
    expect(resolved?.args).toEqual(['foo', 'bar']);
  });

  it('captures refs and flags', () => {
    const resolved = resolveCommand('ping @alice :session-1 --format=md');
    expect(resolved?.refs).toEqual({ user: 'alice', id: 'session-1' });
    expect(resolved?.flags).toEqual({ format: 'md' });
  });
});

describe('dispatch', () => {
  it('returns parse_error on empty input', async () => {
    const result = await dispatch({ raw: '   ' }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('parse_error');
  });

  it('returns not_found for unknown commands', async () => {
    const result = await dispatch({ raw: 'nope' }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });

  it('happy-path returns ok with json format by default', async () => {
    const result = await dispatch({ raw: 'ping' }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe('json');
      expect(result.data).toEqual({ pong: true });
    }
  });

  it('honours --format=md and uses toMarkdown when provided', async () => {
    const result = await dispatch({ raw: 'ping --format=md' }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe('md');
      expect(result.markdown).toBe('**pong**');
    }
  });

  it('falls back to fenced JSON when toMarkdown is missing', async () => {
    const result = await dispatch({ raw: 'me --format=md' }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe('md');
      expect(result.markdown).toContain('```json');
      expect(result.markdown).toContain('"surface": "me"');
    }
  });

  it('lets transport-level format override --format', async () => {
    const result = await dispatch({ raw: 'ping --format=md', format: 'json' }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.format).toBe('json');
  });

  it('returns validation_error on schema failure', async () => {
    const result = await dispatch({ raw: 'validated' }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_error');
  });

  it('returns forbidden when the user role is below the command scope', async () => {
    const result = await dispatch({ raw: 'admin op' }, ctx({ role: 'attendee' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('forbidden');
  });

  it('allows an admin to run admin scope', async () => {
    const result = await dispatch({ raw: 'admin op' }, ctx({ role: 'admin' }));
    expect(result.ok).toBe(true);
  });

  it('blocks a read PAT from running mutations', async () => {
    const result = await dispatch({ raw: 'mutate' }, ctx({ patScope: 'read' as CliPatScope }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('forbidden');
  });

  it('allows a write PAT to run mutations', async () => {
    const result = await dispatch({ raw: 'mutate' }, ctx({ patScope: 'write' as CliPatScope }));
    expect(result.ok).toBe(true);
  });

  it('blocks a write PAT from running admin commands', async () => {
    const result = await dispatch(
      { raw: 'admin op' },
      ctx({ role: 'admin', patScope: 'write' as CliPatScope }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('forbidden');
  });

  it('returns internal when the handler throws', async () => {
    const result = await dispatch({ raw: 'boom' }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('internal');
      expect(result.error.message).toBe('handler exploded');
    }
  });

  it('returns internal when the output shape is wrong', async () => {
    const result = await dispatch({ raw: 'bad-output' }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('internal');
  });
});
