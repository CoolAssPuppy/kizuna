import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/AuthContext';

import { type AttendeeSearchResult } from './api';
import { useUploadPhoto } from './hooks';
import { processImage } from './imageProcess';

/**
 * State machine for the photo upload dialog. Owns:
 *   - draft items (file, preview URL, caption, taggees)
 *   - which draft is currently being edited
 *   - submit logic (image processing + serial upload)
 *   - object URL cleanup
 *
 * Pulled out of PhotoUploadDialog so the dialog itself is presentation
 * only and the state can be tested without mounting Radix portals.
 */

export interface DraftItem {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  tagged: AttendeeSearchResult[];
}

export const PHOTO_UPLOAD_MAX_FILES = 10;
export const PHOTO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPE = /^image\/(jpeg|png|webp|heic|heif)$/;

export interface UsePhotoUploadResult {
  items: DraftItem[];
  activeId: string | null;
  active: DraftItem | null;
  setActiveId: (id: string | null) => void;
  pick: (files: FileList | null) => void;
  removeItem: (id: string) => void;
  updateCaption: (id: string, caption: string) => void;
  addTag: (id: string, person: AttendeeSearchResult) => void;
  removeTag: (id: string, userId: string) => void;
  /** Returns true on full success, false when at least one upload failed. */
  submit: () => Promise<boolean>;
  isUploading: boolean;
}

export function usePhotoUpload(eventId: string): UsePhotoUploadResult {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const upload = useUploadPhoto();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(() => items.find((i) => i.id === activeId) ?? null, [items, activeId]);

  // Object URLs created in pick() are revoked when the hook unmounts or
  // a draft is removed. Keeping the cleanup here means the consumer
  // doesn't have to think about leaked URLs.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    return () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = useCallback(
    (picked: FileList | null) => {
      if (!picked || picked.length === 0) return;
      const drafts: DraftItem[] = [];
      let rejectedType = false;
      let rejectedSize = false;
      for (const file of Array.from(picked)) {
        if (drafts.length + items.length >= PHOTO_UPLOAD_MAX_FILES) break;
        if (!ALLOWED_TYPE.test(file.type)) {
          rejectedType = true;
          continue;
        }
        if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
          rejectedSize = true;
          continue;
        }
        drafts.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: '',
          tagged: [],
        });
      }
      if (rejectedType) show(t('photos.upload.errors.type'), 'error');
      if (rejectedSize) show(t('photos.upload.errors.size', { max: '25 MB' }), 'error');
      if (drafts.length === 0) return;
      setItems((prev) => [...prev, ...drafts]);
      setActiveId((prev) => prev ?? drafts[0]?.id ?? null);
    },
    [items.length, show, t],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    setActiveId((prev) => {
      if (prev !== id) return prev;
      return null;
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const updateCaption = useCallback(
    (id: string, caption: string) => updateItem(id, { caption }),
    [updateItem],
  );

  const addTag = useCallback((id: string, person: AttendeeSearchResult) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (i.tagged.some((p) => p.user_id === person.user_id)) return i;
        return { ...i, tagged: [...i.tagged, person] };
      }),
    );
  }, []);

  const removeTag = useCallback(
    (id: string, userId: string) =>
      updateItem(id, {
        tagged: items.find((i) => i.id === id)?.tagged.filter((p) => p.user_id !== userId) ?? [],
      }),
    [items, updateItem],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (items.length === 0 || !user) return false;
    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const processed = await processImage(item.file);
        await upload.mutateAsync({
          eventId,
          uploaderId: user.id,
          original: processed.original,
          preview: processed.preview,
          thumb: processed.thumb,
          width: processed.width,
          height: processed.height,
          caption: item.caption,
          taggedUserIds: item.tagged.map((tag) => tag.user_id),
        });
        succeeded += 1;
      } catch (err) {
        console.error('[kizuna] photo upload failed', err);
        failed += 1;
      }
    }
    if (succeeded > 0) {
      show(t('photos.upload.successCount', { count: succeeded }));
    }
    if (failed > 0) {
      show(t('photos.upload.errors.someFailed', { count: failed }), 'error');
      return false;
    }
    return true;
  }, [eventId, items, show, t, upload, user]);

  return {
    items,
    activeId,
    active,
    setActiveId,
    pick,
    removeItem,
    updateCaption,
    addTag,
    removeTag,
    submit,
    isUploading: upload.isPending,
  };
}
