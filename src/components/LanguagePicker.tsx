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
    <div role="radiogroup" aria-label={t('footer.language')} className="flex items-center gap-1">
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
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-base leading-none transition-colors',
              'hover:bg-accent',
              active && 'border-input bg-accent',
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
