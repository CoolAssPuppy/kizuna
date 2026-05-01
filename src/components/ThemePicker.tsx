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
    <div role="radiogroup" aria-label={t('footer.theme')} className="flex items-center gap-1">
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
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
              'hover:bg-accent hover:text-foreground',
              active && 'border-input bg-accent text-foreground',
            )}
            title={t(`footer.themes.${value}`)}
            aria-label={t(`footer.themes.${value}`)}
          >
            <Icon aria-hidden className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
