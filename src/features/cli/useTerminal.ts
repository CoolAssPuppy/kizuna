import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { useMountEffect } from '@/hooks/useMountEffect';
import { allCommands, dispatch, type CommandResult, type CommandRole } from '@/lib/cli';
import { getSupabaseClient } from '@/lib/supabase';

export interface TerminalHistoryEntry {
  command: string;
  durationMs: number;
  result: CommandResult;
}

interface UseTerminalReturn {
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  setValue: (value: string) => void;
  busy: boolean;
  results: TerminalHistoryEntry[];
  runCommand: () => Promise<void>;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

const HISTORY_KEY = 'kizuna.terminal.history';
const HISTORY_LIMIT = 50;
const RESULT_LIMIT = 5;

/** Shared state and dispatch for the web terminal across desktop and mobile surfaces. */
export function useTerminal(): UseTerminalReturn {
  const { t } = useTranslation();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [results, setResults] = useState<TerminalHistoryEntry[]>([]);

  const completions = useMemo(() => allCommands().map((command) => command.path.join(' ')), []);

  // Cancel in-flight requests on unmount (e.g. mobile sheet closed mid-dispatch).
  useMountEffect(() => () => inFlightRef.current?.abort());

  const runCommand = async (): Promise<void> => {
    const raw = value.trim();
    if (!raw || !user) return;

    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    setBusy(true);
    const started = performance.now();
    const result = await dispatch(
      { raw, format: 'md' },
      {
        supabase: getSupabaseClient(),
        user: { id: user.id, email: user.email, role: user.role },
        role: toCommandRole(user.role),
        patScope: null,
        t: (key, vars) => t(key, vars as Record<string, unknown>),
        signal: controller.signal,
      },
    );
    if (controller.signal.aborted) return;

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

  return {
    inputRef,
    value,
    setValue,
    busy,
    results,
    runCommand,
    onKeyDown,
    expanded,
    setExpanded,
  };
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

function toCommandRole(role: string): CommandRole {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  return 'attendee';
}
