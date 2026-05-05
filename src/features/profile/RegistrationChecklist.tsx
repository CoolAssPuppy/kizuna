import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthContext';
import { useActiveEvent } from '@/features/events/useActiveEvent';
import { ensureRegistration } from '@/features/registration/api/registration';
import { getSupabaseClient } from '@/lib/supabase';

const TASK_TO_PROFILE_SECTION: Record<string, string> = {
  attending: 'attendance',
  personal_info: 'personal-info',
  passport: 'passport',
  emergency_contact: 'emergency-contact',
  dietary: 'dietary',
  accessibility: 'accessibility',
  swag: 'swag',
  transport: 'transport',
  documents: 'documents',
};

const TASK_LABEL_KEYS: Record<string, string> = {
  attending: 'profile.checklist.tasks.attending',
  personal_info: 'profile.checklist.tasks.personal_info',
  passport: 'profile.checklist.tasks.passport',
  emergency_contact: 'profile.checklist.tasks.emergency_contact',
  dietary: 'profile.checklist.tasks.dietary',
  accessibility: 'profile.checklist.tasks.accessibility',
  swag: 'profile.checklist.tasks.swag',
  transport: 'profile.checklist.tasks.transport',
  documents: 'profile.checklist.tasks.documents',
};

// Canonical render order — kept identical to the wizard's WIZARD_STEPS
// + 'documents' (which lives outside the wizard but inside the
// checklist). The DB query orders alphabetically by task_key, which
// produced a confusing checklist where "accessibility" showed up first.
// Sort client-side instead so wizard, profile nav, and checklist all
// agree on the same sequence.
const TASK_ORDER: ReadonlyArray<string> = [
  'attending',
  'personal_info',
  'passport',
  'emergency_contact',
  'dietary',
  'accessibility',
  'swag',
  'transport',
  'documents',
];

function taskOrderIndex(taskKey: string): number {
  const idx = TASK_ORDER.indexOf(taskKey);
  // Unknown task keys (a future task added before the constant is
  // updated) fall to the bottom rather than vanishing.
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function RegistrationChecklist(): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: event } = useActiveEvent();

  const query = useQuery({
    queryKey: ['profile', 'checklist', user?.id ?? null, event?.id ?? null],
    queryFn: () =>
      ensureRegistration(getSupabaseClient(), { userId: user!.id, eventId: event!.id }),
    enabled: !!user && !!event,
  });

  if (!query.data) return null;
  const tasks = [...query.data.tasks].sort(
    (a, b) => taskOrderIndex(a.task_key) - taskOrderIndex(b.task_key),
  );

  const total = tasks.length;
  if (total === 0) return null;
  const done = tasks.filter((t) => t.status === 'complete' || t.status === 'waived').length;
  const pct = Math.round((done / total) * 100);

  return (
    <aside
      aria-label={t('profile.checklist.label')}
      className="border p-4"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <ListChecks aria-hidden className="h-3.5 w-3.5" style={{ color: 'var(--c-muted)' }} />
        <span
          className="text-[11px] font-bold uppercase"
          style={{ color: 'var(--c-muted)', letterSpacing: '0.18em' }}
        >
          {t('profile.checklist.label')}
        </span>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--c-muted)' }}>
          {done}/{total}
        </span>
      </div>

      <div
        className="mb-3 h-1 w-full"
        style={{ backgroundColor: 'var(--c-rule)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-1" style={{ width: `${pct}%`, backgroundColor: 'var(--c-accent)' }} />
      </div>

      <ul className="space-y-1.5">
        {tasks.map((task) => {
          const isDone = task.status === 'complete' || task.status === 'waived';
          const labelKey =
            TASK_LABEL_KEYS[task.task_key] ?? `profile.checklist.tasks.${task.task_key}`;
          const targetSection = TASK_TO_PROFILE_SECTION[task.task_key];
          const label = t(labelKey, { defaultValue: task.task_key.replace(/_/g, ' ') });
          const inner = (
            <span
              className="flex items-center gap-2 text-xs"
              style={{
                color: isDone ? 'var(--c-dim)' : 'var(--c-fg)',
                textDecoration: isDone ? 'line-through' : 'none',
              }}
            >
              {isDone ? (
                <Check
                  aria-hidden
                  className="h-3 w-3 shrink-0"
                  style={{ color: 'var(--c-accent)' }}
                />
              ) : (
                <ChevronRight
                  aria-hidden
                  className="h-3 w-3 shrink-0"
                  style={{ color: 'var(--c-muted)' }}
                />
              )}
              <span className="truncate">{label}</span>
            </span>
          );
          if (!isDone && targetSection) {
            return (
              <li key={task.task_key}>
                <Link to={`/profile/${targetSection}`} className="block py-0.5 hover:opacity-80">
                  {inner}
                </Link>
              </li>
            );
          }
          return (
            <li key={task.task_key} className="py-0.5">
              {inner}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
