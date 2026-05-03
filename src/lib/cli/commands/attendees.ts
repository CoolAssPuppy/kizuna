import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, DateFlag, FormatFlag, UserRef } from './_schemas.ts';
import { first, guestName, type MaybeArray } from './_shared.ts';

interface AttendeeRow {
  user_id: string;
  hobbies: string[] | null;
  users: MaybeArray<{
    email: string;
    employee_profiles: MaybeArray<{
      preferred_name: string | null;
      legal_name: string | null;
      team: string | null;
    }>;
    guest_profiles: MaybeArray<{ first_name: string; last_name: string }>;
  }>;
}

export const AttendeeMatch = z.object({
  userId: z.string(),
  handle: z.string(),
  fullName: z.string(),
  team: z.string().nullable(),
  hobbies: z.array(z.string()),
});

export const AttendeesInput = z
  .object({
    format: FormatFlag,
    args: Args,
    user: UserRef,
    hobby: z.string().optional(),
    dietary: z.string().optional(),
    team: z.string().optional(),
    arriving: DateFlag,
    limit: z.number().int().positive().max(500).optional(),
  })
  .strict();

export const AttendeesOutput = z.object({
  matches: z.array(AttendeeMatch),
  total: z.number(),
});

function rowToMatch(row: AttendeeRow): z.infer<typeof AttendeeMatch> {
  const user = first(row.users);
  const employee = first(user?.employee_profiles);
  const guest = first(user?.guest_profiles);
  const fullName =
    employee?.preferred_name ?? employee?.legal_name ?? guestName(guest) ?? user?.email ?? '';
  const handle = (user?.email ?? row.user_id).split('@')[0] ?? row.user_id;
  return {
    userId: row.user_id,
    handle,
    fullName,
    team: employee?.team ?? null,
    hobbies: row.hobbies ?? [],
  };
}

registerCommand({
  path: ['attendees'],
  summaryKey: 'cli.commands.attendees.summary',
  descriptionKey: 'cli.commands.attendees.description',
  examples: [
    'attendees',
    'attendees --hobby snowboarding',
    'attendees @alice',
    'attendees --team platform',
  ],
  scope: 'user',
  input: AttendeesInput,
  output: AttendeesOutput,
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from('attendee_profiles')
      .select(
        'user_id, hobbies, users!attendee_profiles_user_id_fkey ( email, employee_profiles ( preferred_name, legal_name, team ), guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name ) )',
      )
      .neq('visibility', 'private')
      .limit(input.limit ?? 50);
    if (input.hobby) query = query.contains('hobbies', [input.hobby]);
    const { data, error } = await query;
    if (error) throw error;

    const matches = ((data ?? []) as AttendeeRow[]).map(rowToMatch);
    let filtered = matches;
    if (input.user) {
      const userRef = input.user.toLowerCase();
      filtered = matches.filter(
        (match) =>
          match.handle.toLowerCase() === userRef || match.handle.toLowerCase().startsWith(userRef),
      );
    } else if (input.team) {
      const team = input.team.toLowerCase();
      filtered = matches.filter((match) => match.team?.toLowerCase() === team);
    }
    return { matches: filtered, total: filtered.length };
  },
  toMarkdown: (output) =>
    output.matches.length === 0
      ? '_No attendees match._'
      : output.matches
          .map((match) => {
            const meta = [match.team, match.hobbies.join(', ')]
              .filter((part) => part && part.length > 0)
              .join(' · ');
            const link = `[**@${match.handle}**](/community/p/${match.userId})`;
            return `- ${link} ${match.fullName}${meta ? ` _(${meta})_` : ''}`;
          })
          .join('\n'),
});
