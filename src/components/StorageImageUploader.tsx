import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface StorageImageUploaderProps {
  /** Storage bucket name (e.g. 'feed-images', 'event-covers'). */
  bucket: string;
  /** Folder prefix inside the bucket; trailing slash optional. */
  folder?: string;
  /** Storage path (object name) currently bound to the field, or '' when empty. */
  value: string;
  /** Called with the new path after a successful upload, or '' after clearing. */
  onChange: (path: string) => void;
  /** Optional label displayed above the dropzone. */
  label?: string;
  /** Optional accept attribute, defaults to common image types. */
  accept?: string;
  /** Maximum bytes; defaults to 8 MiB. */
  maxBytes?: number;
  className?: string;
}

const DEFAULT_MAX = 8 * 1024 * 1024;
const DEFAULT_ACCEPT = 'image/png, image/jpeg, image/webp, image/gif';

/**
 * Drag-and-drop dropzone backed by Supabase Storage. Stores the object name
 * (path inside the bucket) in `value`. The caller is responsible for resolving
 * that path to a signed URL when displaying the image.
 */
export function StorageImageUploader({
  bucket,
  folder,
  value,
  onChange,
  label,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX,
  className,
}: StorageImageUploaderProps): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Resolve a signed URL whenever `value` changes so the preview reflects what
  // the form actually has bound. Uses 1h TTL — safe for editor sessions.
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    void (async () => {
      const { data } = await getSupabaseClient().storage.from(bucket).createSignedUrl(value, 3600);
      if (!cancelled) setPreviewUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, bucket]);

  async function uploadFile(file: File): Promise<void> {
    if (file.size > maxBytes) {
      show(t('uploader.tooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }), 'error');
      return;
    }
    if (accept && !accept.split(',').some((a) => file.type === a.trim())) {
      show(t('uploader.unsupportedType'), 'error');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const prefix = folder ? folder.replace(/\/$/, '') + '/' : '';
      const path = `${prefix}${crypto.randomUUID()}.${ext}`;
      const { error } = await getSupabaseClient()
        .storage.from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
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
      // Best-effort: ignore errors on missing/already-deleted objects.
      await getSupabaseClient().storage.from(bucket).remove([value]);
    } finally {
      onChange('');
      setBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <p className="text-sm font-medium">{label}</p> : null}

      {previewUrl ? (
        <figure className="relative overflow-hidden rounded-md border bg-muted">
          <img
            src={previewUrl}
            alt=""
            className="aspect-[3/2] w-full object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2"
            onClick={() => void clear()}
            disabled={busy}
            aria-label={t('uploader.remove')}
          >
            <X className="h-4 w-4" />
          </Button>
        </figure>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-muted/30 px-4 py-8 text-center text-sm transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30',
          )}
        >
          {busy ? (
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon aria-hidden className="h-6 w-6 text-muted-foreground" />
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
            {t('uploader.limits', { mb: Math.round(maxBytes / 1024 / 1024) })}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
