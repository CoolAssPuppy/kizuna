import { useTranslation } from 'react-i18next';

import { TerminalEyebrow } from '@/components/TerminalEyebrow';

import type { EditorialFeedItem } from '../useEditorialFeed';

/** Single editorial card in the home-screen sidebar. */
export function SidebarEditorialCard({ item }: { item: EditorialFeedItem }): JSX.Element {
  const { t } = useTranslation();
  return (
    <article className="border border-c-rule bg-c-surface p-5">
      <TerminalEyebrow label={t('home.terminal.feedItemLabel')} />
      <h2 className="mt-3 text-sm font-medium text-c-fg">{item.title}</h2>
      {item.subtitle ? <p className="mt-1 text-xs text-c-muted">{item.subtitle}</p> : null}
      {item.body ? <p className="mt-2 text-xs leading-relaxed text-c-muted">{item.body}</p> : null}
    </article>
  );
}
