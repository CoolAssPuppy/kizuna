// Serializes structured args (the shape an MCP agent or programmatic
// caller passes) back into the CLI string the dispatcher consumes.
// Keeps a single source of truth for grammar: the parser knows how to
// read `me itinerary --day 2`, this helper knows how to write it.

export interface SerializeOptions {
  readonly path: ReadonlyArray<string>;
  readonly input: Record<string, unknown>;
}

export function serializeCommand({ path, input }: SerializeOptions): string {
  const parts: string[] = [...path];
  const positional = (input.args as unknown[] | undefined) ?? [];
  for (const word of positional) {
    if (typeof word === 'string') parts.push(quoteIfNeeded(word));
  }

  if (typeof input.user === 'string' && input.user.length > 0) {
    parts.push(`@${input.user}`);
  }
  if (typeof input.id === 'string' && input.id.length > 0) {
    parts.push(`:${input.id}`);
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (key === 'args' || key === 'user' || key === 'id') continue;
    if (value === true) {
      parts.push(`--${kebab(key)}`);
      continue;
    }
    if (value === false) {
      parts.push(`--no-${kebab(key)}`);
      continue;
    }
    if (Array.isArray(value)) {
      // Repeat-flag form: `--hobby snowboarding --hobby hiking`.
      for (const entry of value) {
        if (entry === undefined || entry === null) continue;
        parts.push(`--${kebab(key)}`, quoteIfNeeded(String(entry)));
      }
      continue;
    }
    parts.push(`--${kebab(key)}`, quoteIfNeeded(stringify(value)));
  }

  return parts.join(' ');
}

function kebab(camel: string): string {
  return camel.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

function quoteIfNeeded(value: string): string {
  if (/^[A-Za-z0-9_\-./:@,]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  // Anything else (objects, dates, etc.) — JSON-serialize so we never
  // emit "[object Object]" by accident.
  return JSON.stringify(value);
}
