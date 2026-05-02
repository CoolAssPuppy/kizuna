import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag } from './_schemas.ts';
import { dayBounds, dayToDate, getActiveEvent } from './_shared.ts';
import { SessionItem, sessionOutput } from './sessions.ts';

export const MeSessionsInput = z
  .object({
    format: FormatFlag,
    args: Args,
    day: z.number().int().min(1).max(14).optional(),
    mandatory: z.boolean().optional(),
    favorited: z.boolean().optional(),
  })
  .strict();

export const MeSessionsOutput = z.object({ sessions: z.array(SessionItem) });

interface SessionRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  is_mandatory: boolean;
  capacity: number | null;
}

registerCommand({
  path: ['me', 'sessions'],
  summaryKey: 'cli.commands.meSessions.summary',
  descriptionKey: 'cli.commands.meSessions.description',
  examples: ['me sessions', 'me sessions --favorited', 'me sessions --mandatory'],
  scope: 'user',
  input: MeSessionsInput,
  output: MeSessionsOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const linkTable = input.favorited ? 'session_favorites' : 'session_registrations';
    const { data: links, error: linkError } = await ctx.supabase
      .from(linkTable)
      .select('session_id')
      .eq('user_id', ctx.user.id);
    if (linkError) throw linkError;
    const ids = (links ?? []).map((link) => link.session_id);
    if (ids.length === 0) return { sessions: [] };

    let query = ctx.supabase
      .from('sessions')
      .select('*')
      .eq('event_id', event.id)
      .in('id', ids)
      .order('starts_at');
    if (input.mandatory) query = query.eq('is_mandatory', true);
    const date = dayToDate(event.start_date, input.day);
    if (date) {
      const { start, end } = dayBounds(date);
      query = query.gte('starts_at', start).lt('starts_at', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { sessions: (data ?? []).map((row) => sessionOutput(row as SessionRow)) };
  },
});
