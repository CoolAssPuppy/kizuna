import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '@/features/auth/AuthProvider';
import i18n from '@/lib/i18n';

interface AppProvidersProps {
  children: ReactNode;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider
            ssoConfig={{
              oktaDomain: import.meta.env['VITE_OKTA_DOMAIN'],
              oktaClientId: import.meta.env['VITE_OKTA_CLIENT_ID'],
            }}
          >
            {children}
          </AuthProvider>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
