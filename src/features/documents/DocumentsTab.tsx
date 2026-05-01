import { Download, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/features/auth/hooks';
import { mediumDateTimeFormatter } from '@/lib/formatters';
import { useStorageImage } from '@/lib/useStorageImage';

import { useDocumentsQuery } from './useDocumentsQuery';
import type { DocumentWithAck } from './types';

interface DocumentsTabProps {
  eventId: string;
}

export function DocumentsTab({ eventId }: DocumentsTabProps): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { data, isLoading, error } = useDocumentsQuery({ eventId });

  if (isLoading) {
    return (
      <main className="flex items-center justify-center py-20" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex items-center justify-center px-6 py-20">
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-8 py-10">
      <header className="flex flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('documents.tabTitle')}</h1>
        {isAdmin ? (
          <Button asChild>
            <Link to="/documents/new">{t('documents.addDocument')}</Link>
          </Button>
        ) : null}
      </header>

      {!data || data.length === 0 ? (
        <p className="text-muted-foreground">{t('documents.noDocuments')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.map((entry) => (
            <DocumentCard key={entry.document.id} entry={entry} />
          ))}
        </div>
      )}
    </main>
  );
}

interface DocumentCardProps {
  entry: DocumentWithAck;
}

function DocumentCard({ entry }: DocumentCardProps): JSX.Element {
  const { t } = useTranslation();
  const { document, acknowledgement, needsAcknowledgement } = entry;
  const isSigned = acknowledgement !== null && !needsAcknowledgement;

  return (
    <article className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold">{document.title}</h2>
          <p className="text-sm text-muted-foreground">
            {t('documents.version', { version: document.version })}
            {acknowledgement
              ? ` · ${t('documents.acknowledgedOn', {
                  date: mediumDateTimeFormatter.format(new Date(acknowledgement.acknowledged_at)),
                })}`
              : null}
          </p>
          {needsAcknowledgement ? (
            <p role="status" className="text-sm font-medium text-destructive">
              {t('documents.versionBumped')}
            </p>
          ) : null}
        </header>
        <DocumentPreview document={document} />
      </div>
      <div className="flex items-center justify-between pt-2">
        {isSigned ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t('documents.signed')}
          </span>
        ) : (
          <span />
        )}
        {document.requires_acknowledgement ? (
          <Button asChild size="sm" variant={isSigned ? 'outline' : 'default'}>
            <Link to={`/documents/${document.id}/sign`}>{t('documents.readAndSign')}</Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function DocumentPreview({ document }: { document: DocumentWithAck['document'] }): JSX.Element {
  const { t } = useTranslation();
  const pdfUrl = useStorageImage('documents', document.pdf_path);

  if (document.content_type === 'pdf') {
    return (
      <div className="space-y-2">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={document.title}
            className="h-64 w-full rounded-md border bg-background"
          />
        ) : (
          <p className="rounded-md border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            {t('documents.pdf.loading')}
          </p>
        )}
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download aria-hidden className="h-3 w-3" />
            {t('documents.pdf.download')}
          </a>
        ) : null}
      </div>
    );
  }

  if (document.content_type === 'notion') {
    return document.notion_url ? (
      <a
        href={document.notion_url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-primary hover:bg-muted"
      >
        <ExternalLink aria-hidden className="h-4 w-4" />
        {t('documents.notion.open')}
      </a>
    ) : (
      <p className="text-sm text-muted-foreground">{t('documents.pdf.unavailable')}</p>
    );
  }

  return (
    <div className="prose prose-sm max-h-40 max-w-none overflow-hidden text-ellipsis">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.body ?? ''}</ReactMarkdown>
    </div>
  );
}
