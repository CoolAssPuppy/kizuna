import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';

import { AdminProposalsList, type ProposalSort } from './AdminProposalsList';
import { type AdminProposedSession } from '@/features/agenda/api';

function getMockProposal(overrides?: Partial<AdminProposedSession>): AdminProposedSession {
  // Cast through `unknown` so the test factory only needs to declare the
  // fields the component reads. The full `AdminProposedSession` type
  // pulls in the entire generated SessionRow shape (twenty-plus fields)
  // and bloating the factory makes future schema changes painful.
  return {
    id: 'p-1',
    title: 'Realtime debugging deep-dive',
    abstract: 'Patterns for diagnosing dropped events.',
    proposer_display_name: 'Avery Lin',
    vote_count: 12,
    has_voted: false,
    voters: [],
    tags: [],
    ...overrides,
  } as unknown as AdminProposedSession;
}

describe('AdminProposalsList', () => {
  it('renders the empty-state copy when there are no proposals', () => {
    renderWithProviders(
      <AdminProposalsList
        proposals={[]}
        query=""
        onQueryChange={vi.fn()}
        sort="votes"
        onSortChange={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/no proposals/i)).toBeInTheDocument();
  });

  it('renders one row per proposal with the title and vote count', () => {
    const proposals = [
      getMockProposal({ id: 'a', title: 'Database migrations', vote_count: 7 }),
      getMockProposal({ id: 'b', title: 'Edge functions in production', vote_count: 22 }),
    ];
    renderWithProviders(
      <AdminProposalsList
        proposals={proposals}
        query=""
        onQueryChange={vi.fn()}
        sort="votes"
        onSortChange={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('Database migrations')).toBeInTheDocument();
    expect(screen.getByText('Edge functions in production')).toBeInTheDocument();
  });

  it('forwards each keystroke to onQueryChange', async () => {
    const onQueryChange = vi.fn();
    renderWithProviders(
      <AdminProposalsList
        proposals={[]}
        query=""
        onQueryChange={onQueryChange}
        sort="votes"
        onSortChange={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    // The component is controlled — each keystroke fires onQueryChange
    // with the new character. The owning screen accumulates the value.
    const search = screen.getByRole('textbox');
    await userEvent.type(search, 'cdn');
    expect(onQueryChange).toHaveBeenCalledTimes(3);
    expect(onQueryChange).toHaveBeenNthCalledWith(1, 'c');
    expect(onQueryChange).toHaveBeenNthCalledWith(2, 'd');
    expect(onQueryChange).toHaveBeenNthCalledWith(3, 'n');
  });

  it('forwards sort changes to onSortChange', async () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      <AdminProposalsList
        proposals={[]}
        query=""
        onQueryChange={vi.fn()}
        sort="votes"
        onSortChange={onSortChange}
        onEdit={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'proposer');
    expect(onSortChange).toHaveBeenCalledWith<[ProposalSort]>('proposer');
  });

  it('triggers onEdit when a proposal row is clicked', async () => {
    const onEdit = vi.fn();
    const proposal = getMockProposal({ id: 'edit-me', title: 'Click me' });
    renderWithProviders(
      <AdminProposalsList
        proposals={[proposal]}
        query=""
        onQueryChange={vi.fn()}
        sort="votes"
        onSortChange={vi.fn()}
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByText('Click me'));
    expect(onEdit).toHaveBeenCalledWith(proposal);
  });
});
