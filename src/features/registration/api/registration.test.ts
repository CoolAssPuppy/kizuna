import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { ensureRegistration, markTaskComplete } from './registration';

interface ExistingRegistration {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  completion_pct: number;
}

function makeClient(opts: {
  existingRegistration: ExistingRegistration | null;
  insertedRegistration?: ExistingRegistration;
  tasks: Array<{ task_key: string }>;
  insertedTasks?: ReturnType<typeof vi.fn>;
}): AppSupabaseClient {
  let registrationsCalls = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === 'registrations') {
        registrationsCalls += 1;
        if (registrationsCalls === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.existingRegistration,
              error: null,
            }),
          };
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.insertedRegistration,
            error: null,
          }),
        };
      }
      if (table === 'registration_tasks') {
        return {
          insert: opts.insertedTasks ?? vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: opts.tasks, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as AppSupabaseClient;
}

describe('ensureRegistration', () => {
  it('returns the existing registration with its tasks when one already exists', async () => {
    const existing: ExistingRegistration = {
      id: 'r-1',
      user_id: 'u',
      event_id: 'e',
      status: 'started',
      completion_pct: 25,
    };
    const tasks = [{ task_key: 'personal_info' }, { task_key: 'passport' }];
    const client = makeClient({ existingRegistration: existing, tasks });

    const out = await ensureRegistration(client, { userId: 'u', eventId: 'e' });
    expect(out.registration.id).toBe('r-1');
    expect(out.tasks).toHaveLength(2);
  });

  it('creates a registration and seeds the default task list when none exists', async () => {
    const inserted: ExistingRegistration = {
      id: 'r-new',
      user_id: 'u',
      event_id: 'e',
      status: 'started',
      completion_pct: 0,
    };
    const insertedTasksSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = makeClient({
      existingRegistration: null,
      insertedRegistration: inserted,
      tasks: [],
      insertedTasks: insertedTasksSpy,
    });

    const out = await ensureRegistration(client, { userId: 'u', eventId: 'e' });
    expect(out.registration.id).toBe('r-new');
    expect(insertedTasksSpy).toHaveBeenCalledTimes(1);
    const seededRows = insertedTasksSpy.mock.calls[0]?.[0] as Array<{ task_key: string }>;
    expect(seededRows.map((r) => r.task_key)).toContain('personal_info');
    expect(seededRows.map((r) => r.task_key)).toContain('passport');
  });
});

describe('markTaskComplete', () => {
  it('writes status=complete and a completed_at timestamp scoped to the task', async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn(() => ({
        update,
        eq: eq.mockReturnValue({ eq: eq2 }),
      })),
    } as unknown as AppSupabaseClient;
    await markTaskComplete(client, 'reg-1', 'personal_info');
    const args = update.mock.calls[0]?.[0] as { status?: string; completed_at?: string };
    expect(args.status).toBe('complete');
    expect(typeof args.completed_at).toBe('string');
  });
});
