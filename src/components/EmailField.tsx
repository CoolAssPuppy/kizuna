import { Check, Copy } from 'lucide-react';
import { useState, type SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

function SlackIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  // Single-color silhouette of the Slack hash mark — matches the
  // weight of lucide-react icons so it lines up with Copy in the row.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M5.04 15.04a2.04 2.04 0 1 1 0-4.08h2.04v2.04a2.04 2.04 0 0 1-2.04 2.04zm1.02-5.1a2.04 2.04 0 1 1 0-4.08 2.04 2.04 0 0 1 2.04 2.04v2.04H6.06zM10.96 5.04a2.04 2.04 0 1 1 4.08 0v2.04h-2.04a2.04 2.04 0 0 1-2.04-2.04zm5.1 1.02a2.04 2.04 0 1 1 4.08 0 2.04 2.04 0 0 1-2.04 2.04h-2.04V6.06zM18.96 10.96a2.04 2.04 0 1 1 0 4.08h-2.04v-2.04a2.04 2.04 0 0 1 2.04-2.04zm-1.02 5.1a2.04 2.04 0 1 1 0 4.08 2.04 2.04 0 0 1-2.04-2.04v-2.04h2.04zM13.04 18.96a2.04 2.04 0 1 1-4.08 0v-2.04h2.04a2.04 2.04 0 0 1 2.04 2.04zm-5.1-1.02a2.04 2.04 0 1 1-4.08 0 2.04 2.04 0 0 1 2.04-2.04h2.04v2.04z" />
    </svg>
  );
}

interface EmailFieldProps {
  email: string;
  /** Optional className for the wrapper to control alignment + truncation. */
  className?: string;
  /** Optional className for the email text itself (color, weight). */
  textClassName?: string;
}

/**
 * Displays an email address with hover affordances: copy to clipboard
 * and open a Slack DM. The Slack action redirects through
 * https://slack.com/app_redirect?email=, which hands off to the
 * Slack desktop app when installed and falls back to the web UI
 * otherwise — no workspace/team config needed.
 */
export function EmailField({ email, className, textClassName }: EmailFieldProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  if (!email) {
    return <span className={cn('text-c-dim', className)}>—</span>;
  }

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      show(t('email.copied'));
    } catch {
      show(t('email.copyFailed'), 'error');
    }
  }

  const slackUrl = `https://slack.com/app_redirect?email=${encodeURIComponent(email)}`;

  return (
    <span className={cn('group inline-flex items-center gap-1.5', className)}>
      <a href={`mailto:${email}`} className={cn('truncate', textClassName)} title={email}>
        {email}
      </a>
      <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={t('email.copy')}
          title={t('email.copy')}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-c-muted hover:text-c-fg focus-visible:opacity-100"
        >
          {copied ? (
            <Check aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <Copy aria-hidden className="h-3.5 w-3.5" />
          )}
        </button>
        <a
          href={slackUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t('email.slack')}
          title={t('email.slack')}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-c-muted hover:text-c-fg"
        >
          <SlackIcon className="h-3.5 w-3.5" />
        </a>
      </span>
    </span>
  );
}
