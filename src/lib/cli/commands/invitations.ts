// Invitations CLI commands. Mirror the in-app InvitationsScreen surface:
// list, add (single email + name), remove. Bulk paste / CSV import are
// admin-app surfaces — the CLI stays one-row-per-call so scripts can
// pipeline them with their own batching.
//
// Reads honour RLS. Writes are admin-only; the policy on
// public.event_invitations enforces this regardless of which client is
// calling.

import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag, IdRef } from './_schemas.ts';
import { getActiveEvent } from './_shared.ts';

const Email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'email must be a valid address');

const InvitationItem = z.object({
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  invited_by: z.string().nullable(),
  created_at: z.string(),
});

const InvitationsListInput = z.object({ format: FormatFlag, args: Args }).strict();
const InvitationsListOutput = z.object({
  event_id: z.string(),
  invitations: z.array(InvitationItem),
});

interface InvitationRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_by: string | null;
  created_at: string;
}

registerCommand({
  path: ['invitations', 'list'],
  summaryKey: 'cli.commands.invitationsList.summary',
  descriptionKey: 'cli.commands.invitationsList.description',
  examples: ['invitations list', 'invitations list --format md'],
  scope: 'admin',
  input: InvitationsListInput,
  output: InvitationsListOutput,
  handler: async (_input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('event_invitations')
      .select('email, first_name, last_name, invited_by, created_at')
      .eq('event_id', event.id)
      .order('email', { ascending: true });
    if (error) throw error;
    return {
      event_id: event.id,
      invitations: ((data ?? []) as InvitationRow[]).map((row) => ({ ...row })),
    };
  },
  toMarkdown: (output) =>
    output.invitations.length === 0
      ? '_No invitations._'
      : output.invitations
          .map((row) => {
            const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
            return `- **${row.email}**${name ? ` — ${name}` : ''}`;
          })
          .join('\n'),
});

const InvitationsAddInput = z
  .object({
    format: FormatFlag,
    args: Args,
    email: Email,
    'first-name': z.string().min(1),
    'last-name': z.string().min(1),
  })
  .strict();

const InvitationsAddOutput = InvitationItem;

registerCommand({
  path: ['invitations', 'add'],
  summaryKey: 'cli.commands.invitationsAdd.summary',
  descriptionKey: 'cli.commands.invitationsAdd.description',
  examples: ['invitations add --email taylor@supabase.io --first-name Taylor --last-name Reed'],
  scope: 'admin',
  mutation: true,
  input: InvitationsAddInput,
  output: InvitationsAddOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('event_invitations')
      .insert({
        event_id: event.id,
        email: input.email,
        first_name: input['first-name'],
        last_name: input['last-name'],
        invited_by: ctx.user.id,
      })
      .select('email, first_name, last_name, invited_by, created_at')
      .single();
    if (error) throw error;
    return data;
  },
  toMarkdown: (output) => `Invited **${output.email}**.`,
});

const InvitationsRemoveInput = z
  .object({
    format: FormatFlag,
    args: Args,
    email: Email.optional(),
    id: IdRef,
  })
  .strict();

const InvitationsRemoveOutput = z.object({ email: z.string(), deleted: z.literal(true) });

registerCommand({
  path: ['invitations', 'remove'],
  summaryKey: 'cli.commands.invitationsRemove.summary',
  descriptionKey: 'cli.commands.invitationsRemove.description',
  examples: [
    'invitations remove --email taylor@supabase.io',
    'invitations remove taylor@supabase.io',
  ],
  scope: 'admin',
  mutation: true,
  input: InvitationsRemoveInput,
  output: InvitationsRemoveOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    const target =
      input.email ??
      (typeof input.args?.[0] === 'string' ? input.args[0].toLowerCase() : undefined);
    if (!target) throw new Error(ctx.t('cli.errors.idRequired'));
    const { error } = await ctx.supabase
      .from('event_invitations')
      .delete()
      .eq('event_id', event.id)
      .eq('email', target);
    if (error) throw error;
    return { email: target, deleted: true };
  },
  toMarkdown: (output) => `Removed invitation for ${output.email}.`,
});
