import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag } from './_schemas.ts';
import { dayBounds, dayToDate, formatDateTime, getActiveEvent } from './_shared.ts';
import { SessionItem, sessionOutput } from './sessions.ts';

export const AgendaInput = z
  .object({
    format: FormatFlag,
    args: Args,
    day: z.number().int().min(1).max(14).optional(),
  })
  .strict();

export const AgendaOutput = z.object({ sessions: z.array(SessionItem) });

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
  path: ['agenda'],
  summaryKey: 'cli.commands.agenda.summary',
  descriptionKey: 'cli.commands.agenda.description',
  examples: ['agenda', 'agenda --day 1'],
  scope: 'user',
  input: AgendaInput,
  output: AgendaOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase
      .from('sessions')
      .select('*')
      .eq('event_id', event.id)
      .order('starts_at');
    const date = dayToDate(event.start_date, input.day);
    if (date) {
      const { start, end } = dayBounds(date);
      query = query.gte('starts_at', start).lt('starts_at', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { sessions: (data ?? []).map((row) => sessionOutput(row as SessionRow)) };
  },
  toMarkdown: (output) =>
    output.sessions.length === 0
      ? '_No sessions for this day._'
      : output.sessions
          .map((session) => `- **${formatDateTime(session.startsAt)}** [${session.title}](/agenda)`)
          .join('\n'),
});
