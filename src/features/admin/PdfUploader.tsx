import { Download, FileText, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import { useStorageImage } from '@/lib/useStorageImage';

const MAX_BYTES = 25 * 1024 * 1024;

interface PdfUploaderProps {
  value: string;
  onChange: (path: string) => void;
  label?: string;
}

/**
 * Drag-and-drop dropzone backed by the `documents` Storage bucket. Stores
 * the object name in `value`; consumer is responsible for resolving it to a
 * signed URL when displaying the document.
 */
export function PdfUploader({ value, onChange, label }: PdfUploaderProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const signedUrl = useStorageImage('documents', value);

  async function uploadFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
      show(t('uploader.unsupportedType'), 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      show(t('uploader.tooLarge', { mb: Math.round(MAX_BYTES / 1024 / 1024) }), 'error');
      return;
    }
    setBusy(true);
    try {
      const path = `${crypto.randomUUID()}.pdf`;
      const { error } = await getSupabaseClient()
        .storage.from('documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (error) throw error;
      onChange(path);
      show(t('uploader.success'));
    } catch (e) {
      show((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function clear(): Promise<void> {
    if (!value) return;
    setBusy(true);
    try {
      await getSupabaseClient().storage.from('documents').remove([value]);
    } finally {
      onChange('');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {label ? <p className="text-sm font-medium">{label}</p> : null}

      {value ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-start gap-3">
            <FileText aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{value}</p>
              {signedUrl ? (
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Upload aria-hidden className="h-3 w-3 rotate-180" />
                    {t('documents.pdf.openInNewTab')}
                  </a>
                  <a
                    href={signedUrl}
                    download
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Download aria-hidden className="h-3 w-3" />
                    {t('documents.pdf.download')}
                  </a>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => void clear()}
              disabled={busy}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {signedUrl ? (
            <iframe
              src={signedUrl}
              title="PDF preview"
              className="h-96 w-full rounded-md border bg-background"
            />
          ) : null}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void uploadFile(file);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-muted/30 px-4 py-8 text-center text-sm transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
          }`}
        >
          {busy ? (
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <FileText aria-hidden className="h-6 w-6 text-muted-foreground" />
          )}
          <p className="text-muted-foreground">{t('uploader.dropOrClick')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="gap-2"
          >
            <Upload aria-hidden className="h-3.5 w-3.5" />
            {t('uploader.choose')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('uploader.limits', { mb: Math.round(MAX_BYTES / 1024 / 1024) })}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
