import { Hotel } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Stub for the upcoming Room Assignment Tool. Tracked under the staffed
 * milestone for hotel block import + auto-assignment rules engine
 * (Leadership -> Suites, has-dependents -> Suites + Family, largest rooms
 * -> earliest registrations). Renders a placeholder so the sidebar entry
 * is present and the route is reserved.
 */
export function RoomAssignmentToolScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.roomAssignment.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.roomAssignment.subtitle')}</p>
      </header>
      <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/30 px-6 py-12 text-sm text-muted-foreground">
        <Hotel aria-hidden className="h-5 w-5" />
        {t('admin.roomAssignment.comingSoon')}
      </div>
    </section>
  );
}
