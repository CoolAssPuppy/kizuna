import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeContext';

/**
 * "Built on Supabase" wordmark for the footer. Swaps the asset based on
 * the active theme so the green logotype always lands on a contrasting
 * surface. Light + barbie themes use the dark-on-light wordmark; dark
 * theme uses the light-on-dark wordmark.
 */
export function SupabaseWordmark(): JSX.Element {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const src =
    theme === 'dark' ? '/supabase-logo-wordmark-dark.svg' : '/supabase-logo-wordmark-light.svg';
  return (
    <a
      href="https://supabase.com"
      target="_blank"
      rel="noreferrer"
      aria-label={t('footer.poweredBy')}
      className="inline-flex items-center opacity-70 transition-opacity hover:opacity-100"
    >
      <img src={src} alt={t('footer.poweredBy')} className="h-5 w-auto" />
    </a>
  );
}
