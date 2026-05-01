import { Heart, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeContext';
import { cn } from '@/lib/utils';
import { SUPPORTED_THEMES, type ThemeId } from '@/lib/theme';

const THEME_ICONS: Record<ThemeId, typeof Sun> = {
  light: Sun,
  dark: Moon,
  barbie: Heart,
};

export function ThemePicker(): JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t('footer.theme')}
      className="inline-flex items-center rounded-full border bg-muted/40 p-0.5"
    >
      {SUPPORTED_THEMES.map((value) => {
        const Icon = THEME_ICONS[value];
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all',
              'hover:text-foreground',
              active &&
                'bg-background text-foreground shadow-sm ring-1 ring-border',
            )}
            title={t(`footer.themes.${value}`)}
            aria-label={t(`footer.themes.${value}`)}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
