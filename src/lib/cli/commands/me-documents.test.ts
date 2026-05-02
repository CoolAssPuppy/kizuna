import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { ACTIVE_EVENT_ROW, createCtx, createMockSupabase } from './_testHelpers';

import './me-documents';

describe('me documents', () => {
  it('returns documents with their signed flag derived from acks', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        documents: [
          { id: 'd1', title: 'Code of conduct', version: 1, document_key: 'coc' },
          { id: 'd2', title: 'Photo waiver', version: 2, document_key: 'photo' },
        ],
        document_acknowledgements: [{ document_key: 'coc', document_version: 1 }],
      },
    });
    const cmd = getCommand(['me', 'documents'])!;
    const out = (await cmd.handler({}, createCtx({ supabase }))) as {
      documents: Array<{ title: string; signed: boolean }>;
    };
    expect(out.documents).toEqual([
      { id: 'd1', title: 'Code of conduct', version: 1, signed: true },
      { id: 'd2', title: 'Photo waiver', version: 2, signed: false },
    ]);
  });

  it('filters to unsigned only when the flag is set', async () => {
    const supabase = createMockSupabase({
      tables: {
        events: [ACTIVE_EVENT_ROW],
        documents: [
          { id: 'd1', title: 'Code of conduct', version: 1, document_key: 'coc' },
          { id: 'd2', title: 'Photo waiver', version: 2, document_key: 'photo' },
        ],
        document_acknowledgements: [{ document_key: 'coc', document_version: 1 }],
      },
    });
    const cmd = getCommand(['me', 'documents'])!;
    const out = (await cmd.handler({ unsigned: true }, createCtx({ supabase }))) as {
      documents: Array<{ id: string }>;
    };
    expect(out.documents.map((d) => d.id)).toEqual(['d2']);
  });
});
