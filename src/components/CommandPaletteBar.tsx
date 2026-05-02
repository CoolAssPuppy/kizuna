import { useTranslation } from 'react-i18next';

/**
 * Cosmetic command-palette footer strip. Renders an inert text input with
 * a blinking caret. v1 surface only — the actual palette opens elsewhere
 * (or not at all) until the Cmd-K experience ships.
 */
export function CommandPaletteBar(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-2 border px-4 py-3"
      style={{
        backgroundColor: 'var(--c-surface-soft)',
        borderColor: 'var(--c-rule)',
      }}
    >
      <span style={{ color: 'var(--c-accent)' }}>$</span>
      <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
        {t('terminal.palettePlaceholder')}
      </span>
      <span className="ml-auto terminal-cursor" />
    </div>
  );
}
