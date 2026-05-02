import { Check, Clipboard, Code2, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import type { CommandFormat, CommandResult } from '@/lib/cli';

interface CommandOutputProps {
  command: string;
  durationMs: number;
  result: CommandResult;
}

export function CommandOutput({ command, durationMs, result }: CommandOutputProps): JSX.Element {
  const { t } = useTranslation();
  const [format, setFormat] = useState<CommandFormat>(result.ok ? result.format : 'json');
  const [copied, setCopied] = useState(false);
  const body = renderBody(result, format);

  const onCopy = async (): Promise<void> => {
    await navigator.clipboard?.writeText(body.copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className="border bg-background" style={{ borderColor: 'var(--c-rule)' }}>
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <code className="font-mono" style={{ color: 'var(--c-accent)' }}>
          $ {command}
        </code>
        <span className="ml-auto text-muted-foreground">{durationMs}ms</span>
        {result.ok ? (
          <div className="flex rounded-md border" style={{ borderColor: 'var(--c-rule)' }}>
            <Button
              type="button"
              variant={format === 'json' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFormat('json')}
              aria-label={t('terminal.format.json')}
              className="h-7 rounded-none px-2"
            >
              <Code2 aria-hidden className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={format === 'md' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFormat('md')}
              aria-label={t('terminal.format.md')}
              className="h-7 rounded-none px-2"
            >
              <FileText aria-hidden className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void onCopy()}
          aria-label={t(copied ? 'terminal.copied' : 'terminal.copy')}
          className="h-7 px-2"
        >
          {copied ? (
            <Check aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <Clipboard aria-hidden className="h-3.5 w-3.5" />
          )}
        </Button>
      </header>
      <div className="max-h-80 overflow-auto px-3 py-3 text-sm">{body.node}</div>
    </article>
  );
}

function renderBody(
  result: CommandResult,
  format: CommandFormat,
): { node: JSX.Element; copyText: string } {
  if (!result.ok) {
    const text = `${result.error.code}: ${result.error.message}`;
    return {
      copyText: text,
      node: <p className="text-destructive">{text}</p>,
    };
  }

  if (format === 'md') {
    const markdown =
      result.markdown ?? ['```json', JSON.stringify(result.data, null, 2), '```'].join('\n');
    return {
      copyText: markdown,
      node: (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ),
    };
  }

  const json = JSON.stringify(result.data, null, 2);
  return {
    copyText: json,
    node: <JsonView value={result.data} />,
  };
}

function JsonView({ value }: { value: unknown }): JSX.Element {
  if (value === null || typeof value !== 'object') {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }

  if (Array.isArray(value)) {
    const items = value as unknown[];
    return (
      <details open className="font-mono text-xs">
        <summary>[{items.length}]</summary>
        <div className="ml-4 space-y-1">
          {items.map((item, index) => (
            <div key={index}>
              <span className="text-muted-foreground">{index}: </span>
              <JsonView value={item} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <details open className="font-mono text-xs">
      <summary>{'{'}</summary>
      <div className="ml-4 space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
          <div key={key}>
            <span className="text-muted-foreground">{key}: </span>
            <JsonView value={child} />
          </div>
        ))}
      </div>
      <span>{'}'}</span>
    </details>
  );
}
