import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { CommonInput } from './_schemas.ts';

export const MeTransportOutput = z.object({
  requests: z.array(
    z.object({
      id: z.string(),
      direction: z.string(),
      pickupAt: z.string(),
      needsReview: z.boolean(),
    }),
  ),
});

registerCommand({
  path: ['me', 'transport'],
  summaryKey: 'cli.commands.meTransport.summary',
  descriptionKey: 'cli.commands.meTransport.description',
  examples: ['me transport'],
  scope: 'user',
  input: CommonInput,
  output: MeTransportOutput,
  handler: async (_input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('transport_requests')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('pickup_at');
    if (error) throw error;
    return {
      requests: (data ?? []).map((request) => ({
        id: request.id,
        direction: request.direction,
        pickupAt: request.pickup_at,
        needsReview: request.needs_review,
      })),
    };
  },
});
