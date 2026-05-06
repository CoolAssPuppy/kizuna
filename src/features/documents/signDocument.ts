import type { AppSupabaseClient } from '@/lib/supabase';

import type { DocumentRow } from './types';

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
