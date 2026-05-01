import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/toast';
import i18n from '@/lib/i18n';

import { useSectionSubmit } from './useSectionSubmit';

// Every Save click in the app must surface a toast. This test pins the
// contract — without it a regression in useSectionSubmit (silent catch,
// missing show() in the success path, etc.) would let real-prod saves
// disappear into a void, which is exactly what users hit on 2026-05-01.
//
// We render a minimal harness that exposes the hook's submit() through a
// button so userEvent.click drives the same code path the Sections do.

interface HarnessProps {
  save: () => Promise<void>;
}

function Harness({ save }: HarnessProps): JSX.Element {
  const { submit } = useSectionSubmit({
    mode: { kind: 'profile' },
    taskKey: null,
    toastSuccessKey: 'profile.toast.personalInfoSaved',
  });
  return (
    <button type="button" onClick={() => void submit(save)}>
      Save
    </button>
  );
}

function renderHarness(save: () => Promise<void>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <Harness save={save} />
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('useSectionSubmit', () => {
  it('shows the success toast in profile mode after save resolves', async () => {
    const save = vi.fn(() => Promise.resolve());
    renderHarness(save);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Personal info saved.')).toBeInTheDocument();
  });

  it('shows the error toast in profile mode when save rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const save = vi.fn(() => Promise.reject(new Error('boom')));
    renderHarness(save);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
