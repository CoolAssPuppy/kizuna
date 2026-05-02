import { describe, expect, it } from 'vitest';

import { getCommand } from '../registry';
import { createCtx, createMockSupabase } from './_testHelpers';

import './me';

describe('me', () => {
  it('flattens the joined employee profile', async () => {
    const supabase = createMockSupabase({
      tables: {
        users: [
          {
            id: 'u-1',
            email: 'alice@example.com',
            role: 'employee',
            employee_profiles: [
              {
                preferred_name: 'Alice',
                legal_name: 'Alice Anderson',
                team: 'Platform',
                department: 'Engineering',
              },
            ],
            guest_profiles: [],
          },
        ],
      },
    });
    const cmd = getCommand(['me'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(out).toEqual({
      userId: 'u-1',
      email: 'alice@example.com',
      role: 'employee',
      displayName: 'Alice',
      team: 'Platform',
      department: 'Engineering',
    });
  });

  it('falls back to the guest name when no employee profile exists', async () => {
    const supabase = createMockSupabase({
      tables: {
        users: [
          {
            email: 'guest@example.com',
            role: 'guest',
            employee_profiles: [],
            guest_profiles: [{ first_name: 'Bob', last_name: 'Brown' }],
          },
        ],
      },
    });
    const cmd = getCommand(['me'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    expect(out).toMatchObject({ displayName: 'Bob Brown', team: null });
  });

  it('renders Markdown using toMarkdown', async () => {
    const supabase = createMockSupabase({
      tables: {
        users: [{ email: 'a@b.com', role: 'employee', employee_profiles: [], guest_profiles: [] }],
      },
    });
    const cmd = getCommand(['me'])!;
    const out = await cmd.handler({}, createCtx({ supabase }));
    const md = cmd.toMarkdown!(out, createCtx());
    expect(md).toContain('a@b.com');
  });
});
