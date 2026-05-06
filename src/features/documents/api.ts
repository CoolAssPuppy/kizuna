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
    .select('*')
    .eq('is_active', true)
    .in('applies_to', ['all', audience])
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .order('display_order', { ascending: true });

  if (documentsError) throw documentsError;
  const docList = (documents ?? []) as DocumentRow[];
  if (docList.length === 0) return [];

  const { data: acks, error: acksError } = await client
    .from('document_acknowledgements')
    .select('*')
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
 * Resolves the user's expected legal-name string for the signature
 * field. Employee `legal_name` wins, then employee `preferred_name`,
 * then guest first+last. Empty string when nothing is on file.
 */
export async function fetchSignatureFullName(
  client: AppSupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await client
    .from('users')
    .select(
      `employee_profiles ( preferred_name, legal_name ), guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )`,
    )
    .eq('id', userId)
    .maybeSingle();

  const employee = data?.employee_profiles;
  if (employee?.legal_name) return employee.legal_name.trim();
  if (employee?.preferred_name) return employee.preferred_name.trim();
  const guest = data?.guest_profiles;
  return `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim();
}

/** Loads a single document by id. Returns null when missing or RLS-hidden. */
export async function fetchDocumentById(
  client: AppSupabaseClient,
  documentId: string,
): Promise<DocumentRow | null> {
  const { data, error } = await client
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
