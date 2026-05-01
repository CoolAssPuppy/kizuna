import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { getSupabaseClient } from '@/lib/supabase';

import { ITEM_META } from './itemMeta';
import type { ItineraryItemRow } from './types';

interface Props {
  item: ItineraryItemRow | null;
  onClose: () => void;
}

function formatLocal(iso: string | null, tz: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(tz && tz !== 'UTC' ? { timeZone: tz } : {}),
  }).format(new Date(iso));
}

/**
 * Edit-itinerary-element dialog.
 *
 * Click an itinerary card -> this dialog opens. The non-editable
 * details (title, subtitle, time window) render greyed out so the
 * user understands they're system-managed. The "Special requests"
 * textarea is the only editable field; it persists via two
 * SECURITY DEFINER RPCs:
 *   - update_accommodation_special_requests for item_type='accommodation'
 *   - update_transport_request_special_requests for item_type='transport'
 *
 * Other item types (session, flight, announcement, reminder) render
 * with no editable fields.
 */
export function EditItineraryElementDialog({ item, onClose }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState('');

  // The dialog is mounted unconditionally and gated on `item != null`
  // by the parent. We don't pre-fill from a fetched special_requests
  // today — the textarea opens empty and any existing requests are
  // overwritten on save. (Future: useQuery against accommodations or
  // transport_requests to display the current value.)

  const supportsRequests = item?.item_type === 'accommodation' || item?.item_type === 'transport';

  const save = useMutation({
    mutationFn: async () => {
      if (!item || !item.source_id) throw new Error('missing source row');
      const client = getSupabaseClient();
      // Each item_type has its own SECURITY DEFINER RPC. Both share the
      // same shape (caller-scoped write + error), so we pick the call and
      // unwrap it once.
      let result;
      if (item.item_type === 'accommodation') {
        result = await client.rpc('update_accommodation_special_requests', {
          p_accommodation_id: item.source_id,
          p_requests: requests,
        });
      } else if (item.item_type === 'transport') {
        result = await client.rpc('update_transport_request_special_requests', {
          p_request_id: item.source_id,
          p_requests: requests,
        });
      } else {
        throw new Error(`item_type ${item.item_type} is read-only`);
      }
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['itinerary'] });
      show(t('itinerary.edit.saved'));
      onClose();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!item) return null;
  const meta = ITEM_META[item.item_type];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          setRequests('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('itinerary.edit.title')}</DialogTitle>
          <DialogDescription>
            {t(`itinerary.itemTypes.${item.item_type}`)}
            {' · '}
            {supportsRequests ? t('itinerary.edit.editableHint') : t('itinerary.edit.readOnlyHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ReadOnlyField
            label={t('itinerary.edit.titleField')}
            value={item.title}
            Icon={meta.Icon}
          />
          {item.subtitle ? (
            <ReadOnlyField label={t('itinerary.edit.subtitleField')} value={item.subtitle} />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadOnlyField
              label={t('itinerary.edit.startsAt')}
              value={formatLocal(item.starts_at, item.starts_tz)}
            />
            <ReadOnlyField
              label={t('itinerary.edit.endsAt')}
              value={formatLocal(item.ends_at, item.ends_tz ?? item.starts_tz)}
            />
          </div>

          {supportsRequests ? (
            <div className="space-y-2">
              <Label htmlFor="special-requests">{t('itinerary.edit.specialRequests')}</Label>
              <Textarea
                id="special-requests"
                rows={4}
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                placeholder={t('itinerary.edit.specialRequestsPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('itinerary.edit.specialRequestsHint')}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRequests('');
              onClose();
            }}
            disabled={save.isPending}
          >
            {t('common.cancel')}
          </Button>
          {supportsRequests ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t('itinerary.edit.saving') : t('itinerary.edit.save')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyField({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon?: (typeof ITEM_META)[keyof typeof ITEM_META]['Icon'];
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {Icon ? <Icon aria-hidden className="h-4 w-4" /> : null}
        <span className="truncate">{value || '—'}</span>
      </div>
    </div>
  );
}
