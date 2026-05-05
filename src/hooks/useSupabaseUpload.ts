import { useCallback, useEffect, useMemo, useState } from 'react';
import { type FileError, type FileRejection, useDropzone } from 'react-dropzone';

import { getSupabaseClient } from '@/lib/supabase';

/**
 * Adapted from the Supabase UI registry block (`dropzone-react`). Wraps
 * `react-dropzone` and pushes accepted files to Supabase Storage on demand,
 * tracking per-file successes and errors. Caller decides when to upload
 * (`onUpload()`) so the form can hold a Save button at the bottom-right
 * of its CardShell rather than the dropzone uploading immediately.
 *
 * Differences from the upstream block:
 *  - Reads the supabase client via our singleton accessor instead of
 *    re-creating one per hook instance (matches the rest of Kizuna).
 *  - Adds `onUploadComplete(paths)` so the parent can react to a finished
 *    upload (e.g. write the resulting object path into form state).
 */

export interface FileWithPreview extends File {
  preview?: string;
  errors: readonly FileError[];
}

export interface UseSupabaseUploadOptions {
  bucketName: string;
  /** Folder inside the bucket. e.g. `userId` -> uploads to `userId/file.png`. */
  path?: string;
  allowedMimeTypes?: string[];
  /** Bytes. Defaults to no limit. */
  maxFileSize?: number;
  maxFiles?: number;
  /** CDN cache control max-age in seconds. */
  cacheControl?: number;
  upsert?: boolean;
  /**
   * Called after all files in a batch have been uploaded successfully.
   * Receives the list of object paths inside the bucket so callers can
   * persist the path on the form (e.g. `feed_items.image_path`).
   */
  onUploadComplete?: (objectPaths: string[]) => void;
  /**
   * When true, files start uploading as soon as the user drops them
   * instead of waiting for an explicit "Upload" button click. Use it
   * for surfaces where the form's primary action is "Save" — users
   * (reasonably) expect the dropped image to already be saved by the
   * time they hit Save.
   */
  autoUpload?: boolean;
}

export type UseSupabaseUploadReturn = ReturnType<typeof useSupabaseUpload>;

export function useSupabaseUpload(options: UseSupabaseUploadOptions) {
  const {
    bucketName,
    path,
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
    cacheControl = 3600,
    upsert = false,
    onUploadComplete,
    autoUpload = false,
  } = options;

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [successes, setSuccesses] = useState<string[]>([]);

  const isSuccess = useMemo(() => {
    if (errors.length === 0 && successes.length === 0) return false;
    if (errors.length === 0 && successes.length === files.length) return true;
    return false;
  }, [errors.length, successes.length, files.length]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const validFiles = acceptedFiles
        .filter((file) => !files.find((x) => x.name === file.name))
        .map((file) => {
          const f = file as FileWithPreview;
          f.preview = URL.createObjectURL(file);
          f.errors = [];
          return f;
        });

      const invalidFiles = fileRejections.map(({ file, errors: fileErrors }) => {
        const f = file as FileWithPreview;
        f.preview = URL.createObjectURL(file);
        f.errors = fileErrors;
        return f;
      });

      setFiles([...files, ...validFiles, ...invalidFiles]);
    },
    [files],
  );

  const dropzoneProps = useDropzone({
    onDrop,
    noClick: true,
    accept: allowedMimeTypes.reduce<Record<string, string[]>>(
      (acc, type) => ({ ...acc, [type]: [] }),
      {},
    ),
    maxSize: maxFileSize,
    maxFiles,
    multiple: maxFiles !== 1,
  });

  const onUpload = useCallback(async () => {
    setLoading(true);
    const filesWithErrors = errors.map((x) => x.name);
    const filesToUpload =
      filesWithErrors.length > 0
        ? [
            ...files.filter((f) => filesWithErrors.includes(f.name)),
            ...files.filter((f) => !successes.includes(f.name)),
          ]
        : files;

    const client = getSupabaseClient();
    const responses = await Promise.all(
      filesToUpload.map(async (file) => {
        const objectPath = path ? `${path}/${file.name}` : file.name;
        const { error } = await client.storage.from(bucketName).upload(objectPath, file, {
          cacheControl: cacheControl.toString(),
          upsert,
        });
        return error
          ? { name: file.name, path: objectPath, message: error.message }
          : { name: file.name, path: objectPath, message: undefined };
      }),
    );

    const responseErrors = responses
      .filter((r) => r.message !== undefined)
      .map((r) => ({ name: r.name, message: r.message ?? '' }));
    setErrors(responseErrors);

    const responseSuccesses = responses.filter((r) => r.message === undefined);
    const newSuccesses = Array.from(
      new Set([...successes, ...responseSuccesses.map((r) => r.name)]),
    );
    setSuccesses(newSuccesses);
    setLoading(false);

    if (onUploadComplete && responseSuccesses.length > 0) {
      onUploadComplete(responseSuccesses.map((r) => r.path));
    }
  }, [files, path, bucketName, errors, successes, cacheControl, upsert, onUploadComplete]);

  // useEffect (not useMountEffect): reconciles file errors when the
  // user adds/removes via dropzone. Lifting this into setFiles call
  // sites would require restructuring the hook — pragmatic exception.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (files.length === 0) {
      setErrors([]);
    }
    if (files.length <= maxFiles) {
      let changed = false;
      const nextFiles = files.map((file) => {
        if (file.errors.some((e) => e.code === 'too-many-files')) {
          file.errors = file.errors.filter((e) => e.code !== 'too-many-files');
          changed = true;
        }
        return file;
      });
      if (changed) setFiles(nextFiles);
    }
  }, [files, maxFiles]);

  // Auto-upload kicks off as soon as a clean, valid file is staged.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!autoUpload) return;
    if (loading) return;
    if (files.length === 0) return;
    if (files.some((file) => file.errors.length > 0)) return;
    const allUploaded = files.every((file) => successes.includes(file.name));
    if (allUploaded) return;
    void onUpload();
  }, [autoUpload, files, loading, successes, onUpload]);

  return {
    files,
    setFiles,
    successes,
    isSuccess,
    loading,
    errors,
    setErrors,
    onUpload,
    maxFileSize,
    maxFiles,
    allowedMimeTypes,
    ...dropzoneProps,
  };
}
