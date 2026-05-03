import { z } from 'zod';

import { registerCommand } from '../registry.ts';
import { Args, FormatFlag } from './_schemas.ts';
import { getActiveEvent } from './_shared.ts';

export const MeDocumentsInput = z
  .object({ format: FormatFlag, args: Args, unsigned: z.boolean().optional() })
  .strict();

export const DocumentSummary = z.object({
  id: z.string(),
  title: z.string(),
  version: z.number(),
  signed: z.boolean(),
});

export const MeDocumentsOutput = z.object({ documents: z.array(DocumentSummary) });

registerCommand({
  path: ['me', 'documents'],
  summaryKey: 'cli.commands.meDocuments.summary',
  descriptionKey: 'cli.commands.meDocuments.description',
  examples: ['me documents', 'me documents --unsigned'],
  scope: 'user',
  input: MeDocumentsInput,
  output: MeDocumentsOutput,
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
    const signed = new Set(
      (acks ?? []).map((ack) => `${ack.document_key}:${ack.document_version}`),
    );
    const rows = (documents ?? []).map((document) => ({
      id: document.id,
      title: document.title,
      version: document.version,
      signed: signed.has(`${document.document_key}:${document.version}`),
    }));
    return { documents: input.unsigned ? rows.filter((row) => !row.signed) : rows };
  },
  toMarkdown: (output) =>
    output.documents.length === 0
      ? '_No documents need your attention._'
      : output.documents
          .map((document) => {
            const href = document.signed ? '/documents' : `/documents/${document.id}/sign`;
            const mark = document.signed ? '✓' : '◯';
            return `- ${mark} [**${document.title}**](${href}) _v${document.version}_`;
          })
          .join('\n'),
});
