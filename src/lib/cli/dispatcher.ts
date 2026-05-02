import { ZodError } from 'zod';

import type { CommandContext, CliPatScope } from './context.ts';
import { fencedJson } from './formatters/markdown.ts';
import { CommandParseError, parseCommand } from './parser.ts';
import {
  allCommands,
  commandKey,
  getCommand,
  isReachable,
  type Command,
  type CommandFormat,
  type CommandScope,
} from './registry.ts';

export type CommandErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'parse_error'
  | 'rate_limit'
  | 'internal';

export type CommandResult =
  | { ok: true; data: unknown; format: CommandFormat; markdown?: string }
  | {
      ok: false;
      error: { code: CommandErrorCode; message: string; details?: unknown };
    };

export interface DispatchInput {
  /** Raw command string from a typing user or HTTP body. */
  readonly raw: string;
  /**
   * Transport-level format override. Wins over the `--format` flag.
   * Useful when the HTTP caller wants JSON regardless of the typed flag.
   */
  readonly format?: CommandFormat;
}

export interface ResolvedCommand {
  readonly command: Command<object, unknown>;
  readonly path: readonly string[];
  readonly args: readonly string[];
  readonly refs: { user?: string; id?: string };
  readonly flags: Record<string, unknown>;
}

export async function dispatch(input: DispatchInput, ctx: CommandContext): Promise<CommandResult> {
  let resolved: ResolvedCommand | null;
  try {
    resolved = resolveCommand(input.raw);
  } catch (error) {
    if (error instanceof CommandParseError) {
      return failure('parse_error', error.message);
    }
    return failure('internal', errorMessage(error, ctx));
  }

  if (!resolved) return failure('not_found', ctx.t('cli.errors.notFound'));

  const scopeCheck = enforceScope(resolved.command, ctx);
  if (scopeCheck) return scopeCheck;

  const desiredFormat: CommandFormat =
    input.format ?? coerceFormat(resolved.flags.format) ?? 'json';

  let parsedInput: object;
  try {
    parsedInput = resolved.command.input.parse({
      ...resolved.flags,
      ...resolved.refs,
      args: resolved.args,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return failure('validation_error', ctx.t('cli.errors.validation'), error.flatten());
    }
    return failure('internal', errorMessage(error, ctx));
  }

  let handlerOutput: unknown;
  try {
    handlerOutput = await resolved.command.handler(parsedInput, ctx);
  } catch (error) {
    return failure('internal', errorMessage(error, ctx));
  }

  let validatedOutput: unknown;
  try {
    validatedOutput = resolved.command.output.parse(handlerOutput);
  } catch (error) {
    if (error instanceof ZodError) {
      return failure('internal', ctx.t('cli.errors.outputShape'), error.flatten());
    }
    return failure('internal', errorMessage(error, ctx));
  }

  if (desiredFormat === 'md') {
    const markdown = resolved.command.toMarkdown
      ? resolved.command.toMarkdown(validatedOutput, ctx)
      : fencedJson(validatedOutput);
    return { ok: true, data: validatedOutput, format: 'md', markdown };
  }
  return { ok: true, data: validatedOutput, format: 'json' };
}

/**
 * Tokenise + match against the registry. Longest-path match wins, so
 * `me itinerary` resolves over the bare `me` command. Throws
 * CommandParseError if the input is empty or malformed.
 */
export function resolveCommand(raw: string): ResolvedCommand | null {
  const parsed = parseCommand(raw);
  if (parsed.words.length === 0) {
    throw new CommandParseError('Enter a command. Try `help`.');
  }

  const candidates = allCommands()
    .map((command) => command.path)
    .filter((path) => path.length <= parsed.words.length)
    .sort((a, b) => b.length - a.length);

  for (const path of candidates) {
    if (path.every((part, index) => parsed.words[index] === part)) {
      const command = getCommand(path);
      if (!command) continue;
      return {
        command,
        path: [...path],
        args: parsed.words.slice(path.length),
        refs: parsed.refs,
        flags: parsed.flags,
      };
    }
  }

  return null;
}

export function commandUsage(command: Command<object, unknown>): string {
  return commandKey(command.path);
}

function enforceScope(
  command: Command<object, unknown>,
  ctx: CommandContext,
): CommandResult | null {
  // Role gate: an attendee cannot run admin commands even with an
  // admin PAT (that is impossible to mint, but defence in depth).
  if (!isReachable(command.scope, roleToScope(ctx.role))) {
    return failure('forbidden', ctx.t('cli.errors.forbidden'));
  }

  // PAT-scope gate: only applies when invoked over HTTP/MCP.
  if (ctx.patScope) {
    if (!patScopeAllows(ctx.patScope, command)) {
      return failure('forbidden', ctx.t('cli.errors.patScope'));
    }
  }
  return null;
}

function patScopeAllows(scope: CliPatScope, command: Command<object, unknown>): boolean {
  if (scope === 'admin') return true;
  if (command.scope === 'admin' || command.scope === 'super_admin') return false;
  if (command.mutation === true) return scope === 'write';
  return true;
}

function roleToScope(role: CommandContext['role']): CommandScope {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'user';
}

function coerceFormat(value: unknown): CommandFormat | undefined {
  return value === 'json' || value === 'md' ? value : undefined;
}

function errorMessage(error: unknown, ctx: CommandContext): string {
  if (error instanceof Error) return error.message;
  return ctx.t('cli.errors.internal');
}

function failure(code: CommandErrorCode, message: string, details?: unknown): CommandResult {
  return {
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
}
