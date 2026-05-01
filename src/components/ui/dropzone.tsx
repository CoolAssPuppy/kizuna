import { CheckCircle, File, Loader2, Upload, X } from 'lucide-react';
import { createContext, type PropsWithChildren, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { type UseSupabaseUploadReturn } from '@/hooks/useSupabaseUpload';
import { cn } from '@/lib/utils';

/**
 * Presentational pieces for the Supabase storage dropzone, ported from
 * the official Supabase UI registry (`dropzone-react`) and adapted to
 * Kizuna's i18n + utils. Pair with `useSupabaseUpload` for the upload
 * mechanics.
 */

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0 || Number.isNaN(bytes)) return '0 bytes';
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] ?? 'bytes'}`;
}

type DropzoneContextType = Omit<UseSupabaseUploadReturn, 'getRootProps' | 'getInputProps'>;

const DropzoneContext = createContext<DropzoneContextType | undefined>(undefined);

type DropzoneProps = UseSupabaseUploadReturn & {
  className?: string;
};

export function Dropzone({
  className,
  children,
  getRootProps,
  getInputProps,
  ...rest
}: PropsWithChildren<DropzoneProps>): JSX.Element {
  const isSuccess = rest.isSuccess;
  const isActive = rest.isDragActive;
  const isInvalid =
    (rest.isDragActive && rest.isDragReject) ||
    (rest.errors.length > 0 && !rest.isSuccess) ||
    rest.files.some((file) => file.errors.length !== 0);

  return (
    <DropzoneContext.Provider value={{ ...rest }}>
      <div
        {...getRootProps({
          className: cn(
            'rounded-lg border-2 border-input bg-card p-6 text-center text-foreground transition-colors duration-200',
            className,
            isSuccess ? 'border-solid' : 'border-dashed',
            isActive && 'border-primary bg-primary/10',
            isInvalid && 'border-destructive bg-destructive/10',
          ),
        })}
      >
        <input {...getInputProps()} />
        {children}
      </div>
    </DropzoneContext.Provider>
  );
}

export function DropzoneContent({ className }: { className?: string }): JSX.Element {
  const { t } = useTranslation();
  const {
    files,
    setFiles,
    onUpload,
    loading,
    successes,
    errors,
    maxFileSize,
    maxFiles,
    isSuccess,
  } = useDropzoneContext();

  const exceedMaxFiles = files.length > maxFiles;

  const handleRemoveFile = useCallback(
    (fileName: string) => {
      setFiles(files.filter((file) => file.name !== fileName));
    },
    [files, setFiles],
  );

  if (isSuccess) {
    return (
      <div className={cn('flex flex-row items-center justify-center gap-x-2', className)}>
        <CheckCircle aria-hidden size={16} className="text-primary" />
        <p className="text-sm text-primary">
          {t('uploader.uploadedCount', { count: files.length })}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {files.map((file, idx) => {
        const fileError = errors.find((e) => e.name === file.name);
        const isUploaded = !!successes.find((e) => e === file.name);
        return (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-x-4 border-b py-2 first:mt-4 last:mb-4"
          >
            {file.type.startsWith('image/') && file.preview ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-muted">
                <img src={file.preview} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border bg-muted">
                <File aria-hidden size={18} />
              </div>
            )}
            <div className="flex shrink grow flex-col items-start truncate">
              <p title={file.name} className="max-w-full truncate text-sm">
                {file.name}
              </p>
              {file.errors.length > 0 ? (
                <p className="text-xs text-destructive">
                  {file.errors
                    .map((e) =>
                      e.message.startsWith('File is larger than')
                        ? t('uploader.tooLargeWithSize', {
                            limit: formatBytes(maxFileSize, 2),
                            size: formatBytes(file.size, 2),
                          })
                        : e.message,
                    )
                    .join(', ')}
                </p>
              ) : loading && !isUploaded ? (
                <p className="text-xs text-muted-foreground">{t('uploader.uploading')}</p>
              ) : fileError ? (
                <p className="text-xs text-destructive">
                  {t('uploader.failedWithMessage', { message: fileError.message })}
                </p>
              ) : isUploaded ? (
                <p className="text-xs text-primary">{t('uploader.uploaded')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{formatBytes(file.size, 2)}</p>
              )}
            </div>
            {!loading && !isUploaded ? (
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => handleRemoveFile(file.name)}
                aria-label={t('uploader.remove')}
              >
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        );
      })}
      {exceedMaxFiles ? (
        <p className="mt-2 text-left text-sm text-destructive">
          {t('uploader.tooManyFiles', { max: maxFiles, extra: files.length - maxFiles })}
        </p>
      ) : null}
      {files.length > 0 && !exceedMaxFiles ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onUpload()}
            disabled={files.some((file) => file.errors.length !== 0) || loading}
            className="gap-2"
          >
            {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
            {loading ? t('uploader.uploading') : t('uploader.uploadFiles')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DropzoneEmptyState({ className }: { className?: string }): JSX.Element | null {
  const { t } = useTranslation();
  const { maxFiles, maxFileSize, inputRef, isSuccess } = useDropzoneContext();
  if (isSuccess) return null;
  return (
    <div className={cn('flex flex-col items-center gap-y-2', className)}>
      <Upload aria-hidden size={20} className="text-muted-foreground" />
      <p className="text-sm">
        {maxFiles > 1 ? t('uploader.uploadMany', { count: maxFiles }) : t('uploader.uploadOne')}
      </p>
      <div className="flex flex-col items-center gap-y-1">
        <p className="text-xs text-muted-foreground">
          {t('uploader.dragOr')}{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer underline transition hover:text-foreground"
          >
            {maxFiles === 1 ? t('uploader.selectOne') : t('uploader.selectMany')}
          </button>{' '}
          {t('uploader.toUpload')}
        </p>
        {Number.isFinite(maxFileSize) ? (
          <p className="text-xs text-muted-foreground">
            {t('uploader.maxSize', { size: formatBytes(maxFileSize, 2) })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function useDropzoneContext(): DropzoneContextType {
  const context = useContext(DropzoneContext);
  if (!context) throw new Error('useDropzoneContext must be used within a Dropzone');
  return context;
}
