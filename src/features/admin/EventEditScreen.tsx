import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useHydratedFormState } from '@/hooks/useHydratedFormState';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

import {
  createEvent,
  deleteEvent,
  fetchEventById,
  updateEvent,
  type EventInsert,
} from './api/events';

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
  hero_image_url: string;
  logo_url: string;
  invite_all_employees: boolean;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: '',
  subtitle: '',
  type: 'supafest',
  location: '',
  time_zone: 'UTC',
  start_date: '',
  end_date: '',
  reg_opens_at: '',
  reg_closes_at: '',
  hero_image_url: '',
  logo_url: '',
  invite_all_employees: false,
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

export function EventEditScreen(): JSX.Element {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const isNew = eventId === 'new' || !eventId;

  const { data: event, isLoading, isSuccess } = useQuery({
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
      hero_image_url: row.hero_image_url ?? '',
      logo_url: row.logo_url ?? '',
      invite_all_employees: row.invite_all_employees,
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
        hero_image_url: state.hero_image_url || null,
        logo_url: state.logo_url || null,
        invite_all_employees: state.invite_all_employees,
        is_active: state.is_active,
      };
      if (isNew) return createEvent(getSupabaseClient(), payload);
      if (!eventId) throw new Error('event id missing');
      return updateEvent(getSupabaseClient(), eventId, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      show(t('admin.events.saved'));
      navigate(`/admin/events/${saved.id}`);
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
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {isNew ? t('admin.events.create') : t('admin.events.edit')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('admin.events.formHint')}</p>
      </header>

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
              <option value="supafest">Supafest</option>
              <option value="select">Select</option>
              <option value="meetup">Meetup</option>
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
          <Field label={t('admin.events.fields.heroImage')}>
            <Input
              type="url"
              value={form.hero_image_url}
              onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field label={t('admin.events.fields.logo')}>
            <Input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
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
            label={t('admin.events.flags.inviteAll')}
            hint={t('admin.events.flags.inviteAllHint')}
            checked={form.invite_all_employees}
            onChange={(checked) => setForm({ ...form, invite_all_employees: checked })}
          />
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {!isNew ? (
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(t('admin.events.deleteConfirm'))) remove.mutate();
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
