import { TerminalSquare, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TerminalResults } from '@/components/TerminalResults';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useTerminal } from '@/hooks/useTerminal';

/** Mobile-only entry point to the web terminal. */
export function MobilePrompt(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('terminal.openPrompt')}
        title={t('terminal.openPrompt')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm ring-1 ring-border hover:bg-accent lg:hidden"
      >
        <TerminalSquare aria-hidden className="h-4 w-4" />
      </button>
      {open ? <MobilePromptSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

interface SheetProps {
  onClose: () => void;
}

function MobilePromptSheet({ onClose }: SheetProps): JSX.Element {
  const { t } = useTranslation();
  const { inputRef, value, setValue, busy, results, onKeyDown } = useTerminal();

  useMountEffect(() => {
    inputRef.current?.focus();
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('terminal.title')}
      className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
    >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--c-rule)' }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide">{t('terminal.title')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('actions.close')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>
      <TerminalResults entries={results} className="flex-1 px-4 py-3" />
      <label
        className="flex cursor-text items-center gap-2 border-t px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] transition-colors has-[input:focus]:[background-color:var(--c-surface)]"
        style={{
          backgroundColor: 'var(--c-surface-soft)',
          borderColor: 'var(--c-rule)',
        }}
      >
        <span style={{ color: 'var(--c-accent)' }}>$</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={busy}
          placeholder={t('terminal.placeholder')}
          aria-label={t('terminal.label')}
          className="terminal-input min-w-0 flex-1 bg-transparent font-mono text-sm placeholder:text-muted-foreground"
        />
        <span className="terminal-cursor" />
      </label>
    </div>
  );
}
