import type { AppSupabaseClient } from '@/lib/supabase';

import type { DocumentRow } from './types';

interface CreateDocumentArgs {
  eventId: string | null;
  documentKey: DocumentRow['document_key'];
  title: string;
  body: string;
  requiresAcknowledgement: boolean;
}

export async function createDocument(
  client: AppSupabaseClient,
  args: CreateDocumentArgs,
): Promise<DocumentRow> {
  const { data, error } = await client
    .from('documents')
    .insert({
      event_id: args.eventId,
      document_key: args.documentKey,
      version: 1,
      title: args.title,
      body: args.body,
      applies_to: 'all',
      requires_acknowledgement: args.requiresAcknowledgement,
      requires_scroll: args.requiresAcknowledgement,
      display_order: 100,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

interface SignDocumentArgs {
  userId: string;
  eventId: string;
  document: Pick<DocumentRow, 'id' | 'document_key' | 'version'>;
  fullName: string;
  scrolledToBottom: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export async function signDocument(
  client: AppSupabaseClient,
  args: SignDocumentArgs,
): Promise<void> {
  const { error } = await client.from('document_acknowledgements').upsert(
    {
      user_id: args.userId,
      event_id: args.eventId,
      document_id: args.document.id,
      document_key: args.document.document_key,
      document_version: args.document.version,
      scrolled_to_bottom: args.scrolledToBottom,
      explicit_checkbox: true,
      device_type: args.deviceType,
      signature_full_name: args.fullName,
    },
    { onConflict: 'user_id,event_id,document_key,document_version' },
  );
  if (error) throw error;
}
