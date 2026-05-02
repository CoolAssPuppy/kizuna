import type { AppSupabaseClient } from '@/lib/supabase';

import type { AcknowledgePayload, AcknowledgementRow, DocumentRow, DocumentWithAck } from './types';

interface FetchOptions {
  eventId: string;
  userId: string;
  audience: 'employee' | 'guest';
}

/**
 * Loads every active document that applies to the user (their audience plus
 * 'all'), joined with their latest acknowledgement on the current version.
 *
 * Two round-trips, not a JOIN, so RLS stays clean: documents are
 * authenticated-readable; document_acknowledgements is owner-readable.
 */
export async function fetchDocuments(
  client: AppSupabaseClient,
  { eventId, userId, audience }: FetchOptions,
): Promise<DocumentWithAck[]> {
  const { data: documents, error: documentsError } = await client
    .from('documents')
    .select(
      'id,event_id,document_key,version,title,content_type,body,pdf_path,applies_to,requires_acknowledgement,requires_scroll,notion_url,display_order,is_active,published_at',
    )
    .eq('is_active', true)
    .in('applies_to', ['all', audience])
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .order('display_order', { ascending: true });

  if (documentsError) throw documentsError;
  const docList = (documents ?? []) as DocumentRow[];
  if (docList.length === 0) return [];

  const { data: acks, error: acksError } = await client
    .from('document_acknowledgements')
    .select(
      'id,user_id,event_id,document_id,document_key,document_version,acknowledged_at,scrolled_to_bottom,explicit_checkbox,device_type,signature_full_name',
    )
    .eq('user_id', userId)
    .eq('event_id', eventId);

  if (acksError) throw acksError;
  const ackList = (acks ?? []) as AcknowledgementRow[];

  return docList.map((document) => {
    const acknowledgement =
      ackList.find(
        (a) => a.document_key === document.document_key && a.document_version === document.version,
      ) ?? null;

    const needsAcknowledgement = document.requires_acknowledgement && acknowledgement === null;

    return { document, acknowledgement, needsAcknowledgement };
  });
}

/**
 * Records a consent event. Idempotent on (user_id, event_id, document_key,
 * document_version) so repeated calls are safe.
 */
export async function acknowledge(
  client: AppSupabaseClient,
  payload: AcknowledgePayload,
): Promise<void> {
  const { error } = await client.from('document_acknowledgements').upsert(
    {
      user_id: payload.userId,
      event_id: payload.eventId,
      document_id: payload.documentId,
      document_key: payload.documentKey,
      document_version: payload.documentVersion,
      scrolled_to_bottom: payload.scrolledToBottom,
      explicit_checkbox: payload.explicitCheckbox,
      device_type: payload.deviceType,
    },
    { onConflict: 'user_id,event_id,document_key,document_version' },
  );

  if (error) throw error;
}
