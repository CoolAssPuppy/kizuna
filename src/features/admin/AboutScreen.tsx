import { useTranslation } from 'react-i18next';

import { useActiveEvent } from '@/features/events/useActiveEvent';

import { EventEditScreen } from './EventEditScreen';

/**
 * Admin "About" tab. Loads the currently active event and re-uses the
 * existing event-edit form so admins can tweak name, location, dates,
 * cover image, etc. without leaving the admin shell.
 */
export function AboutScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event, isLoading } = useActiveEvent();

  if (isLoading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }
  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.about.noEvent')}</p>;
  }

  return <EventEditScreen eventId={event.id} hideDelete redirectTo={() => '/admin/about'} />;
}
