import { ZodError } from 'zod';

import type { CommandContext } from './context';
import { fencedJson } from './formatters/markdown';
import { CommandParseError, parseCommand } from './parser';
import {
  allCommands,
  commandKey,
  getCommand,
  isReachable,
  type Command,
  type CommandFormat,
} from './registry';

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
      error: {
        code: CommandErrorCode;
        message: string;
        details?: unknown;
      };
    };

export interface DispatchInput {
  raw: string;
  format?: CommandFormat;
}

interface ResolvedCommand {
  command: Command<object, unknown>;
  path: string[];
  args: string[];
  refs: {
    user?: string;
    id?: string;
  };
  flags: Record<string, unknown>;
}

export async function dispatch(input: DispatchInput, ctx: CommandContext): Promise<CommandResult> {
  try {
    const resolved = resolveCommand(input.raw);
    if (!resolved) {
      return failure('not_found', ctx.t('cli.errors.notFound'));
    }

    const desiredFormat = input.format ?? normalizeFormat(resolved.flags.format) ?? 'json';
    const parsedInput = resolved.command.input.parse({
      ...resolved.flags,
      ...resolved.refs,
      args: resolved.args,
      command: resolved.args,
    });

    if (!isReachable(resolved.command.scope, roleToScope(ctx.role))) {
      return failure('forbidden', ctx.t('cli.errors.forbidden'));
    }

    const handled = await resolved.command.handler(parsedInput, ctx);
    const data = resolved.command.output.parse(handled);
    if (desiredFormat === 'md') {
      return {
        ok: true,
        data,
        format: 'md',
        markdown: resolved.command.toMarkdown?.(data, ctx) ?? fencedJson(data),
      };
    }
    return { ok: true, data, format: 'json' };
  } catch (error) {
    if (error instanceof CommandParseError) {
      return failure('parse_error', error.message);
    }
    if (error instanceof ZodError) {
      return failure('validation_error', ctx.t('cli.errors.validation'), error.flatten());
    }
    return failure(
      'internal',
      error instanceof Error ? error.message : ctx.t('cli.errors.internal'),
    );
  }
}

export function resolveCommand(raw: string): ResolvedCommand | null {
  const parsed = parseCommand(raw);
  if (parsed.words.length === 0) {
    throw new CommandParseError('Enter a command.');
  }

  if (parsed.words[0] === 'help') {
    const command = getCommand(['help']);
    return command
      ? { command, path: ['help'], args: parsed.words.slice(1), refs: parsed.refs, flags: parsed.flags }
      : null;
  }

  const candidates = allCommands()
    .map((command) => command.path)
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

function normalizeFormat(value: unknown): CommandFormat | undefined {
  return value === 'json' || value === 'md' ? value : undefined;
}

function roleToScope(role: CommandContext['role']) {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'user';
}

function failure(code: CommandErrorCode, message: string, details?: unknown): CommandResult {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } };
}
