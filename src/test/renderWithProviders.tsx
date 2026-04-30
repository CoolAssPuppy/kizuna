import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/features/auth/AuthProvider';
import i18n from '@/lib/i18n';

interface ProvidersProps {
  children: ReactNode;
  initialRoute: string;
  queryClient: QueryClient;
  withAuth: boolean;
}

function Providers({
  children,
  initialRoute,
  queryClient,
  withAuth,
}: ProvidersProps): ReactElement {
  const tree = (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter
          initialEntries={[initialRoute]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
  return tree;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  /**
   * Wrap in AuthProvider. Off by default so tests don't accidentally hit the
   * Supabase singleton; opt in when the component under test reads useAuth.
   */
  withAuth?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  { initialRoute = '/', withAuth = false, ...options }: CustomRenderOptions = {},
): RenderResult {
  // One client per test invocation. Re-renders inside the test reuse it so
  // mutation/cache behavior matches production semantics.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(ui, {
    wrapper: ({ children }) => (
      <Providers initialRoute={initialRoute} queryClient={queryClient} withAuth={withAuth}>
        {children}
      </Providers>
    ),
    ...options,
  });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
