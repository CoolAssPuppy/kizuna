import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, GripVertical, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import {
  deleteSwagItem,
  loadSwagItemsAll,
  reorderSwagItems,
  setSwagLock,
  type SwagItemRow,
} from '@/features/registration/api/swag';
import { useDragReorder, type DragRowProps } from '@/hooks/useDragReorder';
import { useStorageImage } from '@/lib/useStorageImage';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { SwagItemDialog } from './SwagItemDialog';

export function SwagAdminScreen(): JSX.Element {
  const { t } = useTranslation();
  const { data: event } = useActiveEvent();
  const eventId = event?.id ?? null;
  const queryClient = useQueryClient();
  const { show } = useToast();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items } = useQuery({
    queryKey: ['admin', 'swag-items', eventId],
    enabled: eventId !== null,
    queryFn: () => loadSwagItemsAll(getSupabaseClient(), eventId!),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSwagItem(getSupabaseClient(), id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'swag-items'] });
      show(t('adminSwag.deleted'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const lock = useMutation({
    mutationFn: (next: boolean) => setSwagLock(getSupabaseClient(), eventId!, next),
    onSuccess: async (_data, next) => {
      await queryClient.invalidateQueries({ queryKey: ['active-event'] });
      show(next ? t('adminSwag.locked') : t('adminSwag.unlocked'));
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => reorderSwagItems(getSupabaseClient(), orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'swag-items'] }),
    onError: (err: Error) => show(err.message, 'error'),
  });

  const isLocked = event?.swag_locked_at != null;
  const { dragId, rowProps } = useDragReorder(
    items ?? [],
    (orderedIds) => reorder.mutate(orderedIds),
    isLocked,
  );

  if (!event) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  const dialogOpen = creating || editingId !== null;
  const editing = editingId ? items?.find((i) => i.id === editingId) : null;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('adminSwag.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('adminSwag.subtitle')}</p>
          {isLocked ? (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              <Lock aria-hidden className="h-3 w-3" />
              {t('adminSwag.lockedAt', {
                date: new Date(event.swag_locked_at!).toLocaleString(),
              })}
            </p>
          ) : null}
        </div>
        <Button onClick={() => setCreating(true)} disabled={isLocked} className="gap-2 self-start">
          <Plus aria-hidden className="h-4 w-4" />
          {t('adminSwag.newItem')}
        </Button>
      </header>

      {!items || items.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {t('adminSwag.empty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <SwagAdminRow
              key={item.id}
              item={item}
              dragging={dragId === item.id}
              rowProps={rowProps(item.id)}
              onEdit={() => setEditingId(item.id)}
              onDelete={() => {
                void (async () => {
                  if (
                    await confirm({
                      titleKey: 'adminSwag.deleteConfirm',
                      titleValues: { name: item.name },
                      destructive: true,
                    })
                  ) {
                    remove.mutate(item.id);
                  }
                })();
              }}
              disabled={isLocked}
            />
          ))}
        </ul>
      )}

      <div className="flex justify-end pt-2">
        <div className="flex w-fit flex-col items-stretch gap-1">
          <Button
            variant="secondary"
            onClick={() => lock.mutate(!isLocked)}
            disabled={lock.isPending}
            className="gap-2"
          >
            <Lock aria-hidden className="h-4 w-4" />
            {isLocked ? t('adminSwag.unlock') : t('adminSwag.lock')}
          </Button>
          <p className="text-right text-xs leading-snug text-muted-foreground">
            {t('adminSwag.lockHint')}
          </p>
        </div>
      </div>

      {dialogOpen && eventId ? (
        <SwagItemDialog
          eventId={eventId}
          item={editing ?? null}
          onClose={() => {
            setCreating(false);
            setEditingId(null);
          }}
        />
      ) : null}
    </section>
  );
}

interface SwagAdminRowProps {
  item: SwagItemRow;
  dragging: boolean;
  rowProps: DragRowProps;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}

function SwagAdminRow({
  item,
  dragging,
  rowProps,
  onEdit,
  onDelete,
  disabled,
}: SwagAdminRowProps): JSX.Element {
  const { t } = useTranslation();
  const cover = useStorageImage('event-content', item.image_path ?? '');
  return (
    <li
      {...rowProps}
      className={cn(
        'flex items-start gap-6 rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm',
        dragging ? 'opacity-60' : null,
      )}
    >
      <GripVertical
        aria-hidden
        className={cn(
          'mt-2 h-4 w-4 shrink-0 text-muted-foreground',
          disabled ? 'cursor-not-allowed' : 'cursor-grab',
        )}
      />
      {cover ? (
        <img src={cover} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-md bg-muted" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{item.name}</h3>
          {item.is_hidden ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <EyeOff aria-hidden className="h-3 w-3" />
              {t('adminSwag.badges.hidden')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
              <Eye aria-hidden className="h-3 w-3" />
              {t('adminSwag.badges.visible')}
            </span>
          )}
          {item.allows_opt_out ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t('adminSwag.badges.optOut')}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {item.sizes.length === 0 ? t('adminSwag.noSizes') : item.sizes.join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          disabled={disabled}
          aria-label={t('adminSwag.edit', { name: item.name })}
        >
          <Pencil aria-hidden className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={disabled}
          aria-label={t('adminSwag.deleteAria', { name: item.name })}
        >
          <Trash2 aria-hidden className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
