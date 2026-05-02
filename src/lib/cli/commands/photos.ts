import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag } from './_schemas.ts';
import { getActiveEvent } from './_shared.ts';

export const PhotosInput = z
  .object({
    format: FormatFlag,
    args: Args,
    mine: z.boolean().optional(),
    taggedMe: z.boolean().optional(),
    hashtag: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
  })
  .strict();

export const PhotosOutput = z.object({
  photos: z.array(
    z.object({
      id: z.string(),
      caption: z.string().nullable(),
      createdAt: z.string(),
      mine: z.boolean(),
    }),
  ),
});

registerCommand({
  path: ['photos'],
  summaryKey: 'cli.commands.photos.summary',
  descriptionKey: 'cli.commands.photos.description',
  examples: ['photos', 'photos --mine', 'photos --hashtag launch'],
  scope: 'user',
  input: PhotosInput,
  output: PhotosOutput,
  handler: async (input, ctx) => {
    const event = await getActiveEvent(ctx);
    let query = ctx.supabase
      .from('event_photos')
      .select('*')
      .eq('event_id', event.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 50);
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
