import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { __resetSupabaseClientForTests } from '@/lib/supabase';
import type { AppSupabaseClient } from '@/lib/supabase';

import { WelcomeScreen } from './WelcomeScreen';

function makeFakeClient(opts?: { authedUser?: { id: string; email: string } }): AppSupabaseClient {
  const session = opts?.authedUser
    ? { user: { id: opts.authedUser.id, email: opts.authedUser.email } }
    : null;

  return {
    auth: {
      // onAuthStateChange must invoke the callback synchronously with the
      // INITIAL_SESSION event so the AuthProvider hydrates without waiting
      // on a real Supabase subscription.
      onAuthStateChange: vi.fn((callback: (event: string, s: typeof session) => void) => {
        callback('INITIAL_SESSION', session);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithSSO: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: opts?.authedUser
          ? {
              id: opts.authedUser.id,
              email: opts.authedUser.email,
              role: 'employee',
              is_active: true,
              is_leadership: false,
            }
          : null,
        error: null,
      }),
    }),
  } as unknown as AppSupabaseClient;
}

describe('WelcomeScreen', () => {
  it('renders the app name and tagline from i18n resources', async () => {
    __resetSupabaseClientForTests(makeFakeClient());
    renderWithProviders(<WelcomeScreen />, { withAuth: true });

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Kizuna');
    expect(screen.getByText('An enduring bond')).toBeInTheDocument();
  });

  it('shows a personalised greeting when a user is present', async () => {
    __resetSupabaseClientForTests(
      makeFakeClient({ authedUser: { id: 'u1', email: 'paul@kizuna.dev' } }),
    );
    renderWithProviders(<WelcomeScreen />, { withAuth: true });

    expect(await screen.findByText(/Hi paul/i)).toBeInTheDocument();
  });
});
