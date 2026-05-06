import { useTranslation } from 'react-i18next';

export function FooterTagline(): JSX.Element {
  const { t } = useTranslation();
  return (
    <p className="text-muted-foreground md:absolute md:left-1/2 md:-translate-x-1/2">
      {t('footer.tagline')}
    </p>
  );
}
