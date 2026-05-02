import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag, IdRef } from './_schemas.ts';
import { getActiveEvent, getEventById } from './_shared.ts';

export const EventShape = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().nullable(),
  active: z.boolean(),
});

interface EventRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string | null;
  is_active: boolean;
}

function rowToEvent(row: EventRow): z.infer<typeof EventShape> {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    location: row.location,
    active: row.is_active,
  };
}

export const EventsInput = z
  .object({
    format: FormatFlag,
    args: Args,
    past: z.boolean().optional(),
    future: z.boolean().optional(),
  })
  .strict();

export const EventsOutput = z.object({ events: z.array(EventShape) });

registerCommand({
  path: ['events'],
  summaryKey: 'cli.commands.events.summary',
  descriptionKey: 'cli.commands.events.description',
  examples: ['events', 'events --past', 'events --future'],
  scope: 'user',
  input: EventsInput,
  output: EventsOutput,
  handler: async (input, ctx) => {
    let query = ctx.supabase.from('events').select('*').order('start_date', { ascending: true });
    const today = new Date().toISOString().slice(0, 10);
    if (input.past) query = query.lt('end_date', today);
    if (input.future) query = query.gte('end_date', today);
    const { data, error } = await query;
    if (error) throw error;
    return { events: (data ?? []).map((row) => rowToEvent(row as EventRow)) };
  },
  toMarkdown: (output) =>
    output.events.length === 0
      ? '_No events visible._'
      : output.events
          .map((event) => `- **${event.name}** ${event.startDate} → ${event.endDate}`)
          .join('\n'),
});

export const EventInput = z.object({ format: FormatFlag, args: Args, id: IdRef }).strict();

registerCommand({
  path: ['event'],
  summaryKey: 'cli.commands.event.summary',
  descriptionKey: 'cli.commands.event.description',
  examples: ['event', 'event active', 'event :01h...'],
  scope: 'user',
  input: EventInput,
  output: EventShape,
  handler: async (input, ctx) => {
    const wantsActive = !input.id && (input.args ?? []).every((word) => word === 'active');
    const row = wantsActive
      ? await getActiveEvent(ctx)
      : input.id
        ? await getEventById(ctx, input.id)
        : await getActiveEvent(ctx);
    return rowToEvent(row);
  },
});
