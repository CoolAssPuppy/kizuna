import type { Database } from '@/types/database.types';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type AcknowledgementRow = Database['public']['Tables']['document_acknowledgements']['Row'];

export type DocumentKey = DocumentRow['document_key'];

export interface DocumentWithAck {
  document: DocumentRow;
  /** Latest acknowledgement on this exact document version, if any. */
  acknowledgement: AcknowledgementRow | null;
  /** True when the document requires acknowledgement and the current user hasn't done it. */
  needsAcknowledgement: boolean;
}

export interface AcknowledgePayload {
  documentId: string;
  documentKey: string;
  documentVersion: number;
  eventId: string;
  userId: string;
  scrolledToBottom: boolean;
  explicitCheckbox: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}
