import { Download, FileText, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { getSupabaseClient } from '@/lib/supabase';
import { useStorageImage } from '@/lib/useStorageImage';

const MAX_BYTES = 25 * 1024 * 1024;

interface PdfUploaderProps {
  value: string;
  onChange: (path: string) => void;
  /** Event id the document belongs to. Used as the leading path segment so RLS scopes per event. */
  eventId: string;
  label?: string;
}

/**
 * PDF uploader backed by the Supabase UI Dropzone. Stores the resulting
 * object name in `value`; the consumer resolves it to a signed URL for
 * the inline iframe preview + open/download links.
 *
 * Object-name shape: `<eventId>/<filename>` — see supabase/schemas/95_storage.sql.
 */
export function PdfUploader({ value, onChange, eventId, label }: PdfUploaderProps): JSX.Element {
  const { t } = useTranslation();
  const signedUrl = useStorageImage('documents', value);

  const upload = useSupabaseUpload({
    bucketName: 'documents',
    path: eventId,
    maxFiles: 1,
    maxFileSize: MAX_BYTES,
    allowedMimeTypes: ['application/pdf'],
    onUploadComplete: (paths) => {
      const next = paths[0];
      if (next) onChange(next);
    },
  });

  function clear(): void {
    if (!value) return;
    onChange('');
    void getSupabaseClient().storage.from('documents').remove([value]);
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
              onClick={clear}
              aria-label={t('uploader.remove')}
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
        <Dropzone {...upload}>
          <DropzoneEmptyState />
          <DropzoneContent />
        </Dropzone>
      )}
    </div>
  );
}
