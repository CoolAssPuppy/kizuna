import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function HeaderBrand(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-2 text-foreground">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background"
        style={{ fontFamily: 'system-ui', fontWeight: 700, fontSize: 14 }}
      >
        絆
      </span>
      <span className="text-sm font-semibold">{t('app.name')}</span>
    </Link>
  );
}
