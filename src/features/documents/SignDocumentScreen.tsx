import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  const queryClient = useQueryClient();
  const { data: event } = useActiveEvent();
  const { show } = useToast();

  const { data: expectedFullName = '' } = useQuery({
    queryKey: ['document-signature-name', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string> => {
      if (!user) return '';
      const { data } = await getSupabaseClient()
        .from('users')
        .select(
          `employee_profiles ( preferred_name, legal_name ), guest_profiles!guest_profiles_user_id_fkey ( first_name, last_name )`,
        )
        .eq('id', user.id)
        .maybeSingle();

      const employee = data?.employee_profiles;
      if (employee?.legal_name) return employee.legal_name.trim();
      if (employee?.preferred_name) return employee.preferred_name.trim();
      const guest = data?.guest_profiles;
      return `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim();
    },
  });

  const { data: document = null } = useQuery({
    queryKey: ['document', documentId],
    enabled: !!documentId,
    queryFn: async (): Promise<DocumentRow | null> => {
      if (!documentId) return null;
      const { data } = await getSupabaseClient()
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();
      return data;
    },
  });
  const [reachedBottom, setReachedBottom] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nameMismatch, setNameMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Documents that don't require scroll OR whose body fits the viewport
  // never fire onScroll, so we mark "reached" once the DOM is laid out.
  // Keyed on document.id via the parent so this fires fresh per doc.
  const requiresScroll = document?.requires_scroll ?? true;

  function handleScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    if (isScrolledToBottom(el.scrollTop, el.scrollHeight, el.clientHeight)) {
      setReachedBottom(true);
    }
  }

  const submitEnabled = useMemo(() => {
    return (!requiresScroll || reachedBottom) && fullName.trim().length >= 3 && !busy;
  }, [requiresScroll, reachedBottom, fullName, busy]);

  async function handleSign(): Promise<void> {
    if (!user || !event || !document) return;
    setBusy(true);
    try {
      const enteredName = fullName.trim();
      if (
        expectedFullName.length > 0 &&
        enteredName.toLocaleLowerCase() !== expectedFullName.toLocaleLowerCase()
      ) {
        setNameMismatch(true);
        show(t('documents.fullNameMismatch'), 'error');
        return;
      }
      setNameMismatch(false);

      await signDocument(getSupabaseClient(), {
        userId: user.id,
        eventId: event.id,
        document: {
          id: document.id,
          document_key: document.document_key,
          version: document.version,
        },
        fullName: enteredName,
        scrolledToBottom: reachedBottom,
        deviceType: detectDeviceType(navigator.userAgent),
      });
      show(t('documents.signSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents', event.id, user.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile', 'checklist'] }),
      ]);
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
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
        <Link to="/documents" className="inline-flex items-center gap-2">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('documents.backToDocuments')}
        </Link>
      </Button>
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('documents.signSubtitle')} · {t('documents.version', { version: document.version })}
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
        <div
          ref={(el) => {
            scrollRef.current = el;
            // Ref callback runs once the element is in the DOM. If the
            // body fits the viewport without scrolling, mark reached
            // immediately — otherwise the user can never trigger
            // onScroll and the form stays disabled.
            if (el && isScrolledToBottom(el.scrollTop, el.scrollHeight, el.clientHeight)) {
              setReachedBottom(true);
            }
          }}
          onScroll={handleScroll}
          role="region"
          aria-label={document.title}
          className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded-md border bg-card p-8 text-card-foreground"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.body}</ReactMarkdown>
        </div>

        {requiresScroll && !reachedBottom ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('documents.scrollToContinue')}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="signature">{t('documents.fullNameLabel')}</Label>
          <Input
            id="signature"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (nameMismatch) setNameMismatch(false);
            }}
            disabled={!reachedBottom}
            autoComplete="name"
            placeholder={expectedFullName || undefined}
            aria-invalid={nameMismatch}
          />
          {expectedFullName ? (
            <p className="text-xs text-muted-foreground">
              {t('documents.fullNamePrompt', { name: expectedFullName })}
            </p>
          ) : null}
          {nameMismatch ? (
            <p className="text-xs text-destructive">{t('documents.fullNameMismatch')}</p>
          ) : null}
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
