// Quick-start block shown directly under the API Keys card. Tells the
// user how to install and use the Kizuna CLI against this deployment.
// All copy flows through i18n. The host shown in commands is whatever
// origin the app is currently served from, so a clone at
// offsite.examplecorp.com renders the right URL automatically.

import { Check, ChevronDown, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

export function CliInstructions(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // The CLI POSTs to <url>/functions/v1/cli, so it needs the Supabase
  // project URL — not the app's domain. They're the same in local dev
  // (Vite + Supabase share localhost) but diverge in stg/prd: the app
  // is on Vercel and Supabase lives at <ref>.supabase.co. Reading from
  // env keeps this correct in every environment.
  const host = env.supabaseUrl.replace(/\/$/, '');

  return (
    <section
      className="border p-6 text-card-foreground"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="cli-instructions-body"
        className="flex w-full flex-row items-start justify-between gap-3 text-left"
      >
        <div className="space-y-1">
          <h2
            className="text-[11px] font-bold uppercase"
            style={{ color: 'var(--c-muted)', letterSpacing: '0.18em' }}
          >
            {t('profile.cli.title')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
            {t('profile.cli.description')}
          </p>
        </div>
        <ChevronDown
          aria-hidden
          className="mt-1 h-5 w-5 shrink-0 transition-transform"
          style={{
            color: 'var(--c-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open ? (
        <div id="cli-instructions-body" className="mt-6 space-y-6">
          <Step
            number={1}
            title={t('profile.cli.step1.title')}
            body={t('profile.cli.step1.body')}
            command="npm install -g @strategicnerds/kizuna-cli"
          />
          <Step
            number={2}
            title={t('profile.cli.step2.title')}
            body={t('profile.cli.step2.body')}
            command={`kizuna login --url ${host}`}
          />
          <Step
            number={3}
            title={t('profile.cli.step3.title')}
            body={t('profile.cli.step3.body')}
            commands={[
              'kizuna me',
              'kizuna me itinerary --format md',
              'kizuna attendees --hobby snowboarding',
              'kizuna schema',
            ]}
          />
          <Step
            number={4}
            title={t('profile.cli.step4.title')}
            body={t('profile.cli.step4.body')}
            command="npx -p @strategicnerds/kizuna-mcp kizuna-mcp"
            extra={
              <pre
                className="mt-3 overflow-x-auto rounded-md border p-3 text-xs"
                style={{
                  borderColor: 'var(--c-rule)',
                  backgroundColor: 'var(--c-bg)',
                  color: 'var(--c-fg)',
                }}
              >{`{
  "mcpServers": {
    "kizuna": {
      "command": "npx",
      "args": ["-p", "@strategicnerds/kizuna-mcp", "kizuna-mcp"],
      "env": {
        "KIZUNA_URL": "${host}",
        "KIZUNA_TOKEN": "kzn_..."
      }
    }
  }
}`}</pre>
            }
          />
        </div>
      ) : null}
    </section>
  );
}

interface StepProps {
  number: number;
  title: string;
  body: string;
  command?: string;
  commands?: string[];
  extra?: React.ReactNode;
}

function Step({ number, title, body, command, commands, extra }: StepProps): JSX.Element {
  return (
    <div className="flex gap-4">
      <div
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ backgroundColor: 'var(--c-rule)', color: 'var(--c-fg)' }}
      >
        {number}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Terminal aria-hidden className="h-4 w-4" style={{ color: 'var(--c-muted)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--c-fg)' }}>
            {title}
          </h3>
        </div>
        <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
          {body}
        </p>
        {command ? <CommandLine command={command} /> : null}
        {commands?.map((line) => (
          <CommandLine key={line} command={line} />
        ))}
        {extra}
      </div>
    </div>
  );
}

function CommandLine({ command }: { command: string }): JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; non-fatal */
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs"
      style={{
        borderColor: 'var(--c-rule)',
        backgroundColor: 'var(--c-bg)',
      }}
    >
      <span style={{ color: 'var(--c-accent)' }}>$</span>
      <code
        className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap"
        style={{ color: 'var(--c-fg)' }}
      >
        {command}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void onCopy()}
        aria-label={copied ? t('profile.cli.copied') : t('profile.cli.copy')}
      >
        {copied ? (
          <Check aria-hidden className="h-3.5 w-3.5" />
        ) : (
          <Copy aria-hidden className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
