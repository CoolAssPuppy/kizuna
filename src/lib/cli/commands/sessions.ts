import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag, IdRef } from './_schemas.ts';
import { dayBounds, dayToDate, formatDateTime, getActiveEvent } from './_shared.ts';

export const SessionItem = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string().nullable(),
  mandatory: z.boolean(),
  capacity: z.number().nullable(),
});

export const SessionsInput = z
  .object({
    format: FormatFlag,
    args: Args,
    id: IdRef,
    day: z.number().int().min(1).max(14).optional(),
    mandatory: z.boolean().optional(),
    hasCapacity: z.boolean().optional(),
    track: z.string().optional(),
  })
  .strict();

export const SessionsOutput = z.object({ sessions: z.array(SessionItem) });

interface SessionRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  is_mandatory: boolean;
  capacity: number | null;
  type?: string | null;
}

export function sessionOutput(row: SessionRow): z.infer<typeof SessionItem> {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    mandatory: row.is_mandatory,
    capacity: row.capacity,
  };
}

registerCommand({
  path: ['sessions'],
  summaryKey: 'cli.commands.sessions.summary',
  descriptionKey: 'cli.commands.sessions.description',
  examples: ['sessions', 'sessions --mandatory', 'sessions :sessionId'],
  scope: 'user',
  input: SessionsInput,
  output: SessionsOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase
      .from('sessions')
      .select('*')
      .eq('event_id', event.id)
      .order('starts_at');
    if (input.id) query = query.eq('id', input.id);
    if (input.mandatory) query = query.eq('is_mandatory', true);
    if (input.hasCapacity) query = query.not('capacity', 'is', null);
    const date = dayToDate(event.start_date, input.day);
    if (date) {
      const { start, end } = dayBounds(date);
      query = query.gte('starts_at', start).lt('starts_at', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = input.track
      ? (data ?? []).filter((session) => session.type === input.track)
      : (data ?? []);
    return { sessions: rows.map((row) => sessionOutput(row as SessionRow)) };
  },
  toMarkdown: (output) =>
    output.sessions.length === 0
      ? '_No sessions match._'
      : output.sessions
          .map(
            (session) =>
              `- **${formatDateTime(session.startsAt)}** [${session.title}](/agenda)` +
              (session.mandatory ? ' _(mandatory)_' : ''),
          )
          .join('\n'),
});
