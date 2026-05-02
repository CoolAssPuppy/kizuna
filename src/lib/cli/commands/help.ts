import { z } from 'zod';

import { commandKey, listCommands, registerCommand } from '../registry.ts';
import { roleToScope } from './_shared.ts';

export const HelpInput = z
  .object({
    format: z.enum(['json', 'md']).optional(),
    command: z.array(z.string()).optional(),
    args: z.array(z.string()).optional(),
  })
  .strict();

export const HelpCommandShape = z.object({
  path: z.string(),
  summary: z.string(),
  description: z.string(),
  examples: z.array(z.string()),
  scope: z.enum(['public', 'user', 'admin', 'super_admin']),
  mutation: z.boolean(),
});

export const HelpOutput = z.object({ commands: z.array(HelpCommandShape) });

registerCommand({
  path: ['help'],
  summaryKey: 'cli.commands.help.summary',
  descriptionKey: 'cli.commands.help.description',
  examples: ['help', 'help me itinerary'],
  scope: 'public',
  input: HelpInput,
  output: HelpOutput,
  handler: (input, ctx) => {
    const callerScope = roleToScope(ctx.role);
    const filter = (input.command ?? input.args ?? []).join(' ').trim();
    const visible = listCommands(callerScope).filter((command) =>
      filter ? commandKey(command.path).startsWith(filter) : true,
    );
    return Promise.resolve({
      commands: visible.map((command) => ({
        path: commandKey(command.path),
        summary: ctx.t(command.summaryKey),
        description: ctx.t(command.descriptionKey),
        examples: [...command.examples],
        scope: command.scope,
        mutation: command.mutation ?? false,
      })),
    });
  },
  toMarkdown: (output) =>
    output.commands.length === 0
      ? '_No matching commands._'
      : output.commands.map((command) => `- \`${command.path}\` — ${command.summary}`).join('\n'),
});
