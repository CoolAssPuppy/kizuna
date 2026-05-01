import { useTranslation } from 'react-i18next';

interface Props {
  titleKey: string;
  subtitleKey: string;
}

/**
 * Placeholder for admin sections under active development. Renders a
 * lightweight header so the sidebar nav still works while the section
 * is being built. Replaced by the real screen when ready.
 */
export function ComingSoon({ titleKey, subtitleKey }: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h2>
        <p className="text-sm text-muted-foreground">{t(subtitleKey)}</p>
      </header>
      <div className="rounded-lg border bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">{t('admin.comingSoon')}</p>
      </div>
    </section>
  );
}
