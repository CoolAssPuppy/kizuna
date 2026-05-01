import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { createDocument } from './createDocument';
import type { DocumentRow } from './types';

const DOCUMENT_KEYS: ReadonlyArray<DocumentRow['document_key']> = [
  'waiver',
  'code_of_conduct',
  'expense_policy',
  'booking_process',
  'livestream',
  'toc',
];

export function CreateDocumentScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show } = useToast();
  const { data: event } = useActiveEvent();

  const [documentKey, setDocumentKey] = useState<DocumentRow['document_key']>('waiver');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [requiresAcknowledgement, setRequiresAck] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(): Promise<void> {
    setBusy(true);
    try {
      await createDocument(getSupabaseClient(), {
        eventId: event?.id ?? null,
        documentKey,
        title,
        body,
        requiresAcknowledgement,
      });
      show(t('documents.createSuccess'));
      navigate('/documents');
    } catch {
      show(t('profile.toast.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('documents.createTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('documents.createSubtitle')}</p>
      </header>

      <div className="mx-auto max-w-3xl">
        <CardShell title={t('documents.createTitle')}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-key">{t('documents.documentKey')}</Label>
              <select
                id="doc-key"
                value={documentKey}
                onChange={(e) => {
                  const next = DOCUMENT_KEYS.find((k) => k === e.target.value);
                  if (next) setDocumentKey(next);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {DOCUMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-title">{t('documents.documentTitle')}</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-body">{t('documents.documentBody')}</Label>
              <Textarea
                id="doc-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                required
              />
              <p className="text-xs text-muted-foreground">{t('documents.documentBodyHint')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={requiresAcknowledgement}
                onCheckedChange={(value) => setRequiresAck(value === true)}
              />
              {t('documents.requiresAcknowledgement')}
            </label>
            <Button onClick={() => void handleSubmit()} disabled={busy || !title || !body}>
              {busy ? t('documents.publishing') : t('documents.publish')}
            </Button>
          </div>
        </CardShell>
      </div>
    </main>
  );
}
