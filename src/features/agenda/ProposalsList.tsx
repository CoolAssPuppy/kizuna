import { Pencil, ThumbsUp, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { type ProposedSession } from './api';
import { TagPills } from './TagPill';

interface ProposalsListProps {
  proposals: ReadonlyArray<ProposedSession>;
  currentUserId: string | null;
  onVote: (proposal: ProposedSession) => void;
  onEdit: (proposal: ProposedSession) => void;
  onDelete: (proposal: ProposedSession) => void;
  isVoting: boolean;
}

/**
 * Public proposals view: vote button on every row, edit/delete on the
 * caller's own proposals. Empty state shows the localized prompt rather
 * than nothing — proposals only become visible to non-admins once the
 * first one lands, so the empty state doubles as the call-to-action.
 */
export function ProposalsList({
  proposals,
  currentUserId,
  onVote,
  onEdit,
  onDelete,
  isVoting,
}: ProposalsListProps): JSX.Element {
  const { t } = useTranslation();
  if (proposals.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('agenda.proposals.empty')}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {proposals.map((proposal) => {
        const isOwn = currentUserId !== null && proposal.proposed_by === currentUserId;
        return (
          <li
            key={proposal.id}
            className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-semibold">{proposal.title}</h3>
                {proposal.abstract ? (
                  <p className="pt-1 text-sm leading-relaxed text-foreground/80">
                    {proposal.abstract}
                  </p>
                ) : null}
                <p className="pt-2 text-xs text-muted-foreground">
                  {t('agenda.proposals.proposedBy', {
                    name: proposal.proposer_display_name ?? t('agenda.proposals.unknownProposer'),
                  })}
                </p>
                <TagPills tags={proposal.tags} className="pt-1" />
              </div>
              <div className="flex items-center gap-2">
                {isOwn ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(proposal)}
                      aria-label={t('agenda.proposals.editAction', { title: proposal.title })}
                    >
                      <Pencil aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDelete(proposal)}
                      aria-label={t('agenda.proposals.deleteAction', { title: proposal.title })}
                    >
                      <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant={proposal.has_voted ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-2"
                  disabled={proposal.has_voted || isVoting}
                  onClick={() => onVote(proposal)}
                  aria-label={
                    proposal.has_voted
                      ? t('agenda.proposals.alreadyVoted', { count: proposal.vote_count })
                      : t('agenda.proposals.vote')
                  }
                >
                  <ThumbsUp aria-hidden className="h-4 w-4" />
                  {proposal.has_voted
                    ? t('agenda.proposals.voteCount', { count: proposal.vote_count })
                    : t('agenda.proposals.vote')}
                  {!proposal.has_voted && proposal.vote_count > 0 ? (
                    <span className="text-xs text-muted-foreground">({proposal.vote_count})</span>
                  ) : null}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
