import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { CommonInput } from './_schemas.ts';
import { first, guestName, type MaybeArray } from './_shared.ts';

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

export const MeOutput = z.object({
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
  input: CommonInput,
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
  toMarkdown: (output) =>
    `**${output.displayName ?? output.email}**\n\n- email: ${output.email}\n- role: ${output.role}` +
    (output.team ? `\n- team: ${output.team}` : '') +
    (output.department ? `\n- department: ${output.department}` : ''),
});
