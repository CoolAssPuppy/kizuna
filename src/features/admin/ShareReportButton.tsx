import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import { buildShareUrl, generateShareToken } from './sharing';

type ReportType = Database['public']['Enums']['report_type'];

interface Props {
  reportType: ReportType;
  eventId: string | null;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function ShareReportButton({ reportType, eventId }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!eventId) return null;

  async function generate(): Promise<void> {
    if (!eventId) return;
    setBusy(true);
    try {
      const token = generateShareToken();
      const expires = new Date(Date.now() + ONE_WEEK_MS).toISOString();
      const { error } = await getSupabaseClient().from('report_snapshots').insert({
        event_id: eventId,
        report_type: reportType,
        share_token: token,
        share_expires_at: expires,
      });
      if (error) throw error;
      const url = buildShareUrl(window.location.origin, token);
      setShareUrl(url);
      show(t('admin.share.created'));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      show(t('admin.share.error', { message }), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(): Promise<void> {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      show(t('admin.share.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show(t('admin.share.copyFailed'), 'error');
    }
  }

  if (shareUrl) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={shareUrl}
          readOnly
          aria-label={t('admin.share.urlLabel')}
          className="w-72 rounded-md border bg-muted px-3 py-1.5 text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copyToClipboard()}
          aria-label={t('admin.share.copy')}
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

  return (
    <Button type="button" variant="outline" onClick={() => void generate()} disabled={busy}>
      <Share2 aria-hidden className="mr-2 h-3.5 w-3.5" />
      {busy ? t('admin.share.creating') : t('admin.share.create')}
    </Button>
  );
}
