import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  type SessionTag,
  createTag,
  deleteTag,
  fetchEventTags,
  updateTag,
} from '@/features/agenda/tagsApi';
import { getSupabaseClient } from '@/lib/supabase';

const DEFAULT_NEW_COLOR = '#3ecf8e';

interface Props {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

export function TagsDialog({ open, eventId, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);

  const { data: tags = [] } = useQuery({
    queryKey: ['agenda', 'tags', eventId],
    enabled: open,
    queryFn: () => fetchEventTags(getSupabaseClient(), eventId),
  });

  const create = useMutation({
    mutationFn: () =>
      createTag(getSupabaseClient(), {
        eventId,
        name: newName.trim(),
        color: newColor,
        position: tags.length,
      }),
    onSuccess: async () => {
      setNewName('');
      setNewColor(DEFAULT_NEW_COLOR);
      await queryClient.invalidateQueries({ queryKey: ['agenda', 'tags', eventId] });
      show(t('admin.agenda.tags.added'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const update = useMutation({
    mutationFn: (args: { id: string; patch: Partial<Pick<SessionTag, 'name' | 'color'>> }) =>
      updateTag(getSupabaseClient(), args.id, args.patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agenda', 'tags', eventId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTag(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agenda', 'tags', eventId] });
      show(t('admin.agenda.tags.deleted'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.agenda.tags.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{t('admin.agenda.tags.description')}</p>

          <ul className="space-y-2">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={tag.color}
                  onChange={(e) => update.mutate({ id: tag.id, patch: { color: e.target.value } })}
                  aria-label={t('admin.agenda.tags.colorLabel', { name: tag.name })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  defaultValue={tag.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== tag.name) {
                      update.mutate({ id: tag.id, patch: { name: value } });
                    }
                  }}
                  aria-label={t('admin.agenda.tags.nameLabel')}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => {
                    if (confirm(t('admin.agenda.tags.deleteConfirm', { name: tag.name }))) {
                      remove.mutate(tag.id);
                    }
                  }}
                  aria-label={t('actions.delete')}
                >
                  <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>

          <form
            className="flex items-end gap-2 rounded-md border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-tag-color">{t('admin.agenda.tags.color')}</Label>
              <input
                id="new-tag-color"
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-tag-name">{t('admin.agenda.tags.newName')}</Label>
              <Input
                id="new-tag-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('admin.agenda.tags.placeholder')}
              />
            </div>
            <Button type="submit" disabled={!newName.trim() || create.isPending} className="gap-2">
              <Plus aria-hidden className="h-4 w-4" />
              {t('admin.agenda.tags.add')}
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
