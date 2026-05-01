import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';

import { ConsentGate } from './ConsentGate';
import type { DocumentRow } from './types';

const baseDoc: DocumentRow = {
  id: 'd1',
  event_id: null,
  document_key: 'waiver',
  version: 1,
  title: 'Event waiver',
  body: '# waiver\n\nbody body body',
  applies_to: 'all',
  requires_acknowledgement: true,
  requires_scroll: true,
  notion_page_id: null,
  notion_synced_at: null,
  display_order: 1,
  is_active: true,
  published_at: '2026-04-30T00:00:00Z',
};

beforeEach(() => {
  // Pretend every document fits in the viewport so the initial mount sees
  // scrollHeight <= clientHeight and unlocks the checkbox without a real
  // scroll. Real scroll behaviour is covered separately in scroll.test.ts.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 200,
  });
});

describe('ConsentGate', () => {
  it('disables the agree button until the checkbox is ticked', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<ConsentGate document={baseDoc} onAcknowledge={onAcknowledge} />);

    const button = screen.getByRole('button', { name: 'I Agree and Continue' });
    expect(button).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });

  it('blocks the checkbox when the document requires scroll and bottom is not reached', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 400,
    });

    const onAcknowledge = vi.fn();
    renderWithProviders(<ConsentGate document={baseDoc} onAcknowledge={onAcknowledge} />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('Scroll to the end to continue')).toBeInTheDocument();
  });

  it('passes scrolled, explicit, and device-type signals to onAcknowledge', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
    });

    renderWithProviders(<ConsentGate document={baseDoc} onAcknowledge={onAcknowledge} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'I Agree and Continue' }));

    expect(onAcknowledge).toHaveBeenCalledWith({
      scrolledToBottom: true,
      explicitCheckbox: true,
      deviceType: 'mobile',
    });
  });

  it('shows an error message when onAcknowledge throws', async () => {
    const onAcknowledge = vi.fn().mockRejectedValue(new Error('rls_violation'));
    const user = userEvent.setup();

    renderWithProviders(<ConsentGate document={baseDoc} onAcknowledge={onAcknowledge} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'I Agree and Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not record your acknowledgement. Please try again.',
    );
  });
});
