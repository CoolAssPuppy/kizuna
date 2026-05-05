import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StorageImageUploader } from '@/components/StorageImageUploader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { createSwagItem, updateSwagItem, type SwagItemRow } from '@/features/registration/api/swag';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { SIZE_TEMPLATES, type SizeTemplate } from './sizeTemplates';

interface FormState {
  name: string;
  description: string;
  imagePath: string;
  sizeImagePath: string;
  isHidden: boolean;
  allowsOptOut: boolean;
  sizes: string[];
}

function fromRow(item: SwagItemRow | null): FormState {
  if (!item) {
    return {
      name: '',
      description: '',
      imagePath: '',
      sizeImagePath: '',
      isHidden: false,
      allowsOptOut: true,
      sizes: [],
    };
  }
  return {
    name: item.name,
    description: item.description ?? '',
    imagePath: item.image_path ?? '',
    sizeImagePath: item.size_image_path ?? '',
    isHidden: item.is_hidden,
    allowsOptOut: item.allows_opt_out,
    sizes: item.sizes,
  };
}

interface Props {
  eventId: string;
  /** null when creating; the row when editing. */
  item: SwagItemRow | null;
  onClose: () => void;
}

export function SwagItemDialog({ eventId, item, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const isEdit = item !== null;
  // Mint the row's uuid up front for new items so the
  // StorageImageUploader can write to the final
  // `<event>/swag/<id>/` folder before the row exists. The insert
  // reuses this id so the persisted image_path resolves cleanly
  // afterwards. crypto.randomUUID() matches what Postgres' default
  // uses, so the row id is shaped the same way either way.
  const [itemId] = useState<string>(() => item?.id ?? crypto.randomUUID());
  const [form, setForm] = useState<FormState>(() => fromRow(item));
  const [draftSize, setDraftSize] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const client = getSupabaseClient();
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imagePath: form.imagePath || null,
        sizeImagePath: form.sizeImagePath || null,
        isHidden: form.isHidden,
        allowsOptOut: form.allowsOptOut,
        sizes: form.sizes,
      };
      if (isEdit) {
        await updateSwagItem(client, item.id, {
          name: payload.name,
          description: payload.description,
          image_path: payload.imagePath,
          size_image_path: payload.sizeImagePath,
          is_hidden: payload.isHidden,
          allows_opt_out: payload.allowsOptOut,
          sizes: payload.sizes,
        });
      } else {
        await createSwagItem(client, { id: itemId, eventId, ...payload });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'swag-items'] });
      await queryClient.invalidateQueries({ queryKey: ['swag-items'] });
      show(isEdit ? t('adminSwag.updated') : t('adminSwag.created'));
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const submitDisabled = save.isPending || form.name.trim().length === 0;

  function applyTemplate(templateId: SizeTemplate['id']): void {
    const template = SIZE_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!template) return;
    setForm((prev) => {
      const merged = [...prev.sizes];
      for (const size of template.sizes) {
        if (!merged.includes(size)) merged.push(size);
      }
      return { ...prev, sizes: merged };
    });
  }

  function addSize(): void {
    const next = draftSize.trim();
    if (!next) return;
    setForm((prev) =>
      prev.sizes.includes(next) ? prev : { ...prev, sizes: [...prev.sizes, next] },
    );
    setDraftSize('');
  }

  function removeSize(size: string): void {
    setForm((prev) => ({ ...prev, sizes: prev.sizes.filter((s) => s !== size) }));
  }

  // Storage folder anchor — the same uuid the row will get on save so
  // the persisted image_path matches the bytes uploaded earlier.
  const folder = `${eventId}/swag/${itemId}`;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('adminSwag.editTitle') : t('adminSwag.newItem')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitDisabled) save.mutate();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label htmlFor="swag-name">{t('adminSwag.fields.name')}</Label>
            <Input
              id="swag-name"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="swag-description">{t('adminSwag.fields.description')}</Label>
            <Textarea
              id="swag-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StorageImageUploader
              bucket="event-content"
              folder={folder}
              value={form.imagePath}
              onChange={(path) => setForm((prev) => ({ ...prev, imagePath: path }))}
              label={t('adminSwag.fields.image')}
            />
            <StorageImageUploader
              bucket="event-content"
              folder={folder}
              value={form.sizeImagePath}
              onChange={(path) => setForm((prev) => ({ ...prev, sizeImagePath: path }))}
              label={t('adminSwag.fields.sizeImage')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('adminSwag.fields.sizes')}</Label>
            <p className="text-xs text-muted-foreground">{t('adminSwag.sizesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {SIZE_TEMPLATES.map((tpl) => (
                <Button
                  key={tpl.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {t(tpl.labelKey)}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {form.sizes.map((size) => (
                <span
                  key={size}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border bg-muted/50',
                    'px-2 py-0.5 text-sm',
                  )}
                >
                  {size}
                  <button
                    type="button"
                    onClick={() => removeSize(size)}
                    aria-label={t('adminSwag.removeSize', { size })}
                    className="rounded-full p-0.5 hover:bg-background"
                  >
                    <X aria-hidden className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {form.sizes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('adminSwag.noSizes')}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t('adminSwag.addSizePlaceholder')}
                value={draftSize}
                onChange={(e) => setDraftSize(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSize();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSize}>
                {t('adminSwag.addSize')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="swag-hidden" className="flex items-start gap-2 text-sm">
              <Checkbox
                id="swag-hidden"
                checked={form.isHidden}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isHidden: checked === true }))
                }
              />
              <span>
                <span className="font-medium">{t('adminSwag.fields.hidden')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('adminSwag.fields.hiddenHint')}
                </span>
              </span>
            </label>
            <label htmlFor="swag-allows-opt-out" className="flex items-start gap-2 text-sm">
              <Checkbox
                id="swag-allows-opt-out"
                checked={form.allowsOptOut}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, allowsOptOut: checked === true }))
                }
              />
              <span>
                <span className="font-medium">{t('adminSwag.fields.optOut')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('adminSwag.fields.optOutHint')}
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {save.isPending ? t('registration.saving') : t('actions.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
