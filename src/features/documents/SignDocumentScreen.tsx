import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { getSupabaseClient } from '@/lib/supabase';

import { detectDeviceType } from './deviceType';
import { signDocument } from './createDocument';
import { isScrolledToBottom } from './scroll';
import type { DocumentRow } from './types';

export function SignDocumentScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();
  const { show } = useToast();

  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!documentId) return;
    const supabase = getSupabaseClient();
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();
      if (!active) return;
      setDocument(data);
      if (!data?.requires_scroll) setReachedBottom(true);
    })();
    return () => {
      active = false;
    };
  }, [documentId]);

  // After the document renders, check whether it already fits in the
  // viewport — short documents have no scrollable area, so the user can
  // never trigger onScroll and would otherwise be stuck.
  useEffect(() => {
    if (!document) return;
    const el = scrollRef.current;
    if (!el) return;
    if (isScrolledToBottom(el.scrollTop, el.scrollHeight, el.clientHeight)) {
      setReachedBottom(true);
    }
  }, [document]);

  function handleScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    if (isScrolledToBottom(el.scrollTop, el.scrollHeight, el.clientHeight)) {
      setReachedBottom(true);
    }
  }

  const submitEnabled = useMemo(() => {
    return reachedBottom && fullName.trim().length >= 3 && !busy;
  }, [reachedBottom, fullName, busy]);

  async function handleSign(): Promise<void> {
    if (!user || !event || !document) return;
    setBusy(true);
    try {
      await signDocument(getSupabaseClient(), {
        userId: user.id,
        eventId: event.id,
        document: {
          id: document.id,
          document_key: document.document_key,
          version: document.version,
        },
        fullName: fullName.trim(),
        scrolledToBottom: reachedBottom,
        deviceType: detectDeviceType(navigator.userAgent),
      });
      show(t('documents.signSuccess'));
      navigate('/documents');
    } catch {
      show(t('documents.signFailure'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!document) {
    return (
      <main className="flex items-center justify-center py-20" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-10">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('documents.signSubtitle')} · {t('documents.version', { version: document.version })}
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="region"
          aria-label={document.title}
          className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded-md border bg-card p-8 text-card-foreground"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.body}</ReactMarkdown>
        </div>

        {document.requires_scroll && !reachedBottom ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('documents.scrollToContinue')}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="signature">{t('documents.fullNameLabel')}</Label>
          <Input
            id="signature"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!reachedBottom}
            autoComplete="off"
          />
        </div>

        <Button
          onClick={() => void handleSign()}
          disabled={!submitEnabled}
          size="lg"
          className="w-full"
        >
          {busy ? t('documents.signing') : t('documents.signButton')}
        </Button>
      </div>
    </main>
  );
}
