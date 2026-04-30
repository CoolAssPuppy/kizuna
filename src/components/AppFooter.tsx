import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeContext';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';
import { isThemeId, SUPPORTED_THEMES } from '@/lib/theme';

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  'en-US': '🇺🇸',
};

export function AppFooter(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const currentLocale = (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : DEFAULT_LOCALE;

  return (
    <footer className="border-t bg-background">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-8 py-5 text-sm md:flex-row md:justify-center">
        <p className="text-muted-foreground md:absolute md:left-1/2 md:-translate-x-1/2">
          {t('footer.tagline')}
        </p>

        <div className="flex items-center gap-3 md:ml-auto">
          <label className="flex items-center gap-1 text-muted-foreground">
            <span className="sr-only">{t('footer.language')}</span>
            <select
              value={currentLocale}
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

          <label className="flex items-center gap-1 text-muted-foreground">
            <span className="sr-only">{t('footer.theme')}</span>
            <select
              value={theme}
              onChange={(event) => {
                if (isThemeId(event.target.value)) setTheme(event.target.value);
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
              aria-label={t('footer.theme')}
            >
              {SUPPORTED_THEMES.map((value) => (
                <option key={value} value={value}>
                  {t(`footer.themes.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}
