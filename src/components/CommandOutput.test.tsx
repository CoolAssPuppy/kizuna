import { describe, expect, it } from 'vitest';

import { CommandOutput } from './CommandOutput';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

describe('CommandOutput', () => {
  it('renders command output as JSON by default', () => {
    renderWithProviders(
      <CommandOutput
        command="me"
        durationMs={42}
        result={{ ok: true, format: 'json', data: { email: 'ada@example.com' } }}
      />,
    );

    expect(screen.getByText('$ me')).toBeInTheDocument();
    expect(screen.getByText('email:')).toBeInTheDocument();
    expect(screen.getByText('"ada@example.com"')).toBeInTheDocument();
  });
});
