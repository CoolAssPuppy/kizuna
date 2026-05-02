import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx } from './_testHelpers';

import './schema';
import './me';

describe('schema', () => {
  it('emits MCP tool names plus mutation flags for every registered command', async () => {
    const cmd = getCommand(['schema'])!;
    const out = (await cmd.handler({}, createCtx())) as {
      commands: Array<{ name: string; mutation: boolean }>;
    };
    const names = out.commands.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['kizuna_me', 'kizuna_schema']));
    expect(out.commands.every((c) => typeof c.mutation === 'boolean')).toBe(true);
  });
});
