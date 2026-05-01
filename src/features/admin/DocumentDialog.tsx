import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import {
  type DocumentContentType,
  type DocumentRow,
  createDocument,
  updateDocument,
} from './api/documents';
import { PdfUploader } from './PdfUploader';

type DocumentKey = DocumentRow['document_key'];
type Audience = DocumentRow['applies_to'];

interface Draft {
  title: string;
  document_key: DocumentKey;
  applies_to: Audience;
  content_type: DocumentContentType;
  body: string;
  pdf_path: string;
  notion_url: string;
  is_active: boolean;
  requires_acknowledgement: boolean;
  requires_scroll: boolean;
}

const DOCUMENT_KEYS: ReadonlyArray<DocumentKey> = [
  'waiver',
  'code_of_conduct',
  'expense_policy',
  'booking_process',
  'livestream',
  'toc',
];

const DOCUMENT_KEY_LABELS: Record<DocumentKey, string> = {
  waiver: 'Waiver',
  code_of_conduct: 'Code of conduct',
  expense_policy: 'Expense policy',
  booking_process: 'Booking process',
  livestream: 'Livestream',
  toc: 'Terms and conditions',
};

const AUDIENCES: ReadonlyArray<Audience> = ['all', 'employee', 'guest'];
const CONTENT_TYPES: ReadonlyArray<DocumentContentType> = ['markdown', 'pdf', 'notion'];

const EMPTY_DRAFT: Draft = {
  title: '',
  document_key: 'waiver',
  applies_to: 'all',
  content_type: 'markdown',
  body: '',
  pdf_path: '',
  notion_url: '',
  is_active: true,
  requires_acknowledgement: true,
  requires_scroll: true,
};

function rowToDraft(row: DocumentRow): Draft {
  return {
    title: row.title,
    document_key: row.document_key,
    applies_to: row.applies_to,
    content_type: row.content_type,
    body: row.body ?? '',
    pdf_path: row.pdf_path ?? '',
    notion_url: row.notion_url ?? '',
    is_active: row.is_active,
    requires_acknowledgement: row.requires_acknowledgement,
    requires_scroll: row.requires_scroll,
  };
}

interface DocumentDialogProps {
  open: boolean;
  eventId: string | null;
  document: DocumentRow | null;
  onClose: () => void;
}

export function DocumentDialog({
  open,
  eventId,
  document,
  onClose,
}: DocumentDialogProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [bodyTab, setBodyTab] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    if (!open) return;
    setDraft(document ? rowToDraft(document) : EMPTY_DRAFT);
    setBodyTab('write');
  }, [open, document]);

  const save = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No active event');
      const payload = {
        event_id: eventId,
        title: draft.title,
        document_key: draft.document_key,
        applies_to: draft.applies_to,
        content_type: draft.content_type,
        body: draft.content_type === 'markdown' ? draft.body : null,
        pdf_path: draft.content_type === 'pdf' ? draft.pdf_path : null,
        notion_url: draft.content_type === 'notion' ? draft.notion_url : null,
        is_active: draft.is_active,
        requires_acknowledgement: draft.requires_acknowledgement,
        requires_scroll: draft.requires_scroll,
      };
      if (document) return updateDocument(getSupabaseClient(), document.id, payload);
      return createDocument(getSupabaseClient(), payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
      show(t('adminDocuments.saved'));
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {document ? t('adminDocuments.edit') : t('adminDocuments.create')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="doc-title">{t('adminDocuments.fields.title')}</Label>
              <Input
                id="doc-title"
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-key">{t('adminDocuments.fields.documentKey')}</Label>
              <select
                id="doc-key"
                value={draft.document_key}
                onChange={(e) => {
                  const next = DOCUMENT_KEYS.find((k) => k === e.target.value);
                  if (next) setDraft({ ...draft, document_key: next });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {DOCUMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {DOCUMENT_KEY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-audience">{t('adminDocuments.fields.appliesTo')}</Label>
              <select
                id="doc-audience"
                value={draft.applies_to}
                onChange={(e) => {
                  const next = AUDIENCES.find((a) => a === e.target.value);
                  if (next) setDraft({ ...draft, applies_to: next });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {t(`adminDocuments.appliesTo.${a}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('documents.contentType.label')}</Label>
              <div role="tablist" className="grid grid-cols-3 gap-1 rounded-md border p-1">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    role="tab"
                    aria-selected={draft.content_type === ct}
                    onClick={() => setDraft({ ...draft, content_type: ct })}
                    className={cn(
                      'rounded-sm px-3 py-1.5 text-sm font-medium',
                      draft.content_type === ct
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {t(`documents.contentType.${ct}`)}
                  </button>
                ))}
              </div>
            </div>

            {draft.content_type === 'markdown' ? (
              <div className="md:col-span-2">
                <div role="tablist" className="mb-2 flex gap-1 rounded-md border p-1 w-fit">
                  {(['write', 'preview'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={bodyTab === mode}
                      onClick={() => setBodyTab(mode)}
                      className={cn(
                        'rounded-sm px-3 py-1 text-xs font-medium',
                        bodyTab === mode
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {t(`adminDocuments.${mode === 'write' ? 'writeMarkdown' : 'previewMarkdown'}`)}
                    </button>
                  ))}
                </div>
                {bodyTab === 'write' ? (
                  <Textarea
                    rows={14}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="font-mono text-sm"
                  />
                ) : (
                  <article className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {draft.body || '_Nothing yet._'}
                    </ReactMarkdown>
                  </article>
                )}
              </div>
            ) : null}

            {draft.content_type === 'pdf' ? (
              <div className="md:col-span-2">
                <PdfUploader
                  value={draft.pdf_path}
                  onChange={(p) => setDraft({ ...draft, pdf_path: p })}
                  label={t('documents.pdf.label')}
                />
              </div>
            ) : null}

            {draft.content_type === 'notion' ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="doc-notion">{t('documents.notion.label')}</Label>
                <Input
                  id="doc-notion"
                  type="url"
                  value={draft.notion_url}
                  onChange={(e) => setDraft({ ...draft, notion_url: e.target.value })}
                  placeholder="https://www.notion.so/..."
                />
                <p className="text-xs text-muted-foreground">{t('documents.notion.hint')}</p>
              </div>
            ) : null}

            <div className="md:col-span-2 space-y-2 border-t pt-4">
              <FlagRow
                id="doc-active"
                label={t('adminDocuments.fields.isActive')}
                checked={draft.is_active}
                onChange={(v) => setDraft({ ...draft, is_active: v })}
              />
              <FlagRow
                id="doc-requires-ack"
                label={t('adminDocuments.fields.requiresAcknowledgement')}
                checked={draft.requires_acknowledgement}
                onChange={(v) => setDraft({ ...draft, requires_acknowledgement: v })}
              />
              <FlagRow
                id="doc-requires-scroll"
                label={t('adminDocuments.fields.requiresScroll')}
                checked={draft.requires_scroll}
                onChange={(v) => setDraft({ ...draft, requires_scroll: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('adminDocuments.saving') : t('adminDocuments.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FlagRowProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function FlagRow({ id, label, checked, onChange }: FlagRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}
