export type ParsedFlagValue = boolean | string | number;

export interface ParsedCommand {
  words: string[];
  refs: {
    user?: string;
    id?: string;
  };
  flags: Record<string, ParsedFlagValue>;
}

export class CommandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandParseError';
  }
}

export function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === undefined) continue;

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new CommandParseError('Unclosed quote.');
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCommand(raw: string): ParsedCommand {
  const tokens = tokenize(raw.trim());
  const words: string[] = [];
  const flags: Record<string, ParsedFlagValue> = {};
  const refs: ParsedCommand['refs'] = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    if (token.startsWith('--no-')) {
      flags[toCamelFlag(token.slice(5))] = false;
      continue;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equals = body.indexOf('=');
      if (equals !== -1) {
        flags[toCamelFlag(body.slice(0, equals))] = coerceValue(body.slice(equals + 1));
        continue;
      }

      const next = tokens[index + 1];
      if (next && !next.startsWith('--') && !next.startsWith('@') && !next.startsWith(':')) {
        flags[toCamelFlag(body)] = coerceValue(next);
        index += 1;
      } else {
        flags[toCamelFlag(body)] = true;
      }
      continue;
    }

    if (token.startsWith('@')) {
      refs.user = token.slice(1);
      continue;
    }

    if (token.startsWith(':')) {
      refs.id = token.slice(1);
      continue;
    }

    words.push(token.toLowerCase());
  }

  return { words, refs, flags };
}

function toCamelFlag(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function coerceValue(value: string): ParsedFlagValue {
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
