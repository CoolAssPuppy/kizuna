import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';

import { type AgendaSession } from '../api';
import { SessionCard } from './SessionCard';

function getMockSession(overrides?: Partial<AgendaSession>): AgendaSession {
  // The component reads only a small subset of fields; the cast lets
  // the factory stay tight without redeclaring the entire generated
  // SessionRow shape.
  return {
    id: 's-1',
    title: 'Realtime debugging deep-dive',
    subtitle: null,
    type: 'breakout',
    audience: 'all',
    status: 'active',
    starts_at: '2027-01-10T16:00:00Z',
    ends_at: '2027-01-10T17:00:00Z',
    location: 'Room A',
    capacity: null,
    is_mandatory: false,
    abstract: null,
    speaker_email: null,
    speaker_display_name: null,
    is_favorite: false,
    tags: [],
    ...overrides,
  } as unknown as AgendaSession;
}

describe('SessionCard', () => {
  it('renders the title, time range, and location', () => {
    renderWithProviders(
      <ul>
        <SessionCard
          session={getMockSession()}
          timeZone="UTC"
          isPast={false}
          onToggleFavorite={vi.fn()}
          favoriteLabel="Favorite"
        />
      </ul>,
    );
    expect(screen.getByText('Realtime debugging deep-dive')).toBeInTheDocument();
    expect(screen.getByText(/Room A/)).toBeInTheDocument();
  });

  it('triggers onToggleFavorite on the star button', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <ul>
        <SessionCard
          session={getMockSession()}
          timeZone="UTC"
          isPast={false}
          onToggleFavorite={onToggle}
          favoriteLabel="Favorite"
        />
      </ul>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('disables the favorite toggle on mandatory sessions', () => {
    renderWithProviders(
      <ul>
        <SessionCard
          session={getMockSession({ is_mandatory: true })}
          timeZone="UTC"
          isPast={false}
          onToggleFavorite={vi.fn()}
          favoriteLabel="Favorite"
        />
      </ul>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders the guest picker only when guestPicker is provided', () => {
    const { rerender } = renderWithProviders(
      <ul>
        <SessionCard
          session={getMockSession()}
          timeZone="UTC"
          isPast={false}
          onToggleFavorite={vi.fn()}
          favoriteLabel="Favorite"
        />
      </ul>,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    rerender(
      <ul>
        <SessionCard
          session={getMockSession()}
          timeZone="UTC"
          isPast={false}
          onToggleFavorite={vi.fn()}
          favoriteLabel="Favorite"
          guestPicker={{
            guests: [
              {
                id: 'g-1',
                first_name: 'Avery',
                last_name: 'Reed',
              } as never,
            ],
            attendance: new Set<string>(),
            onToggle: vi.fn(),
          }}
        />
      </ul>,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/Avery Reed/)).toBeInTheDocument();
  });
});
