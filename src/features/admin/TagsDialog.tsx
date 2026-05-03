import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
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
import { useToast } from '@/components/ui/toast';
import {
  type SessionTag,
  createTag,
  deleteTag,
  fetchEventTags,
  updateTag,
} from '@/features/agenda/tagsApi';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const DEFAULT_NEW_COLOR = '#3ecf8e';
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

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
    mutationFn: (args: {
      id: string;
      patch: Partial<Pick<SessionTag, 'name' | 'color' | 'position'>>;
    }) => updateTag(getSupabaseClient(), args.id, args.patch),
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

  // Swap positions with the neighbour above/below so the visible order
  // mirrors the persisted `position` field. We rewrite both rows so
  // ties never form.
  function move(index: number, direction: -1 | 1): void {
    const target = tags[index + direction];
    const current = tags[index];
    if (!target || !current) return;
    update.mutate({ id: current.id, patch: { position: target.position } });
    update.mutate({ id: target.id, patch: { position: current.position } });
  }

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
          <ul className="space-y-2">
            {tags.map((tag, index) => (
              <li key={tag.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-6"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={t('admin.agenda.tags.moveUp', { name: tag.name })}
                  >
                    <ArrowUp aria-hidden className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-6"
                    disabled={index === tags.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t('admin.agenda.tags.moveDown', { name: tag.name })}
                  >
                    <ArrowDown aria-hidden className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ColorField
                  value={tag.color}
                  onCommit={(color) => update.mutate({ id: tag.id, patch: { color } })}
                  ariaLabel={t('admin.agenda.tags.colorLabel', { name: tag.name })}
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
            className="flex items-center gap-2 rounded-md border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              create.mutate();
            }}
          >
            <ColorField
              value={newColor}
              onCommit={setNewColor}
              ariaLabel={t('admin.agenda.tags.newColorLabel')}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('admin.agenda.tags.placeholder')}
              aria-label={t('admin.agenda.tags.nameLabel')}
              className="flex-1"
            />
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

interface ColorFieldProps {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
}

/**
 * Color swatch + hex input bound to the same value. The native picker
 * fires `change` when the user finishes (so we don't churn with every
 * cursor move); the text field commits on blur or Enter and validates
 * against #rrggbb. Anything invalid silently snaps back to the last
 * good value so a stray keystroke can't poison the row.
 */
function ColorField({ value, onCommit, ariaLabel }: ColorFieldProps): JSX.Element {
  const [hex, setHex] = useState(value);
  // Keep local state in sync when the parent's value changes (e.g. after
  // a successful save). Render-time sync avoids a banned useEffect.
  if (hex !== value && !document.activeElement?.matches('input[type="text"]')) {
    setHex(value);
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        aria-label={ariaLabel}
        className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
      />
      <Input
        type="text"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => {
          if (HEX_PATTERN.test(hex) && hex.toLowerCase() !== value.toLowerCase()) {
            onCommit(hex.toLowerCase());
          } else {
            setHex(value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        spellCheck={false}
        aria-label={ariaLabel}
        className={cn('h-9 w-24 font-mono text-xs')}
      />
    </div>
  );
}
