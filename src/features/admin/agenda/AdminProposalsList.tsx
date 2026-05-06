import { Search, ThumbsUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { type AdminProposedSession } from '@/features/agenda/api';
import { TagPills } from '@/features/agenda/TagPill';

export type ProposalSort = 'votes' | 'proposer';

interface AdminProposalsListProps {
  proposals: ReadonlyArray<AdminProposedSession>;
  query: string;
  onQueryChange: (next: string) => void;
  sort: ProposalSort;
  onSortChange: (next: ProposalSort) => void;
  onEdit: (proposal: AdminProposedSession) => void;
}

export function AdminProposalsList({
  proposals,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onEdit,
}: AdminProposalsListProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('admin.agenda.proposalsSearchPlaceholder')}
            aria-label={t('admin.agenda.proposalsSearchLabel')}
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ProposalSort)}
          aria-label={t('admin.agenda.proposalsSortLabel')}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="votes">{t('admin.agenda.proposalsSort.votes')}</option>
          <option value="proposer">{t('admin.agenda.proposalsSort.proposer')}</option>
        </select>
      </div>
      {proposals.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('admin.agenda.proposalsEmpty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {proposals.map((p) => (
            <li key={p.id} className="space-y-2 px-4 py-3 text-sm hover:bg-muted/30">
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="flex w-full flex-col items-start gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    <ThumbsUp aria-hidden className="h-3.5 w-3.5" />
                    {t('agenda.proposals.voteCount', { count: p.vote_count })}
                  </span>
                </div>
                {p.abstract ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.abstract}</p>
                ) : null}
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('agenda.proposals.proposedBy', {
                    name: p.proposer_display_name ?? t('agenda.proposals.unknownProposer'),
                  })}
                </p>
                <TagPills tags={p.tags} className="pt-1" />
              </button>
              {p.voters.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t('admin.agenda.proposalsVoters')}:
                  </span>{' '}
                  {p.voters.map((v) => v.display_name).join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
