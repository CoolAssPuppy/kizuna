import { Check, Clipboard } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import type { CommandResult } from '@/lib/cli';

interface CommandOutputProps {
  command: string;
  durationMs: number;
  result: CommandResult;
}

/**
 * Renders the result of a CLI command for the web terminal. The web
 * surface is intentionally UI-first: every command's per-command
 * `toMarkdown` formatter is rendered as React components so the user
 * sees prose, not raw JSON or markdown source. Use the CLI binary or
 * the HTTP API for machine-readable output.
 */
export function CommandOutput({ command, durationMs, result }: CommandOutputProps): JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const body = renderBody(result);

  const onCopy = async (): Promise<void> => {
    await navigator.clipboard?.writeText(body.copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className="border bg-background" style={{ borderColor: 'var(--c-rule)' }}>
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <code className="break-all font-mono" style={{ color: 'var(--c-accent)' }}>
          $ {command}
        </code>
        <span className="ml-auto text-muted-foreground">{durationMs}ms</span>
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

interface RenderedBody {
  node: JSX.Element;
  copyText: string;
}

function renderBody(result: CommandResult): RenderedBody {
  if (!result.ok) {
    const text = `${result.error.code}: ${result.error.message}`;
    return {
      copyText: text,
      node: <p className="break-words text-destructive">{text}</p>,
    };
  }

  // The dispatcher is invoked with `format: 'md'`, so `markdown` is
  // populated for every successful result. The fallback exists only
  // for defensive symmetry with the type — the web terminal will
  // never hit it in practice.
  const markdown = result.markdown ?? toFallbackMarkdown(result.data);
  return {
    copyText: markdown,
    node: (
      <div className="prose prose-sm dark:prose-invert prose-p:my-2 prose-li:my-1 prose-pre:my-2 prose-headings:mb-2 prose-headings:mt-3 max-w-none break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    ),
  };
}

function toFallbackMarkdown(data: unknown): string {
  if (data === null || data === undefined) return '_No data._';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  return Object.entries(data as Record<string, unknown>)
    .map(([key, value]) => `- **${key}:** ${stringifyValue(value)}`)
    .join('\n');
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} items`;
  return Object.keys(value).join(', ') || '—';
}
