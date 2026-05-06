import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StorageImageUploader } from '@/components/StorageImageUploader';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { STORAGE_BUCKETS } from '@/lib/storageBuckets';
import { eventAboutFolder } from '@/lib/storagePaths';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import {
  createEvent,
  deleteEvent,
  fetchEventById,
  updateEvent,
  type EventInsert,
} from './api/events';
import { DomainsInput } from './DomainsInput';

interface EventEditScreenProps {
  /**
   * Override the URL-derived id. The admin About tab passes the active
   * event so the same form renders without needing an /admin/events/:id
   * URL hop. Omitted -> the URL params drive (existing /admin/events
   * routes).
   */
  eventId?: string | null;
  /** When true, render without the destructive Delete button (used in About tab). */
  hideDelete?: boolean;
  /** When true, suppress the inner section header — the host (e.g. a Dialog) provides its own title. */
  hideHeader?: boolean;
  /** Override the post-save destination. Default: /admin/events/:id. */
  redirectTo?: ((id: string) => string) | undefined;
}

type EventTypeEnum = Database['public']['Enums']['event_type'];

interface FormState {
  name: string;
  subtitle: string;
  type: EventTypeEnum;
  location: string;
  time_zone: string;
  start_date: string;
  end_date: string;
  reg_opens_at: string;
  reg_closes_at: string;
  hero_image_path: string;
  logo_path: string;
  invite_all_employees: boolean;
  allowed_domains: string[];
  is_active: boolean;
}

const EMPTY: FormState = {
  name: '',
  subtitle: '',
  type: 'company_offsite',
  location: '',
  time_zone: 'UTC',
  start_date: '',
  end_date: '',
  reg_opens_at: '',
  reg_closes_at: '',
  hero_image_path: '',
  logo_path: '',
  invite_all_employees: false,
  allowed_domains: [],
  is_active: false,
};

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function fromIso(value: string | null): string {
  if (!value) return '';
  // datetime-local needs YYYY-MM-DDTHH:mm
  return new Date(value).toISOString().slice(0, 16);
}

export function EventEditScreen({
  eventId: explicitEventId,
  hideDelete = false,
  hideHeader = false,
  redirectTo,
}: EventEditScreenProps = {}): JSX.Element {
  const { t } = useTranslation();
  const { eventId: paramEventId } = useParams<{ eventId?: string }>();
  const eventId = explicitEventId === undefined ? paramEventId : (explicitEventId ?? undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const confirm = useConfirm();
  const isNew = eventId === 'new' || !eventId;

  const {
    data: event,
    isLoading,
    isSuccess,
  } = useQuery({
    queryKey: ['admin', 'event', eventId],
    enabled: !isNew && eventId !== undefined,
    queryFn: () => (eventId ? fetchEventById(getSupabaseClient(), eventId) : Promise.resolve(null)),
  });

  const [form, setForm] = useHydratedFormState(isSuccess, event, EMPTY, (row) => {
    if (!row) return EMPTY;
    return {
      name: row.name,
      subtitle: row.subtitle ?? '',
      type: row.type,
      location: row.location ?? '',
      time_zone: row.time_zone,
      start_date: row.start_date,
      end_date: row.end_date,
      reg_opens_at: fromIso(row.reg_opens_at),
      reg_closes_at: fromIso(row.reg_closes_at),
      hero_image_path: row.hero_image_path ?? '',
      logo_path: row.logo_path ?? '',
      invite_all_employees: row.invite_all_employees,
      allowed_domains: row.allowed_domains ?? [],
      is_active: row.is_active,
    };
  });

  const save = useMutation({
    mutationFn: async (state: FormState) => {
      const payload: EventInsert = {
        name: state.name,
        subtitle: state.subtitle || null,
        type: state.type,
        location: state.location || null,
        time_zone: state.time_zone,
        start_date: state.start_date,
        end_date: state.end_date,
        reg_opens_at: toIsoOrNull(state.reg_opens_at),
        reg_closes_at: toIsoOrNull(state.reg_closes_at),
        hero_image_path: state.hero_image_path || null,
        logo_path: state.logo_path || null,
        invite_all_employees: state.invite_all_employees,
        // Empty out the domain list when the box is off so a stale
        // value can't accidentally re-grant access if the admin flips
        // the toggle on later.
        allowed_domains: state.invite_all_employees ? state.allowed_domains : [],
        is_active: state.is_active,
      };
      if (isNew) return createEvent(getSupabaseClient(), payload);
      if (!eventId) throw new Error('event id missing');
      return updateEvent(getSupabaseClient(), eventId, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      await queryClient.invalidateQueries({ queryKey: ['active-event'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'event', saved.id] });
      show(t('admin.events.saved'));
      navigate(redirectTo ? redirectTo(saved.id) : `/admin/events/${saved.id}`);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!eventId || isNew) return;
      await deleteEvent(getSupabaseClient(), eventId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      show(t('admin.events.deleted'));
      navigate('/all-events');
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (!isNew && isLoading) {
    return <p className="py-8 text-sm text-muted-foreground">{t('admin.loading')}</p>;
  }

  return (
    <section className="space-y-6">
      {hideHeader ? null : (
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isNew ? t('admin.events.create') : t('admin.events.edit')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('admin.events.formHint')}</p>
        </header>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t('admin.events.fields.name')}>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Supafest 2027"
            />
          </Field>
          <Field label={t('admin.events.fields.subtitle')}>
            <Input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Banff, Alberta — January 11-15"
            />
          </Field>
          <Field label={t('admin.events.fields.type')}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as EventTypeEnum })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="company_offsite">{t('admin.events.types.company_offsite')}</option>
              <option value="sales_meeting">{t('admin.events.types.sales_meeting')}</option>
              <option value="team_offsite">{t('admin.events.types.team_offsite')}</option>
            </select>
          </Field>
          <Field label={t('admin.events.fields.location')}>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Banff, Alberta, Canada"
            />
          </Field>
          <Field label={t('admin.events.fields.timeZone')}>
            <Input
              required
              value={form.time_zone}
              onChange={(e) => setForm({ ...form, time_zone: e.target.value })}
              placeholder="America/Edmonton"
            />
          </Field>
          <div />
          <Field label={t('admin.events.fields.startDate')}>
            <Input
              required
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
          <Field label={t('admin.events.fields.endDate')}>
            <Input
              required
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </Field>
          <Field label={t('admin.events.fields.regOpensAt')}>
            <Input
              type="datetime-local"
              value={form.reg_opens_at}
              onChange={(e) => setForm({ ...form, reg_opens_at: e.target.value })}
            />
          </Field>
          <Field label={t('admin.events.fields.regClosesAt')}>
            <Input
              type="datetime-local"
              value={form.reg_closes_at}
              onChange={(e) => setForm({ ...form, reg_closes_at: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Storage uploads only work once the event has an id (the path
              starts with <eventId>/about/). On the "new" form we render
              the placeholder hint instead. */}
          {isNew || !eventId ? (
            <>
              <UploadPlaceholder label={t('admin.events.fields.heroImage')} />
              <UploadPlaceholder label={t('admin.events.fields.logo')} />
            </>
          ) : (
            <>
              <StorageImageUploader
                bucket={STORAGE_BUCKETS.eventContent}
                folder={eventAboutFolder(eventId)}
                value={form.hero_image_path}
                onChange={(p) => setForm({ ...form, hero_image_path: p })}
                label={t('admin.events.fields.heroImage')}
              />
              <StorageImageUploader
                bucket={STORAGE_BUCKETS.eventContent}
                folder={eventAboutFolder(eventId)}
                value={form.logo_path}
                onChange={(p) => setForm({ ...form, logo_path: p })}
                label={t('admin.events.fields.logo')}
              />
            </>
          )}
        </div>

        <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <legend className="px-2 text-sm font-medium">{t('admin.events.flags.title')}</legend>
          <FlagRow
            id="event-is-active"
            label={t('admin.events.flags.isActive')}
            hint={t('admin.events.flags.isActiveHint')}
            checked={form.is_active}
            onChange={(checked) => setForm({ ...form, is_active: checked })}
          />
          <FlagRow
            id="event-invite-all"
            label={t('admin.events.flags.openToAll')}
            hint={t('admin.events.flags.openToAllHint')}
            checked={form.invite_all_employees}
            onChange={(checked) => setForm({ ...form, invite_all_employees: checked })}
          />
          {form.invite_all_employees ? (
            <div className="space-y-2 rounded-md border border-dashed bg-background/50 p-3">
              <label className="text-xs font-medium">
                {t('admin.events.allowedDomains.label')}
              </label>
              <DomainsInput
                value={form.allowed_domains}
                onChange={(next) => setForm({ ...form, allowed_domains: next })}
              />
            </div>
          ) : (
            <p className="rounded-md border border-dashed bg-background/50 p-3 text-xs text-muted-foreground">
              {t('admin.events.flags.inviteOnlyHint')}
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {!isNew && !hideDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                void (async () => {
                  if (
                    await confirm({
                      titleKey: 'admin.events.deleteConfirm',
                      destructive: true,
                    })
                  ) {
                    remove.mutate();
                  }
                })();
              }}
            >
              {remove.isPending ? t('admin.events.cascading') : t('admin.events.delete')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('admin.events.saving') : t('admin.events.save')}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

interface FlagRowProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function FlagRow({ id, label, hint, checked, onChange }: FlagRowProps): JSX.Element {
  return (
    <div className="flex items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </label>
    </div>
  );
}

function UploadPlaceholder({ label }: { label: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        {t('admin.events.imageUploadAfterSave')}
      </p>
    </div>
  );
}
