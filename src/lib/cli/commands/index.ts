import { z } from 'zod';

import type { CommandContext } from '../context';
import { commandKey, listCommands, registerCommand } from '../registry';
import type { CommandScope } from '../registry';

const FormatFlag = z.enum(['json', 'md']).optional();
const Args = z.array(z.string()).optional();
const Id = z.string().min(1).optional();
const UserRef = z.string().min(1).optional();
const DateFlag = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const HelpInput = z.object({ format: FormatFlag, command: z.array(z.string()).optional() }).strict();
const HelpCommand = z.object({
  path: z.string(),
  summary: z.string(),
  description: z.string(),
  examples: z.array(z.string()),
  scope: z.enum(['public', 'user', 'admin', 'super_admin']),
});
const HelpOutput = z.object({ commands: z.array(HelpCommand) });

registerCommand({
  path: ['help'],
  summaryKey: 'cli.commands.help.summary',
  descriptionKey: 'cli.commands.help.description',
  examples: ['help', 'help me itinerary'],
  scope: 'public',
  input: HelpInput,
  output: HelpOutput,
  handler: (input, ctx) => {
    const currentScope = roleToScope(ctx.role);
    const filter = input.command?.join(' ');
    const commands = listCommands(currentScope)
      .filter((command) => (filter ? commandKey(command.path).startsWith(filter) : true))
      .map((command) => ({
        path: commandKey(command.path),
        summary: ctx.t(command.summaryKey),
        description: ctx.t(command.descriptionKey),
        examples: [...command.examples],
        scope: command.scope,
      }));
    return Promise.resolve({ commands });
  },
  toMarkdown: (output) =>
    output.commands
      .map((command) => `- \`${command.path}\` - ${command.summary}`)
      .join('\n'),
});

const SchemaInput = z.object({ format: FormatFlag, mcp: z.boolean().optional(), args: Args }).strict();
const SchemaOutput = z.object({
  commands: z.array(
    z.object({
      name: z.string(),
      path: z.array(z.string()),
      summaryKey: z.string(),
      descriptionKey: z.string(),
      examples: z.array(z.string()),
      scope: z.enum(['public', 'user', 'admin', 'super_admin']),
      mutation: z.boolean(),
    }),
  ),
});

registerCommand({
  path: ['schema'],
  summaryKey: 'cli.commands.schema.summary',
  descriptionKey: 'cli.commands.schema.description',
  examples: ['schema', 'schema --mcp'],
  scope: 'public',
  input: SchemaInput,
  output: SchemaOutput,
  handler: () => Promise.resolve({
    commands: listCommands('super_admin').map((command) => ({
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

const MeOutput = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  displayName: z.string().nullable(),
  team: z.string().nullable(),
  department: z.string().nullable(),
});

registerCommand({
  path: ['me'],
  summaryKey: 'cli.commands.me.summary',
  descriptionKey: 'cli.commands.me.description',
  examples: ['me', 'me --format md'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args }).strict(),
  output: MeOutput,
  handler: async (_input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('users')
      .select(
        'id, email, role, employee_profiles ( preferred_name, legal_name, team, department ), guest_profiles ( first_name, last_name )',
      )
      .eq('id', ctx.user.id)
      .maybeSingle();
    if (error) throw error;
    const row = data as UserSnapshotRow | null;
    const employee = first(row?.employee_profiles);
    const guest = first(row?.guest_profiles);
    return {
      userId: ctx.user.id,
      email: row?.email ?? ctx.user.email,
      role: row?.role ?? ctx.user.role,
      displayName: employee?.preferred_name ?? employee?.legal_name ?? guestName(guest),
      team: employee?.team ?? null,
      department: employee?.department ?? null,
    };
  },
  toMarkdown: (output) => `**${output.displayName ?? output.email}**\n\n${output.role}`,
});

const EventShape = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().nullable(),
  active: z.boolean(),
});

registerCommand({
  path: ['events'],
  summaryKey: 'cli.commands.events.summary',
  descriptionKey: 'cli.commands.events.description',
  examples: ['events', 'events --future'],
  scope: 'user',
  input: z
    .object({ format: FormatFlag, args: Args, past: z.boolean().optional(), future: z.boolean().optional() })
    .strict(),
  output: z.object({ events: z.array(EventShape) }),
  handler: async (input, ctx) => {
    let query = ctx.supabase.from('events').select('*').order('start_date', { ascending: true });
    const today = new Date().toISOString().slice(0, 10);
    if (input.past) query = query.lt('end_date', today);
    if (input.future) query = query.gte('end_date', today);
    const { data, error } = await query;
    if (error) throw error;
    return {
      events: (data ?? []).map((event) => ({
        id: event.id,
        name: event.name,
        startDate: event.start_date,
        endDate: event.end_date,
        location: event.location,
        active: event.is_active,
      })),
    };
  },
  toMarkdown: (output) =>
    output.events
      .map((event) => `- **${event.name}** ${event.startDate} - ${event.endDate}`)
      .join('\n'),
});

registerCommand({
  path: ['event'],
  summaryKey: 'cli.commands.event.summary',
  descriptionKey: 'cli.commands.event.description',
  examples: ['event', 'event active', 'event :01h...'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, id: Id }).strict(),
  output: EventShape,
  handler: async (input, ctx) => {
    const event = input.id ? await getEventById(ctx, input.id) : await getActiveEvent(ctx);
    return {
      id: event.id,
      name: event.name,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      active: event.is_active,
    };
  },
});

const ItineraryItem = z.object({
  id: z.string(),
  itemType: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  location: z.string().nullable(),
  source: z.object({ table: z.string(), id: z.string().nullable() }),
});
const ItineraryOutput = z.object({
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
  input: z.object({ format: FormatFlag, args: Args, day: z.number().int().min(1).max(14).optional(), date: DateFlag }).strict(),
  output: ItineraryOutput,
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
      query = query.gte('starts_at', `${date}T00:00:00`).lt('starts_at', `${date}T23:59:59.999`);
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
      : output.items.map((item) => `- **${formatDateTime(item.startsAt)}** ${item.title}`).join('\n'),
});

const SessionItem = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string().nullable(),
  mandatory: z.boolean(),
  capacity: z.number().nullable(),
});

registerCommand({
  path: ['sessions'],
  summaryKey: 'cli.commands.sessions.summary',
  descriptionKey: 'cli.commands.sessions.description',
  examples: ['sessions', 'sessions --mandatory', 'sessions :id'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, id: Id, day: z.number().int().min(1).max(14).optional(), mandatory: z.boolean().optional(), hasCapacity: z.boolean().optional(), track: z.string().optional() }).strict(),
  output: z.object({ sessions: z.array(SessionItem) }),
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase.from('sessions').select('*').eq('event_id', event.id).order('starts_at');
    if (input.id) query = query.eq('id', input.id);
    if (input.mandatory) query = query.eq('is_mandatory', true);
    if (input.hasCapacity) query = query.not('capacity', 'is', null);
    const date = dayToDate(event.start_date, input.day);
    if (date) query = query.gte('starts_at', `${date}T00:00:00`).lt('starts_at', `${date}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = input.track ? (data ?? []).filter((session) => session.type === input.track) : (data ?? []);
    return { sessions: rows.map(sessionOutput) };
  },
  toMarkdown: (output) =>
    output.sessions.map((session) => `- **${formatDateTime(session.startsAt)}** ${session.title}`).join('\n'),
});

registerCommand({
  path: ['me', 'sessions'],
  summaryKey: 'cli.commands.meSessions.summary',
  descriptionKey: 'cli.commands.meSessions.description',
  examples: ['me sessions', 'me sessions --favorited'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, day: z.number().int().min(1).max(14).optional(), mandatory: z.boolean().optional(), favorited: z.boolean().optional() }).strict(),
  output: z.object({ sessions: z.array(SessionItem) }),
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const table = input.favorited ? 'session_favorites' : 'session_registrations';
    const { data: links, error: linkError } = await ctx.supabase
      .from(table)
      .select('session_id')
      .eq('user_id', ctx.user.id);
    if (linkError) throw linkError;
    const ids = (links ?? []).map((link) => link.session_id);
    if (ids.length === 0) return { sessions: [] };
    let query = ctx.supabase.from('sessions').select('*').eq('event_id', event.id).in('id', ids).order('starts_at');
    if (input.mandatory) query = query.eq('is_mandatory', true);
    const date = dayToDate(event.start_date, input.day);
    if (date) query = query.gte('starts_at', `${date}T00:00:00`).lt('starts_at', `${date}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    return { sessions: (data ?? []).map(sessionOutput) };
  },
});

registerCommand({
  path: ['agenda'],
  summaryKey: 'cli.commands.agenda.summary',
  descriptionKey: 'cli.commands.agenda.description',
  examples: ['agenda', 'agenda --day 1'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, day: z.number().int().min(1).max(14).optional() }).strict(),
  output: z.object({ sessions: z.array(SessionItem) }),
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase.from('sessions').select('*').eq('event_id', event.id).order('starts_at');
    const date = dayToDate(event.start_date, input.day);
    if (date) query = query.gte('starts_at', `${date}T00:00:00`).lt('starts_at', `${date}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    return { sessions: (data ?? []).map(sessionOutput) };
  },
});

registerCommand({
  path: ['me', 'documents'],
  summaryKey: 'cli.commands.meDocuments.summary',
  descriptionKey: 'cli.commands.meDocuments.description',
  examples: ['me documents', 'me documents --unsigned'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, unsigned: z.boolean().optional() }).strict(),
  output: z.object({
    documents: z.array(
      z.object({ id: z.string(), title: z.string(), version: z.number(), signed: z.boolean() }),
    ),
  }),
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data: documents, error } = await ctx.supabase
      .from('documents')
      .select('*')
      .eq('is_active', true)
      .or(`event_id.eq.${event.id},event_id.is.null`)
      .order('display_order');
    if (error) throw error;
    const { data: acks, error: ackError } = await ctx.supabase
      .from('document_acknowledgements')
      .select('document_key, document_version')
      .eq('user_id', ctx.user.id)
      .eq('event_id', event.id);
    if (ackError) throw ackError;
    const signed = new Set((acks ?? []).map((ack) => `${ack.document_key}:${ack.document_version}`));
    const rows = (documents ?? []).map((document) => ({
      id: document.id,
      title: document.title,
      version: document.version,
      signed: signed.has(`${document.document_key}:${document.version}`),
    }));
    return { documents: input.unsigned ? rows.filter((row) => !row.signed) : rows };
  },
});

registerCommand({
  path: ['me', 'roommates'],
  summaryKey: 'cli.commands.meRoommates.summary',
  descriptionKey: 'cli.commands.meRoommates.description',
  examples: ['me roommates'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args }).strict(),
  output: z.object({
    room: z.object({ hotelName: z.string(), roomNumber: z.string().nullable(), roomType: z.string() }).nullable(),
    roommates: z.array(z.object({ userId: z.string(), email: z.string() })),
  }),
  handler: async (_input, ctx) => {
    const { data: mine, error } = await ctx.supabase
      .from('accommodation_occupants')
      .select('accommodation_id, accommodations ( hotel_name, room_number, room_type )')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!mine) return { room: null, roommates: [] };
    const accommodation = first(mine.accommodations);
    const { data: occupants, error: occupantError } = await ctx.supabase
      .from('accommodation_occupants')
      .select('user_id, users ( email )')
      .eq('accommodation_id', mine.accommodation_id);
    if (occupantError) throw occupantError;
    return {
      room: accommodation
        ? {
            hotelName: accommodation.hotel_name,
            roomNumber: accommodation.room_number,
            roomType: accommodation.room_type,
          }
        : null,
      roommates: (occupants ?? [])
        .filter((row) => row.user_id !== ctx.user.id)
        .map((row) => ({ userId: row.user_id, email: first(row.users)?.email ?? '' })),
    };
  },
});

registerCommand({
  path: ['me', 'transport'],
  summaryKey: 'cli.commands.meTransport.summary',
  descriptionKey: 'cli.commands.meTransport.description',
  examples: ['me transport'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args }).strict(),
  output: z.object({
    requests: z.array(
      z.object({ id: z.string(), direction: z.string(), pickupAt: z.string(), needsReview: z.boolean() }),
    ),
  }),
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

registerCommand({
  path: ['me', 'notifications'],
  summaryKey: 'cli.commands.meNotifications.summary',
  descriptionKey: 'cli.commands.meNotifications.description',
  examples: ['me notifications', 'me notifications --unread --limit 10'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, unread: z.boolean().optional(), limit: z.number().int().positive().max(100).optional() }).strict(),
  output: z.object({
    notifications: z.array(z.object({ id: z.string(), subject: z.string(), sentAt: z.string(), read: z.boolean() })),
  }),
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

registerCommand({
  path: ['attendees'],
  summaryKey: 'cli.commands.attendees.summary',
  descriptionKey: 'cli.commands.attendees.description',
  examples: ['attendees', 'attendees --hobby snowboarding', 'attendees @alice'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, user: UserRef, hobby: z.string().optional(), dietary: z.string().optional(), team: z.string().optional(), arriving: DateFlag, limit: z.number().int().positive().max(500).optional() }).strict(),
  output: z.object({
    matches: z.array(
      z.object({ userId: z.string(), handle: z.string(), fullName: z.string(), team: z.string().nullable(), hobbies: z.array(z.string()) }),
    ),
    total: z.number(),
  }),
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from('attendee_profiles')
      .select('user_id, hobbies, users!attendee_profiles_user_id_fkey ( email, employee_profiles ( preferred_name, legal_name, team ), guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name ) )')
      .neq('visibility', 'private')
      .limit(input.limit ?? 50);
    if (input.hobby) query = query.contains('hobbies', [input.hobby]);
    const { data, error } = await query;
    if (error) throw error;
    const matches = (data ?? []).map((row) => attendeeOutput(row as unknown as AttendeeOutputRow));
    let filtered = matches;
    if (input.user) {
      const userRef = input.user;
      filtered = matches.filter(
        (match) => match.handle === userRef || match.handle.startsWith(userRef),
      );
    } else if (input.team) {
      const team = input.team.toLowerCase();
      filtered = matches.filter((match) => match.team?.toLowerCase() === team);
    }
    return { matches: filtered, total: filtered.length };
  },
});

registerCommand({
  path: ['photos'],
  summaryKey: 'cli.commands.photos.summary',
  descriptionKey: 'cli.commands.photos.description',
  examples: ['photos', 'photos --mine', 'photos --hashtag launch'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args, mine: z.boolean().optional(), taggedMe: z.boolean().optional(), hashtag: z.string().optional() }).strict(),
  output: z.object({
    photos: z.array(z.object({ id: z.string(), caption: z.string().nullable(), createdAt: z.string(), mine: z.boolean() })),
  }),
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase
      .from('event_photos')
      .select('*')
      .eq('event_id', event.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (input.mine) query = query.eq('uploader_id', ctx.user.id);
    if (input.hashtag) query = query.ilike('caption', `%#${input.hashtag}%`);
    const { data, error } = await query;
    if (error) throw error;
    return {
      photos: (data ?? []).map((photo) => ({
        id: photo.id,
        caption: photo.caption,
        createdAt: photo.created_at,
        mine: photo.uploader_id === ctx.user.id,
      })),
    };
  },
});

registerCommand({
  path: ['channels'],
  summaryKey: 'cli.commands.channels.summary',
  descriptionKey: 'cli.commands.channels.description',
  examples: ['channels'],
  scope: 'user',
  input: z.object({ format: FormatFlag, args: Args }).strict(),
  output: z.object({
    channels: z.array(z.object({ slug: z.string(), name: z.string(), description: z.string().nullable() })),
  }),
  handler: async (_input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('channels')
      .select('slug, name, description')
      .is('archived_at', null)
      .order('name');
    if (error) throw error;
    return { channels: data ?? [] };
  },
});

interface UserSnapshotRow {
  email: string;
  role: string;
  employee_profiles: MaybeArray<{
    preferred_name: string | null;
    legal_name: string | null;
    team: string | null;
    department: string | null;
  }>;
  guest_profiles: MaybeArray<{ first_name: string; last_name: string }>;
}

interface AttendeeOutputRow {
  user_id: string;
  hobbies: string[];
  users: MaybeArray<{
    email: string;
    employee_profiles: MaybeArray<{ preferred_name: string | null; legal_name: string | null; team: string | null }>;
    guest_profiles: MaybeArray<{ first_name: string; last_name: string }>;
  }>;
}

type MaybeArray<T> = T | T[] | null | undefined;

function first<T>(value: MaybeArray<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function guestName(guest: { first_name: string; last_name: string } | null): string | null {
  if (!guest) return null;
  return `${guest.first_name} ${guest.last_name}`.trim();
}

async function getActiveEvent(ctx: CommandContext) {
  const { data, error } = await ctx.supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .eq('type', 'supafest')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(ctx.t('cli.errors.noActiveEvent'));
  return data;
}

async function getEventById(ctx: CommandContext, id: string) {
  const { data, error } = await ctx.supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(ctx.t('cli.errors.eventNotFound'));
  return data;
}

function dayToDate(startDate: string, day?: number): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function sessionOutput(session: {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  is_mandatory: boolean;
  capacity: number | null;
}) {
  return {
    id: session.id,
    title: session.title,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    location: session.location,
    mandatory: session.is_mandatory,
    capacity: session.capacity,
  };
}

function attendeeOutput(row: AttendeeOutputRow) {
  const user = first(row.users);
  const employee = first(user?.employee_profiles);
  const guest = first(user?.guest_profiles);
  const fullName = employee?.preferred_name ?? employee?.legal_name ?? guestName(guest) ?? user?.email ?? '';
  const handle = (user?.email ?? row.user_id).split('@')[0] ?? row.user_id;
  return {
    userId: row.user_id,
    handle,
    fullName,
    team: employee?.team ?? null,
    hobbies: row.hobbies,
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function roleToScope(role: CommandContext['role']): CommandScope {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'user';
}
