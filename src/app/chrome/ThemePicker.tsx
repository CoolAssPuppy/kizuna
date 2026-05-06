import { Heart, Sun, Wand2, Zap, type LucideIcon } from 'lucide-react';
import { useState, type ComponentType, type SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeContext';
import { cn } from '@/lib/utils';
import { SUPPORTED_THEMES, type ThemeId } from '@/lib/theme';

type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

const THEME_ICONS: Record<ThemeId, IconComponent> = {
  light: Sun,
  barbie: Heart,
  supa: Zap,
  hermione: Wand2,
  // Kirk: a stylised gold delta that hints at Starfleet without
  // dragging in another icon dependency. Defined inline below.
  kirk: KirkDelta,
};

function KirkDelta(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden {...props}>
      <path d="M12 3.5c.5 0 .9.3 1.1.8l6 14.4c.4.9-.5 1.8-1.4 1.4l-5.7-2.6-5.7 2.6c-.9.4-1.8-.5-1.4-1.4l6-14.4c.2-.5.6-.8 1.1-.8z" />
    </svg>
  );
}

/**
 * Hover-glide theme menu. The current theme renders as a single button;
 * hovering (or focusing) the wrapper expands the rest of the options
 * upward with a smooth height + opacity transition. Click selects.
 *
 * On touch screens the menu also opens on click and closes on outside
 * tap so non-hover users can still pick a theme.
 */
export function ThemePicker(): JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const ActiveIcon = THEME_ICONS[theme];

  return (
    <div
      role="radiogroup"
      aria-label={t('footer.theme')}
      tabIndex={-1}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      className="relative"
    >
      {/* Trigger: shows the currently-active theme icon. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(`footer.themes.${theme}`)}
        title={t(`footer.themes.${theme}`)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground shadow-sm ring-1 ring-border hover:bg-accent"
      >
        <ActiveIcon className="h-4 w-4" />
      </button>

      {/* Floating panel: glides up from above the trigger. The pb-2
          adds an 8px buffer BELOW the visible panel that's still
          inside the wrapper's hover tree, so the cursor moving from
          trigger upward stays in scope (mouseleave doesn't fire). */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 transform-gpu pb-2 transition-all duration-200',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <div className="flex flex-col-reverse gap-1 rounded-full border bg-background p-1 shadow-lg ring-1 ring-border">
          {SUPPORTED_THEMES.map((value) => {
            const Icon = THEME_ICONS[value];
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                title={t(`footer.themes.${value}`)}
                aria-label={t(`footer.themes.${value}`)}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
