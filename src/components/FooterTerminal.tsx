import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CommandOutput } from '@/components/CommandOutput';
import { useAuth } from '@/features/auth/AuthContext';
import { useMountEffect } from '@/hooks/useMountEffect';
import { allCommands, dispatch, type CommandResult } from '@/lib/cli';
import type { CommandRole } from '@/lib/cli';
import { getSupabaseClient } from '@/lib/supabase';

interface HistoryEntry {
  command: string;
  durationMs: number;
  result: CommandResult;
}

const HISTORY_KEY = 'kizuna.terminal.history';
const HISTORY_LIMIT = 50;
const RESULT_LIMIT = 5;

export function FooterTerminal(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [results, setResults] = useState<HistoryEntry[]>([]);

  const completions = useMemo(() => allCommands().map((command) => command.path.join(' ')), []);

  useMountEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        setExpanded(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const runCommand = async (): Promise<void> => {
    const raw = value.trim();
    if (!raw || !user) return;

    setBusy(true);
    const started = performance.now();
    const controller = new AbortController();
    const result = await dispatch(
      { raw },
      {
        supabase: getSupabaseClient(),
        user,
        role: toCommandRole(user.role),
        t,
        signal: controller.signal,
      },
    );
    const entry = {
      command: raw,
      durationMs: Math.round(performance.now() - started),
      result,
    };
    setResults((current) => [entry, ...current].slice(0, RESULT_LIMIT));
    setHistory((current) => writeHistory([raw, ...current.filter((item) => item !== raw)]));
    setHistoryIndex(null);
    setValue('');
    setExpanded(true);
    setBusy(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      setExpanded(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void runCommand();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setValue(history[next] ?? '');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex - 1;
      setHistoryIndex(next >= 0 ? next : null);
      setValue(next >= 0 ? (history[next] ?? '') : '');
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setResults([]);
      return;
    }
    if (event.key === 'Tab') {
      const completion = completions.find((candidate) => candidate.startsWith(value.trim()));
      if (completion) {
        event.preventDefault();
        setValue(completion);
      }
    }
  };

  return (
    <div className="border-t" style={{ borderColor: 'var(--c-rule)' }}>
      {expanded ? (
        <div
          className="mx-auto flex max-h-80 w-full max-w-7xl flex-col-reverse gap-3 overflow-y-auto px-4 py-3 sm:px-8"
          aria-live="polite"
        >
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('terminal.help')}</p>
          ) : (
            results.map((entry) => (
              <CommandOutput
                key={`${entry.command}-${entry.durationMs}`}
                command={entry.command}
                durationMs={entry.durationMs}
                result={entry.result}
              />
            ))
          )}
        </div>
      ) : null}
      <label
        className="flex cursor-text items-center gap-2 px-4 py-3"
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
          onFocus={() => setExpanded(true)}
          onKeyDown={onKeyDown}
          disabled={busy}
          placeholder={t('terminal.placeholder')}
          aria-label={t('terminal.label')}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
        <span className="terminal-cursor" />
      </label>
    </div>
  );
}

function readHistory(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]): string[] {
  const next = history.slice(0, HISTORY_LIMIT);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

function toCommandRole(role: string): CommandRole {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'attendee';
}
