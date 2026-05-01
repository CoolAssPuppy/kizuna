import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { createChannel, listChannelsWithLastMessage } from './channels';

interface ChannelRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_system: boolean;
  archived_at: string | null;
}

interface MessageRow {
  channel: string;
  body: string;
  sent_at: string;
}

function makeClient(channels: ChannelRow[], messages: MessageRow[] = []): AppSupabaseClient {
  const channelsBuilder = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: channels, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: channels[0] ?? null, error: null }),
  };
  const messagesBuilder = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: messages, error: null }),
  };
  return {
    from: vi.fn((table: string) => (table === 'channels' ? channelsBuilder : messagesBuilder)),
  } as unknown as AppSupabaseClient;
}

describe('listChannelsWithLastMessage', () => {
  it('attaches the most recent message body and timestamp per channel', async () => {
    const client = makeClient(
      [
        {
          id: 'c1',
          slug: 'general',
          name: 'General',
          description: null,
          created_by: null,
          is_system: true,
          archived_at: null,
        },
        {
          id: 'c2',
          slug: 'ski-snowboard',
          name: 'Ski + snowboard',
          description: null,
          created_by: 'u',
          is_system: false,
          archived_at: null,
        },
      ],
      [
        { channel: 'general', body: 'hello', sent_at: '2027-01-12T10:00:00Z' },
        { channel: 'general', body: 'older', sent_at: '2027-01-12T09:00:00Z' },
        { channel: 'ski-snowboard', body: 'powder day', sent_at: '2027-01-12T11:00:00Z' },
      ],
    );

    const out = await listChannelsWithLastMessage(client);

    expect(out).toHaveLength(2);
    const general = out.find((c) => c.slug === 'general')!;
    expect(general.last_message_body).toBe('hello');
    const ski = out.find((c) => c.slug === 'ski-snowboard')!;
    expect(ski.last_message_body).toBe('powder day');
  });

  it('returns an empty array if no channels exist (skips message lookup)', async () => {
    const client = makeClient([]);
    expect(await listChannelsWithLastMessage(client)).toEqual([]);
  });
});

describe('createChannel', () => {
  it('rejects names that produce an empty slug', async () => {
    const client = makeClient([]);
    await expect(createChannel(client, 'u', { name: '!!!', description: null })).rejects.toThrow(
      /empty slug/i,
    );
  });

  it('inserts a slug derived from the name', async () => {
    const created: ChannelRow = {
      id: 'c-new',
      slug: 'photo-walk',
      name: 'Photo Walk',
      description: null,
      created_by: 'u',
      is_system: false,
      archived_at: null,
    };
    const client = makeClient([created]);
    const out = await createChannel(client, 'u', { name: 'Photo Walk', description: null });
    expect(out.slug).toBe('photo-walk');
  });
});
