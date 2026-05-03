import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { CommonInput } from './_schemas.ts';

export const ChannelsOutput = z.object({
  channels: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

registerCommand({
  path: ['channels'],
  summaryKey: 'cli.commands.channels.summary',
  descriptionKey: 'cli.commands.channels.description',
  examples: ['channels'],
  scope: 'user',
  input: CommonInput,
  output: ChannelsOutput,
  handler: async (_input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('channels')
      .select('slug, name, description')
      .is('archived_at', null)
      .order('name');
    if (error) throw error;
    return { channels: data ?? [] };
  },
  toMarkdown: (output) =>
    output.channels.length === 0
      ? '_No channels._'
      : output.channels
          .map(
            (channel) =>
              `- [**#${channel.slug}**](/community/channels/${channel.slug}) ${channel.name}`,
          )
          .join('\n'),
});
