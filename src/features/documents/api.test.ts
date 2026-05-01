import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { acknowledge, fetchDocuments } from './api';
import type { AcknowledgementRow, DocumentRow } from './types';

function makeDocumentsBuilder(documents: DocumentRow[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: documents, error: null }),
  };
  return chain;
}

function makeAcksBuilder(acks: AcknowledgementRow[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  };
  // .eq returns this, then second .eq resolves with the data
  chain.eq.mockImplementation((column: string) => {
    if (column === 'event_id') {
      return Promise.resolve({ data: acks, error: null });
    }
    return chain;
  });
  return chain;
}

function makeClient({
  documents,
  acks,
  upsertError,
}: {
  documents: DocumentRow[];
  acks: AcknowledgementRow[];
  upsertError?: { message: string } | null;
}): { client: AppSupabaseClient; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError ?? null });
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'documents') return makeDocumentsBuilder(documents);
      if (table === 'document_acknowledgements') {
        return {
          ...makeAcksBuilder(acks),
          upsert,
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as AppSupabaseClient;
  return { client, upsert };
}

const baseDoc: DocumentRow = {
  id: 'd1',
  event_id: null,
  document_key: 'waiver',
  version: 1,
  title: 'Waiver',
  content_type: 'markdown',
  body: '...',
  pdf_path: null,
  applies_to: 'all',
  requires_acknowledgement: true,
  requires_scroll: true,
  notion_page_id: null,
  notion_url: null,
  notion_synced_at: null,
  display_order: 1,
  is_active: true,
  published_at: '2026-04-30T00:00:00Z',
};

const baseAck: AcknowledgementRow = {
  id: 'a1',
  user_id: 'u1',
  event_id: 'e1',
  document_id: 'd1',
  document_key: 'waiver',
  document_version: 1,
  acknowledged_at: '2026-04-30T00:00:00Z',
  ip_address: null,
  scrolled_to_bottom: true,
  explicit_checkbox: true,
  device_type: 'desktop',
  signature_full_name: null,
};

describe('fetchDocuments', () => {
  it('returns documents with needsAcknowledgement=true when no ack exists', async () => {
    const { client } = makeClient({ documents: [baseDoc], acks: [] });

    const result = await fetchDocuments(client, {
      eventId: 'e1',
      userId: 'u1',
      audience: 'employee',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.needsAcknowledgement).toBe(true);
    expect(result[0]?.acknowledgement).toBeNull();
  });

  it('returns needsAcknowledgement=false when an ack exists for the same version', async () => {
    const { client } = makeClient({ documents: [baseDoc], acks: [baseAck] });

    const result = await fetchDocuments(client, {
      eventId: 'e1',
      userId: 'u1',
      audience: 'employee',
    });

    expect(result[0]?.needsAcknowledgement).toBe(false);
    expect(result[0]?.acknowledgement?.id).toBe('a1');
  });

  it('returns needsAcknowledgement=true when the doc version has bumped past the latest ack', async () => {
    const v2: DocumentRow = { ...baseDoc, version: 2 };
    const { client } = makeClient({ documents: [v2], acks: [baseAck] });

    const result = await fetchDocuments(client, {
      eventId: 'e1',
      userId: 'u1',
      audience: 'employee',
    });

    expect(result[0]?.needsAcknowledgement).toBe(true);
    expect(result[0]?.acknowledgement).toBeNull();
  });

  it('returns needsAcknowledgement=false for documents that do not require ack', async () => {
    const informational: DocumentRow = { ...baseDoc, requires_acknowledgement: false };
    const { client } = makeClient({ documents: [informational], acks: [] });

    const result = await fetchDocuments(client, {
      eventId: 'e1',
      userId: 'u1',
      audience: 'employee',
    });

    expect(result[0]?.needsAcknowledgement).toBe(false);
  });
});

describe('acknowledge', () => {
  it('upserts a row keyed on (user, event, document_key, version)', async () => {
    const { client, upsert } = makeClient({ documents: [baseDoc], acks: [] });

    await acknowledge(client, {
      userId: 'u1',
      eventId: 'e1',
      documentId: 'd1',
      documentKey: 'waiver',
      documentVersion: 1,
      scrolledToBottom: true,
      explicitCheckbox: true,
      deviceType: 'mobile',
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        event_id: 'e1',
        document_key: 'waiver',
        document_version: 1,
        scrolled_to_bottom: true,
        explicit_checkbox: true,
        device_type: 'mobile',
      }),
      expect.objectContaining({
        onConflict: 'user_id,event_id,document_key,document_version',
      }),
    );
  });

  it('throws when the upsert fails', async () => {
    const { client } = makeClient({
      documents: [baseDoc],
      acks: [],
      upsertError: { message: 'rls_violation' },
    });

    await expect(
      acknowledge(client, {
        userId: 'u1',
        eventId: 'e1',
        documentId: 'd1',
        documentKey: 'waiver',
        documentVersion: 1,
        scrolledToBottom: true,
        explicitCheckbox: true,
        deviceType: 'mobile',
      }),
    ).rejects.toMatchObject({ message: 'rls_violation' });
  });
});
