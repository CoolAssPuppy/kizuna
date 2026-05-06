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

// ---------------------------------------------------------------------
// Allowed-domains management. Mirrors the chip-input on the admin About
// tab: list, add, and remove domain entries on the active event. The
// helpers below treat the column as a set, so adding a domain that's
// already there is a no-op rather than an error.
// ---------------------------------------------------------------------

const Domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    'domain must look like host.tld or *.host.tld',
  );

const AllowedDomainsListInput = z.object({ format: FormatFlag, args: Args }).strict();
const AllowedDomainsListOutput = z.object({
  event_id: z.string(),
  invite_all_employees: z.boolean(),
  allowed_domains: z.array(z.string()),
});

registerCommand({
  path: ['events', 'allowed-domains', 'list'],
  summaryKey: 'cli.commands.allowedDomainsList.summary',
  descriptionKey: 'cli.commands.allowedDomainsList.description',
  examples: ['events allowed-domains list'],
  scope: 'admin',
  input: AllowedDomainsListInput,
  output: AllowedDomainsListOutput,
  handler: async (_input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('events')
      .select('id, invite_all_employees, allowed_domains')
      .eq('id', event.id)
      .single();
    if (error) throw error;
    return {
      event_id: data.id,
      invite_all_employees: data.invite_all_employees,
      allowed_domains: data.allowed_domains ?? [],
    };
  },
  toMarkdown: (output) =>
    output.allowed_domains.length === 0
      ? '_No allowed domains set._'
      : output.allowed_domains.map((d) => `- ${d}`).join('\n'),
});

const AllowedDomainsMutateInput = z
  .object({ format: FormatFlag, args: Args, domain: Domain })
  .strict();

const AllowedDomainsMutateOutput = z.object({
  event_id: z.string(),
  allowed_domains: z.array(z.string()),
});

registerCommand({
  path: ['events', 'allowed-domains', 'add'],
  summaryKey: 'cli.commands.allowedDomainsAdd.summary',
  descriptionKey: 'cli.commands.allowedDomainsAdd.description',
  examples: [
    'events allowed-domains add --domain supabase.io',
    'events allowed-domains add --domain "*.supabase.io"',
  ],
  scope: 'admin',
  mutation: true,
  input: AllowedDomainsMutateInput,
  output: AllowedDomainsMutateOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data: row, error: readErr } = await ctx.supabase
      .from('events')
      .select('allowed_domains')
      .eq('id', event.id)
      .single();
    if (readErr) throw readErr;
    const current: string[] = row.allowed_domains ?? [];
    const next = current.includes(input.domain) ? current : [...current, input.domain];
    const { data, error } = await ctx.supabase
      .from('events')
      .update({ allowed_domains: next })
      .eq('id', event.id)
      .select('id, allowed_domains')
      .single();
    if (error) throw error;
    return { event_id: data.id, allowed_domains: data.allowed_domains ?? [] };
  },
  toMarkdown: (output) =>
    output.allowed_domains.length === 0
      ? '_No domains set._'
      : output.allowed_domains.map((d) => `- ${d}`).join('\n'),
});

registerCommand({
  path: ['events', 'allowed-domains', 'remove'],
  summaryKey: 'cli.commands.allowedDomainsRemove.summary',
  descriptionKey: 'cli.commands.allowedDomainsRemove.description',
  examples: ['events allowed-domains remove --domain supabase.io'],
  scope: 'admin',
  mutation: true,
  input: AllowedDomainsMutateInput,
  output: AllowedDomainsMutateOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data: row, error: readErr } = await ctx.supabase
      .from('events')
      .select('allowed_domains')
      .eq('id', event.id)
      .single();
    if (readErr) throw readErr;
    const current: string[] = row.allowed_domains ?? [];
    const next = current.filter((d) => d !== input.domain);
    const { data, error } = await ctx.supabase
      .from('events')
      .update({ allowed_domains: next })
      .eq('id', event.id)
      .select('id, allowed_domains')
      .single();
    if (error) throw error;
    return { event_id: data.id, allowed_domains: data.allowed_domains ?? [] };
  },
  toMarkdown: (output) =>
    output.allowed_domains.length === 0
      ? '_No domains remain._'
      : output.allowed_domains.map((d) => `- ${d}`).join('\n'),
});
