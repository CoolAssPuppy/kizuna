import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag } from './_schemas.ts';

export const MeNotificationsInput = z
  .object({
    format: FormatFlag,
    args: Args,
    unread: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export const MeNotificationsOutput = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      subject: z.string(),
      sentAt: z.string(),
      read: z.boolean(),
    }),
  ),
});

registerCommand({
  path: ['me', 'notifications'],
  summaryKey: 'cli.commands.meNotifications.summary',
  descriptionKey: 'cli.commands.meNotifications.description',
  examples: ['me notifications', 'me notifications --unread --limit 10'],
  scope: 'user',
  input: MeNotificationsInput,
  output: MeNotificationsOutput,
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('sent_at', { ascending: false })
      .limit(input.limit ?? 30);
    if (input.unread) query = query.is('read_at', null);
    const { data, error } = await query;
    if (error) throw error;
    return {
      notifications: (data ?? []).map((notification) => ({
        id: notification.id,
        subject: notification.subject,
        sentAt: notification.sent_at,
        read: notification.read_at !== null,
      })),
    };
  },
});
