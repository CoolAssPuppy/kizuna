import { useTranslation } from 'react-i18next';

import { CommandOutput } from '@/features/cli/CommandOutput';
import type { TerminalHistoryEntry } from '@/features/cli/useTerminal';
import { cn } from '@/lib/utils';

interface Props {
  entries: TerminalHistoryEntry[];
  className?: string;
}

export function TerminalResults({ entries, className }: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={cn('flex flex-col-reverse gap-3 overflow-y-auto', className)}
      aria-live="polite"
    >
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('terminal.help')}</p>
      ) : (
        entries.map((entry) => (
          <CommandOutput
            key={`${entry.command}-${entry.durationMs}`}
            command={entry.command}
            durationMs={entry.durationMs}
            result={entry.result}
          />
        ))
      )}
    </div>
  );
}
