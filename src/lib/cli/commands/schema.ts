import { z } from 'zod';

import { allCommands, registerCommand } from '../registry.ts';

export const SchemaInput = z
  .object({
    format: z.enum(['json', 'md']).optional(),
    mcp: z.boolean().optional(),
    args: z.array(z.string()).optional(),
  })
  .strict();

export const SchemaCommandShape = z.object({
  name: z.string(),
  path: z.array(z.string()),
  summaryKey: z.string(),
  descriptionKey: z.string(),
  examples: z.array(z.string()),
  scope: z.enum(['public', 'user', 'admin', 'super_admin']),
  mutation: z.boolean(),
});

export const SchemaOutput = z.object({ commands: z.array(SchemaCommandShape) });

/**
 * `schema` is intentionally `public` so an unauthenticated agent can
 * discover the surface. Knowing the surface is not knowing how to use
 * it; auth and RLS still gate execution.
 */
registerCommand({
  path: ['schema'],
  summaryKey: 'cli.commands.schema.summary',
  descriptionKey: 'cli.commands.schema.description',
  examples: ['schema', 'schema --mcp'],
  scope: 'public',
  input: SchemaInput,
  output: SchemaOutput,
  handler: () =>
    Promise.resolve({
      commands: allCommands().map((command) => ({
        name: `kizuna_${command.path.join('_')}`,
        path: [...command.path],
        summaryKey: command.summaryKey,
        descriptionKey: command.descriptionKey,
        examples: [...command.examples],
        scope: command.scope,
        mutation: command.mutation ?? false,
      })),
    }),
});
