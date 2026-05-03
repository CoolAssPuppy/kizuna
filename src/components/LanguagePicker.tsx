import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  'en-US': '🇺🇸',
  'fr-FR': '🇫🇷',
  'it-IT': '🇮🇹',
  'de-DE': '🇩🇪',
  'es-ES': '🇪🇸',
  'pt-PT': '🇵🇹',
  'pt-BR': '🇧🇷',
  'fi-FI': '🇫🇮',
};

/**
 * Hover-glide locale switcher. Mirrors ThemePicker: trigger shows the
 * active flag, hovering glides a vertical stack of every supported
 * locale upward. Click selects.
 */
export function LanguagePicker(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : SUPPORTED_LOCALES[0];

  return (
    <div
      role="radiogroup"
      aria-label={t('footer.language')}
      tabIndex={-1}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(`footer.languages.${current}`)}
        title={t(`footer.languages.${current}`)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-base leading-none shadow-sm ring-1 ring-border hover:bg-accent"
      >
        <span aria-hidden>{LOCALE_FLAGS[current]}</span>
      </button>

      {/* pb-2 buffer keeps the cursor inside the wrapper's hover tree
          on the way from trigger to panel — matches ThemePicker. */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 transform-gpu pb-2 transition-all duration-200',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <div className="flex flex-col-reverse gap-1 rounded-full border bg-background p-1 shadow-lg ring-1 ring-border">
          {SUPPORTED_LOCALES.map((locale) => {
            const active = current === locale;
            return (
              <button
                key={locale}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  void i18n.changeLanguage(locale);
                  setOpen(false);
                }}
                title={t(`footer.languages.${locale}`)}
                aria-label={t(`footer.languages.${locale}`)}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full text-base leading-none transition-all',
                  active
                    ? 'bg-primary/10 ring-2 ring-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
