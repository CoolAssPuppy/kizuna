import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  'en-US': '🇺🇸',
};

export function LanguagePicker(): JSX.Element {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : SUPPORTED_LOCALES[0];

  return (
    <div
      role="radiogroup"
      aria-label={t('footer.language')}
      className="inline-flex items-center rounded-full border bg-muted/40 p-0.5"
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => void i18n.changeLanguage(locale)}
            className={cn(
              'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm leading-none transition-all',
              'hover:bg-background/60',
              active && 'bg-background shadow-sm ring-1 ring-border',
            )}
            title={t(`footer.languages.${locale}`)}
            aria-label={t(`footer.languages.${locale}`)}
          >
            <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
          </button>
        );
      })}
    </div>
  );
}
