import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { detectDeviceType } from './deviceType';
import { isScrolledToBottom } from './scroll';
import type { DocumentRow } from './types';

interface ConsentGateProps {
  document: DocumentRow;
  onAcknowledge: (params: {
    scrolledToBottom: boolean;
    explicitCheckbox: boolean;
    deviceType: 'mobile' | 'tablet' | 'desktop';
  }) => Promise<void>;
}

/**
 * Renders one document with the legal-grade consent gate:
 *   - Scroll-to-bottom enforcement (when document.requires_scroll)
 *   - Explicit checkbox tick (always, when document.requires_acknowledgement)
 *   - Submit button disabled until both are satisfied
 *
 * On submit, calls onAcknowledge with the captured signals so the caller can
 * persist them to document_acknowledgements with IP/UA captured server-side.
 */
export function ConsentGate(props: ConsentGateProps): JSX.Element {
  // Re-mount on document change so the scroll ref re-evaluates and
  // local state resets to the new document's requires_scroll default.
  return <ConsentGateInner key={props.document.id} {...props} />;
}

function ConsentGateInner({ document, onAcknowledge }: ConsentGateProps): JSX.Element {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [reachedBottom, setReachedBottom] = useState(!document.requires_scroll);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function evaluateBottom(): void {
    const el = scrollRef.current;
    if (!el) return;
    if (isScrolledToBottom(el.scrollTop, el.scrollHeight, el.clientHeight)) {
      setReachedBottom(true);
    }
  }

  const submitEnabled = reachedBottom && checkboxChecked && !busy;

  async function handleSubmit(): Promise<void> {
    if (!submitEnabled) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await onAcknowledge({
        scrolledToBottom: reachedBottom,
        explicitCheckbox: checkboxChecked,
        deviceType: detectDeviceType(navigator.userAgent),
      });
    } catch {
      setErrorKey('documents.errorSaving');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{document.title}</h2>
        <p className="text-sm text-muted-foreground">
          {t('documents.version', { version: document.version })}
        </p>
      </header>

      <div
        ref={(el) => {
          scrollRef.current = el;
          // Initial check on mount; covers short docs that don't scroll.
          if (el) evaluateBottom();
        }}
        onScroll={evaluateBottom}
        className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded-md border bg-card p-6 text-card-foreground"
        role="region"
        aria-label={document.title}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.body}</ReactMarkdown>
      </div>

      {document.requires_scroll && !reachedBottom ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('documents.scrollToContinue')}
        </p>
      ) : null}

      <div className="flex items-start gap-3">
        <Checkbox
          id={`ack-${document.id}`}
          checked={checkboxChecked}
          onCheckedChange={(value) => setCheckboxChecked(value === true)}
          disabled={!reachedBottom}
        />
        <Label htmlFor={`ack-${document.id}`} className="cursor-pointer leading-snug">
          {t('documents.explicitCheckboxLabel', { title: document.title })}
        </Label>
      </div>

      <Button
        onClick={() => void handleSubmit()}
        disabled={!submitEnabled}
        size="lg"
        className="w-full"
      >
        {busy ? t('documents.savingAcknowledgement') : t('documents.agreeAndContinue')}
      </Button>

      {errorKey ? (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
    </article>
  );
}
