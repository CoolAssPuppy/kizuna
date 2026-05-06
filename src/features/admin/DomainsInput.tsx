import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';

const DOMAIN_PATTERN = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

interface Props {
  value: ReadonlyArray<string>;
  onChange: (next: string[]) => void;
}

/**
 * Chip-style multi-input for events.allowed_domains. Accepts exact hosts
 * ("supabase.io") and subdomain wildcards ("*.supabase.io"). Invalid
 * formats are rejected inline; the matching server-side function will
 * still gate eligibility, but a client-side pre-check saves a DB round
 * trip and gives a localized error.
 */
export function DomainsInput({ value, onChange }: Props): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function tryAdd(raw: string): void {
    const candidate = raw.trim().toLowerCase();
    if (!candidate) {
      setError(null);
      return;
    }
    if (!DOMAIN_PATTERN.test(candidate)) {
      setError(t('admin.events.allowedDomains.invalid'));
      return;
    }
    if (value.includes(candidate)) {
      setDraft('');
      setError(null);
      return;
    }
    onChange([...value, candidate]);
    setDraft('');
    setError(null);
  }

  function remove(domain: string): void {
    onChange(value.filter((d) => d !== domain));
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            tryAdd(draft);
          }
        }}
        onBlur={() => {
          if (draft) tryAdd(draft);
        }}
        placeholder={t('admin.events.allowedDomains.placeholder')}
        aria-label={t('admin.events.allowedDomains.label')}
        aria-invalid={error !== null}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('admin.events.allowedDomains.hint')}</p>
      )}
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((domain) => (
            <li
              key={domain}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs"
            >
              <span>{domain}</span>
              <button
                type="button"
                onClick={() => remove(domain)}
                aria-label={t('admin.events.allowedDomains.remove', { domain })}
                className="rounded-full p-0.5 hover:bg-accent"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
