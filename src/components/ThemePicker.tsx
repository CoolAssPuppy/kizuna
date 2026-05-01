import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeContext';
import { isThemeId, SUPPORTED_THEMES } from '@/lib/theme';

export function ThemePicker(): JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
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
  );
}
