// Session tag commands. Mirror the in-app TagsDialog: list, create,
// update (rename / recolor / reorder), and delete. Writes are admin-only;
// RLS enforces this regardless of which client is calling.

import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag, IdRef } from './_schemas.ts';
import { getActiveEvent } from './_shared.ts';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be #rrggbb');

export const TagItem = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  position: z.number(),
});

const TagsListInput = z.object({ format: FormatFlag, args: Args }).strict();
const TagsListOutput = z.object({ tags: z.array(TagItem) });

interface TagRow {
  id: string;
  name: string;
  color: string;
  position: number;
}

registerCommand({
  path: ['tags', 'list'],
  summaryKey: 'cli.commands.tagsList.summary',
  descriptionKey: 'cli.commands.tagsList.description',
  examples: ['tags list', 'tags list --format md'],
  scope: 'user',
  input: TagsListInput,
  output: TagsListOutput,
  handler: async (_input, ctx) => {
    const event = await getActiveEvent(ctx);
    const { data, error } = await ctx.supabase
      .from('session_tags')
      .select('id, name, color, position')
      .eq('event_id', event.id)
      .order('position', { ascending: true });
    if (error) throw error;
    return { tags: ((data ?? []) as TagRow[]).map((row) => ({ ...row })) };
  },
  toMarkdown: (output) =>
    output.tags.length === 0
      ? '_No tags yet._'
      : output.tags.map((tag) => `- \`${tag.color}\` **${tag.name}**`).join('\n'),
});

const TagsCreateInput = z
  .object({
    format: FormatFlag,
    args: Args,
    name: z.string().min(1),
    color: HexColor.default('#64748b'),
    position: z.number().int().min(0).optional(),
  })
  .strict();

const TagOutput = TagItem;

registerCommand({
  path: ['tags', 'create'],
  summaryKey: 'cli.commands.tagsCreate.summary',
  descriptionKey: 'cli.commands.tagsCreate.description',
  examples: [
    'tags create --name "Workshops" --color "#22d3ee"',
    'tags create --name "Hallway track"',
  ],
  scope: 'admin',
  mutation: true,
  input: TagsCreateInput,
  output: TagOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let position = input.position;
    if (position === undefined) {
      const { count, error: countErr } = await ctx.supabase
        .from('session_tags')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id);
      if (countErr) throw countErr;
      position = count ?? 0;
    }
    const { data, error } = await ctx.supabase
      .from('session_tags')
      .insert({
        event_id: event.id,
        name: input.name,
        color: input.color,
        position,
      })
      .select('id, name, color, position')
      .single();
    if (error) throw error;
    return data;
  },
  toMarkdown: (output) => `Added tag **${output.name}** (${output.color}).`,
});

const TagsUpdateInput = z
  .object({
    format: FormatFlag,
    args: Args,
    id: IdRef,
    name: z.string().min(1).optional(),
    color: HexColor.optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined || value.color !== undefined || value.position !== undefined,
    { message: 'one of --name, --color, or --position is required' },
  );

registerCommand({
  path: ['tags', 'update'],
  summaryKey: 'cli.commands.tagsUpdate.summary',
  descriptionKey: 'cli.commands.tagsUpdate.description',
  examples: [
    'tags update :tagId --name "Speakers"',
    'tags update :tagId --color "#f97316"',
    'tags update :tagId --position 0',
  ],
  scope: 'admin',
  mutation: true,
  input: TagsUpdateInput,
  output: TagOutput,
  handler: async (input, ctx) => {
    const tagId = input.id ?? input.args?.[0];
    if (!tagId) throw new Error(ctx.t('cli.errors.idRequired'));
    const patch: { name?: string; color?: string; position?: number } = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.position !== undefined) patch.position = input.position;
    const { data, error } = await ctx.supabase
      .from('session_tags')
      .update(patch)
      .eq('id', tagId)
      .select('id, name, color, position')
      .single();
    if (error) throw error;
    return data;
  },
  toMarkdown: (output) => `Updated tag **${output.name}** (${output.color}).`,
});

const TagsDeleteInput = z
  .object({
    format: FormatFlag,
    args: Args,
    id: IdRef,
  })
  .strict();

const TagsDeleteOutput = z.object({ id: z.string(), deleted: z.literal(true) });

registerCommand({
  path: ['tags', 'delete'],
  summaryKey: 'cli.commands.tagsDelete.summary',
  descriptionKey: 'cli.commands.tagsDelete.description',
  examples: ['tags delete :tagId'],
  scope: 'admin',
  mutation: true,
  input: TagsDeleteInput,
  output: TagsDeleteOutput,
  handler: async (input, ctx) => {
    const tagId = input.id ?? input.args?.[0];
    if (!tagId) throw new Error(ctx.t('cli.errors.idRequired'));
    const { error } = await ctx.supabase.from('session_tags').delete().eq('id', tagId);
    if (error) throw error;
    return { id: tagId, deleted: true };
  },
  toMarkdown: (output) => `Deleted tag ${output.id}.`,
});
