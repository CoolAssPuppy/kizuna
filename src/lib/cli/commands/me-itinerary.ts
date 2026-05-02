import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { DateFlag, FormatFlag, Args } from './_schemas.ts';
import { dayBounds, dayToDate, formatDateTime, getActiveEvent } from './_shared.ts';

export const MeItineraryInput = z
  .object({
    format: FormatFlag,
    args: Args,
    day: z.number().int().min(1).max(14).optional(),
    date: DateFlag,
  })
  .strict();

export const ItineraryItem = z.object({
  id: z.string(),
  itemType: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  location: z.string().nullable(),
  source: z.object({ table: z.string(), id: z.string().nullable() }),
});

export const MeItineraryOutput = z.object({
  eventId: z.string(),
  items: z.array(ItineraryItem),
  generatedAt: z.string(),
});

registerCommand({
  path: ['me', 'itinerary'],
  summaryKey: 'cli.commands.meItinerary.summary',
  descriptionKey: 'cli.commands.meItinerary.description',
  examples: ['me itinerary', 'me itinerary --day 2', 'me itinerary --date 2027-01-12 --format md'],
  scope: 'user',
  input: MeItineraryInput,
  output: MeItineraryOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase
      .from('itinerary_items')
      .select('*')
      .eq('user_id', ctx.user.id)
      .eq('event_id', event.id)
      .order('starts_at', { ascending: true });
    const date = input.date ?? dayToDate(event.start_date, input.day);
    if (date) {
      const { start, end } = dayBounds(date);
      query = query.gte('starts_at', start).lt('starts_at', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return {
      eventId: event.id,
      items: (data ?? []).map((item) => ({
        id: item.id,
        itemType: item.item_type,
        title: item.title,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        location: item.subtitle,
        source: { table: item.source, id: item.source_id },
      })),
      generatedAt: new Date().toISOString(),
    };
  },
  toMarkdown: (output) =>
    output.items.length === 0
      ? '_No itinerary items yet._'
      : output.items
          .map(
            (item) =>
              `- **${formatDateTime(item.startsAt)}** ${item.title}` +
              (item.location ? ` _(${item.location})_` : ''),
          )
          .join('\n'),
});
