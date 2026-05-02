import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx } from './_testHelpers';

import './help';
import './me';
import './agenda';

describe('help', () => {
  it('lists commands visible to the caller scope, including the basics', async () => {
    const cmd = getCommand(['help'])!;
    const out = (await cmd.handler({}, createCtx({ role: 'attendee' }))) as {
      commands: Array<{ path: string }>;
    };
    const paths = out.commands.map((command) => command.path);
    expect(paths).toEqual(expect.arrayContaining(['help', 'me', 'agenda']));
  });

  it('filters by prefix when `command` is provided', async () => {
    const cmd = getCommand(['help'])!;
    const out = (await cmd.handler({ command: ['me'] }, createCtx({ role: 'attendee' }))) as {
      commands: Array<{ path: string }>;
    };
    expect(out.commands.map((c) => c.path)).toEqual(['me']);
  });

  it('renders Markdown via toMarkdown', async () => {
    const cmd = getCommand(['help'])!;
    const out = await cmd.handler({}, createCtx());
    const md = cmd.toMarkdown!(out, createCtx());
    expect(md).toContain('- `help`');
  });
});
