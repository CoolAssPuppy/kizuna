import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';

import { snakeFile } from '../timeMath';
import type { EditorialFeedItem } from '../useEditorialFeed';
import type { FeedItem } from '../useHomeFeed';

const KIND_LABELS: Record<FeedItem['kind'], string> = {
  document: 'document',
  task: 'registration',
  announcement: 'announcement',
};

interface QueueProps {
  feed: ReadonlyArray<FeedItem>;
  editorial: ReadonlyArray<EditorialFeedItem>;
  count: number;
}

/**
 * The terminal-styled feed queue on the home screen. Renders editorial
 * cards first, then registration / document / announcement items, all
 * numbered [01], [02], ... in source order. The empty state renders an
 * eyebrow + a single line of muted copy.
 */
export function HomeQueue({ feed, editorial, count }: QueueProps): JSX.Element {
  const { t } = useTranslation();
  if (count === 0) {
    return (
      <div>
        <TerminalEyebrow as="h2" label={t('home.terminal.queueLabel', { count: 0 })} ruled />
        <p className="py-12 text-center text-sm text-c-muted">{t('home.feedEmpty')}</p>
      </div>
    );
  }

  let index = 0;
  return (
    <div>
      <TerminalEyebrow
        as="h2"
        label={t('home.terminal.queueLabel', { count })}
        trailing={t('home.terminal.queueSort')}
        ruled
      />
      <ol className="divide-y border-c-rule">
        {editorial.map((item) => {
          index += 1;
          return <EditorialQueueRow key={item.id} item={item} index={index} />;
        })}
        {feed.map((item) => {
          index += 1;
          return <FeedQueueRow key={item.id} item={item} index={index} />;
        })}
      </ol>
    </div>
  );
}

function FeedQueueRow({ item, index }: { item: FeedItem; index: number }): JSX.Element {
  const { t } = useTranslation();
  const created = new Date(item.createdAt);
  const dateLabel = created.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const metaLabel = item.kind === 'document' ? 'due' : item.kind === 'task' ? 'progress' : 'posted';

  const body = (
    <div className="grid grid-cols-[2rem_1fr] items-start gap-x-3 gap-y-2 border-c-rule py-5 sm:grid-cols-[3rem_8rem_1fr_8rem] sm:gap-5">
      <span className="text-[11px] text-c-dim">[{String(index).padStart(2, '0')}]</span>
      <span
        className="text-[11px] font-bold uppercase text-c-accent"
        style={{ letterSpacing: '0.12em' }}
      >
        {KIND_LABELS[item.kind]}
      </span>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
        <span className="break-words text-base font-medium text-c-fg">{snakeFile(item.title)}</span>
        <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
          {item.detail}
        </span>
      </div>
      <div className="col-span-2 flex flex-row items-baseline gap-2 text-[11px] sm:col-span-1 sm:w-32 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
        <span className="text-c-dim">{metaLabel}</span>
        <span className="text-c-fg">{dateLabel}</span>
      </div>
    </div>
  );

  return (
    <li>
      {item.href ? (
        <Link to={item.href} className="block transition-colors hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      <span className="sr-only">
        {t(`home.kinds.${item.kind}`)} — {item.detail}
      </span>
    </li>
  );
}

function EditorialQueueRow({
  item,
  index,
}: {
  item: EditorialFeedItem;
  index: number;
}): JSX.Element {
  const body = (
    <div className="grid grid-cols-[2rem_1fr] items-start gap-x-3 gap-y-2 border-c-rule py-5 sm:grid-cols-[3rem_8rem_1fr_8rem] sm:gap-5">
      <span className="text-[11px] text-c-dim">[{String(index).padStart(2, '0')}]</span>
      <span
        className="text-[11px] font-bold uppercase text-c-accent"
        style={{ letterSpacing: '0.12em' }}
      >
        feature
      </span>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
        <span className="break-words text-base font-medium text-c-fg">{item.title}</span>
        {item.subtitle ? (
          <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
            {item.subtitle}
          </span>
        ) : null}
        {item.body ? (
          <span className="break-words text-xs text-c-muted" style={{ lineHeight: 1.5 }}>
            {item.body}
          </span>
        ) : null}
      </div>
      <div className="hidden sm:block" />
    </div>
  );

  return (
    <li>
      {item.link_url ? (
        <a href={item.link_url} className="block transition-colors hover:opacity-80">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
