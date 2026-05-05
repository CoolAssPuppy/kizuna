import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone';
import { Button } from '@/components/ui/button';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { getSupabaseClient } from '@/lib/supabase';
import { useStorageImage } from '@/lib/useStorageImage';
import { cn } from '@/lib/utils';

interface StorageImageUploaderProps {
  /** Storage bucket name. See `src/lib/storageBuckets.ts` for the four canonical buckets. */
  bucket: string;
  /** Folder prefix inside the bucket; trailing slash optional. Compose via `src/lib/storagePaths.ts` helpers when possible. */
  folder?: string;
  /** Storage path (object name) currently bound to the field, or '' when empty. */
  value: string;
  /** Called with the new path after a successful upload, or '' after clearing. */
  onChange: (path: string) => void;
  /** Optional label displayed above the dropzone. */
  label?: string;
  /** Maximum bytes; defaults to 8 MiB. */
  maxBytes?: number;
  className?: string;
}

const DEFAULT_MAX = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Form-controlled image uploader backed by the Supabase UI Dropzone. Stores
 * the resulting object path in `value`; preview is resolved via
 * `useStorageImage`. The dropzone shows the preview, file list, and an
 * Upload button under the hood.
 */
export function StorageImageUploader({
  bucket,
  folder,
  value,
  onChange,
  label,
  maxBytes = DEFAULT_MAX,
  className,
}: StorageImageUploaderProps): JSX.Element {
  const { t } = useTranslation();
  const previewUrl = useStorageImage(bucket, value);

  const upload = useSupabaseUpload({
    bucketName: bucket,
    ...(folder ? { path: folder.replace(/\/$/, '') } : {}),
    maxFiles: 1,
    maxFileSize: maxBytes,
    allowedMimeTypes: ALLOWED_TYPES,
    upsert: true,
    autoUpload: true,
    onUploadComplete: (paths) => {
      const next = paths[0];
      if (next) onChange(next);
    },
  });

  function clear(): void {
    if (!value) return;
    // onChange('') drops `value`, which disables the signed-URL query;
    // the preview clears automatically via TanStack Query.
    onChange('');
    // Best-effort delete; ignore errors so the form doesn't get stuck.
    void getSupabaseClient().storage.from(bucket).remove([value]);
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <p className="text-sm font-medium">{label}</p> : null}

      {previewUrl ? (
        <figure className="relative overflow-hidden rounded-md border bg-muted">
          <img
            src={previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[3/2] w-full object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2"
            onClick={clear}
            aria-label={t('uploader.remove')}
          >
            <X className="h-4 w-4" />
          </Button>
        </figure>
      ) : (
        <Dropzone {...upload}>
          <DropzoneEmptyState />
          <DropzoneContent />
        </Dropzone>
      )}
    </div>
  );
}
