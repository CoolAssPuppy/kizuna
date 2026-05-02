import type { ZodType } from 'zod';

import type { CommandContext } from './context.ts';

export type CommandScope = 'public' | 'user' | 'admin' | 'super_admin';
export type CommandFormat = 'json' | 'md';

export interface Command<TInput extends object, TOutput> {
  /** Verb path, e.g. ['me', 'itinerary']. */
  readonly path: readonly string[];
  readonly summaryKey: string;
  readonly descriptionKey: string;
  readonly examples: readonly string[];
  readonly scope: CommandScope;
  /**
   * Set true for write commands. Read PATs cannot run mutations
   * regardless of role; the dispatcher enforces this.
   */
  readonly mutation?: boolean;
  readonly input: ZodType<TInput>;
  readonly output: ZodType<TOutput>;
  readonly handler: (input: TInput, ctx: CommandContext) => Promise<TOutput>;
  readonly toMarkdown?: (output: TOutput, ctx: CommandContext) => string;
}

const REGISTRY = new Map<string, Command<object, unknown>>();

export function registerCommand<TInput extends object, TOutput>(
  cmd: Command<TInput, TOutput>,
): void {
  const key = commandKey(cmd.path);
  if (REGISTRY.has(key)) {
    throw new Error(`Command already registered: ${key}`);
  }
  REGISTRY.set(key, cmd as unknown as Command<object, unknown>);
}

export function getCommand(path: readonly string[]): Command<object, unknown> | undefined {
  return REGISTRY.get(commandKey(path));
}

export function listCommands(scope: CommandScope): ReadonlyArray<Command<object, unknown>> {
  return Array.from(REGISTRY.values()).filter((command) => isReachable(command.scope, scope));
}

export function allCommands(): ReadonlyArray<Command<object, unknown>> {
  return Array.from(REGISTRY.values());
}

export function commandKey(path: readonly string[]): string {
  return path.join(' ');
}

export function isReachable(required: CommandScope, current: CommandScope): boolean {
  const order = ['public', 'user', 'admin', 'super_admin'] as const;
  return order.indexOf(current) >= order.indexOf(required);
}

/**
 * Reset the registry. Test-only — production code never calls this.
 * Exposed because Vitest module isolation does not cover `registerCommand`'s
 * module-level state when tests import command modules in different orders.
 */
export function __resetRegistryForTests(): void {
  REGISTRY.clear();
}
