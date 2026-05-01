import { useTranslation } from 'react-i18next';

import { ConflictsPanel } from './ConflictsPanel';

export function ConflictsScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('admin.conflicts.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.conflicts.subtitle')}</p>
      </header>
      <ConflictsPanel />
    </section>
  );
}
