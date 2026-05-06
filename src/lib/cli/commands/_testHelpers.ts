// Minimal mock for the Supabase client used by command handlers.
// Each command typically chains `.from(table).select(...).eq(...)
// .order(...).maybeSingle()/then` — we mimic just enough of that
// surface to feed canned rows back. The mock returns the same
// builder for any chain method except the terminal ones, so test
// authors do not have to model query order.
//
// Only used in *.test.ts files. Production code never imports this.

import { vi } from 'vitest';

import type { CommandContext } from '../context';

type TerminalResult = { data: unknown; error: { message: string } | null };

export interface MockTableHandler {
  /** Resolves when the chain reaches a terminal method. */
  resolve(): TerminalResult;
}

type Resolver = () => TerminalResult;

class QueryBuilder {
  private resolver: Resolver;
  private maybe: 'single' | 'maybe' | null = null;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  // Pass-through chain methods. They all just return `this` so the
  // test does not need to track call order.
  select(): QueryBuilder {
    return this;
  }
  insert(): QueryBuilder {
    return this;
  }
  update(): QueryBuilder {
    return this;
  }
  delete(): QueryBuilder {
    return this;
  }
  upsert(): QueryBuilder {
    return this;
  }
  eq(): QueryBuilder {
    return this;
  }
  neq(): QueryBuilder {
    return this;
  }
  in(): QueryBuilder {
    return this;
  }
  is(): QueryBuilder {
    return this;
  }
  gte(): QueryBuilder {
    return this;
  }
  lt(): QueryBuilder {
    return this;
  }
  ilike(): QueryBuilder {
    return this;
  }
  contains(): QueryBuilder {
    return this;
  }
  not(): QueryBuilder {
    return this;
  }
  or(): QueryBuilder {
    return this;
  }
  order(): QueryBuilder {
    return this;
  }
  limit(): QueryBuilder {
    return this;
  }

  // Terminal modifiers.
  maybeSingle(): Promise<TerminalResult> {
    this.maybe = 'maybe';
    return Promise.resolve(this.terminal());
  }
  single(): Promise<TerminalResult> {
    this.maybe = 'single';
    return Promise.resolve(this.terminal());
  }

  // Chain terminator: awaiting the builder runs the resolver.
  then<T>(
    onFulfilled?: ((value: TerminalResult) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ): Promise<T> {
    return Promise.resolve(this.terminal()).then(onFulfilled, onRejected);
  }

  private terminal(): TerminalResult {
    const result = this.resolver();
    if (this.maybe !== null && Array.isArray(result.data)) {
      const data: unknown = result.data[0] ?? null;
      return { ...result, data };
    }
    return result;
  }
}

export interface MockSupabaseConfig {
  /** Map of table name → rows or () => rows the chain resolves to. */
  tables?: Record<string, unknown[] | (() => unknown[])>;
  /** Map of rpc name → response. */
  rpcs?: Record<string, unknown>;
  /** Force a Supabase error for a given table. */
  errors?: Record<string, string>;
}

export function createMockSupabase(config: MockSupabaseConfig = {}) {
  const from = vi.fn((table: string) => {
    return new QueryBuilder(() => {
      const forced = config.errors?.[table];
      if (forced) {
        return { data: null, error: { message: forced } };
      }
      const tableConfig = config.tables?.[table];
      const rows = typeof tableConfig === 'function' ? tableConfig() : (tableConfig ?? []);
      return { data: rows, error: null };
    });
  });
  const rpc = vi.fn((name: string) => {
    return new QueryBuilder(() => {
      const value = config.rpcs?.[name];
      if (value === undefined) {
        return { data: null, error: { message: `rpc(${name}) not stubbed` } };
      }
      return { data: value, error: null };
    });
  });
  return {
    from,
    rpc,
    auth: { getUser: vi.fn() },
  } as unknown as CommandContext['supabase'];
}

export function createCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    supabase: overrides.supabase ?? createMockSupabase(),
    user: overrides.user ?? { id: 'u-1', email: 'me@example.com', role: 'employee' },
    role: overrides.role ?? 'attendee',
    patScope: overrides.patScope ?? null,
    t: overrides.t ?? ((key) => key),
    signal: overrides.signal ?? new AbortController().signal,
  };
}

export const ACTIVE_EVENT_ROW = {
  id: 'event-1',
  name: 'Supafest 2026',
  start_date: '2026-09-01',
  end_date: '2026-09-05',
  location: 'Banff',
  is_active: true,
  type: 'company_offsite',
};
