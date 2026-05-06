import { X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { TerminalResults } from '@/components/terminal/TerminalResults';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useTerminal, type TerminalHistoryEntry } from '@/features/cli/useTerminal';

/** Hidden below `lg` — phones use the full-screen `MobilePrompt` instead. */
export function FooterTerminal(): JSX.Element {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { inputRef, value, setValue, busy, results, onKeyDown, expanded, setExpanded } =
    useTerminal();

  useMountEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        setExpanded(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      ref={wrapperRef}
      className="relative hidden border-t lg:block"
      style={{ borderColor: 'var(--c-rule)' }}
    >
      {expanded ? (
        <ResultsPanel
          containerRef={wrapperRef}
          onDismiss={() => setExpanded(false)}
          results={results}
        />
      ) : null}
      <div
        style={{ backgroundColor: 'var(--c-surface-soft)' }}
        className="transition-colors has-[input:focus]:[background-color:var(--c-surface)]"
      >
        <label className="mx-auto flex w-full max-w-7xl cursor-text items-center gap-2 px-4 py-3 sm:px-8">
          <span style={{ color: 'var(--c-accent)' }}>$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setExpanded(true)}
            onKeyDown={onKeyDown}
            readOnly={busy}
            placeholder={t('terminal.placeholder')}
            aria-label={t('terminal.label')}
            className="terminal-input min-w-0 flex-1 bg-transparent font-mono text-xs placeholder:text-muted-foreground"
          />
          <span className="terminal-cursor" />
        </label>
      </div>
    </div>
  );
}

interface ResultsPanelProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onDismiss: () => void;
  results: TerminalHistoryEntry[];
}

function ResultsPanel({ containerRef, onDismiss, results }: ResultsPanelProps): JSX.Element {
  const { t } = useTranslation();

  useMountEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      onDismiss();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div
          className="pointer-events-auto mb-2 overflow-hidden rounded-lg border bg-background shadow-[0_-16px_40px_-16px_rgba(0,0,0,0.5)]"
          style={{ borderColor: 'var(--c-accent)' }}
          role="dialog"
          aria-label={t('terminal.results')}
        >
          <header
            className="flex items-center justify-between border-b-2 bg-muted px-3 py-2 text-foreground"
            style={{ borderColor: 'var(--c-accent)' }}
          >
            <span
              className="font-mono text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--c-accent)' }}
            >
              {t('terminal.resultsLabel')}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('actions.close')}
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </header>
          <TerminalResults entries={results} className="max-h-[60vh] px-4 py-3 sm:px-6" />
        </div>
      </div>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}
