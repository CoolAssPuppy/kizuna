import { useTranslation } from 'react-i18next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  'en-US': '🇺🇸',
};

export function LanguagePicker(): JSX.Element {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : DEFAULT_LOCALE;

  return (
    <label className="flex items-center gap-1 text-muted-foreground">
      <span className="sr-only">{t('footer.language')}</span>
      <select
        value={current}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
        aria-label={t('footer.language')}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_FLAGS[locale]} {t(`footer.languages.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
