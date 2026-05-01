import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone';
import { Button } from '@/components/ui/button';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
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
  /** Maximum bytes; defaults to 8 MiB. */
  maxBytes?: number;
  className?: string;
}

const DEFAULT_MAX = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Form-controlled image uploader backed by the Supabase UI Dropzone. Stores
 * the resulting object path in `value`; callers resolve to a signed URL for
 * display via useStorageImage. The dropzone shows the preview, file list,
 * and an Upload button under the hood.
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
  const { data: previewUrl = null } = useQuery({
    queryKey: ['storage-signed-url', bucket, value],
    enabled: !!value,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      if (!value) return null;
      const { data } = await getSupabaseClient().storage.from(bucket).createSignedUrl(value, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const upload = useSupabaseUpload({
    bucketName: bucket,
    ...(folder ? { path: folder.replace(/\/$/, '') } : {}),
    maxFiles: 1,
    maxFileSize: maxBytes,
    allowedMimeTypes: ALLOWED_TYPES,
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
          <img src={previewUrl} alt="" className="aspect-[3/2] w-full object-cover" />
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
