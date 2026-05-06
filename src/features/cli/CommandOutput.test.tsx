import { describe, expect, it } from 'vitest';

import { CommandOutput } from './CommandOutput';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

describe('CommandOutput', () => {
  it('renders the formatted markdown body for a successful command', () => {
    renderWithProviders(
      <CommandOutput
        command="me"
        durationMs={42}
        result={{
          ok: true,
          format: 'md',
          data: { email: 'ada@example.com' },
          markdown: '**Ada Lovelace**\n\n- email: ada@example.com',
        }}
      />,
    );

    expect(screen.getByText('$ me')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ada@example.com' })).toBeInTheDocument();
  });

  it('renders an error code and message for a failed command', () => {
    renderWithProviders(
      <CommandOutput
        command="bogus"
        durationMs={3}
        result={{ ok: false, error: { code: 'not_found', message: 'Command not found.' } }}
      />,
    );

    expect(screen.getByText('not_found: Command not found.')).toBeInTheDocument();
  });
});
