import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Baby,
  CalendarCheck,
  HeartPulse,
  IdCard,
  KeyRound,
  Plane,
  Salad,
  Shirt,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { LeadershipPill, RolePill } from '@/components/RolePill';
import { useAuth } from '@/features/auth/AuthContext';
import { CommunityProfileSection } from '@/features/community/CommunityProfileSection';
import { listAdditionalGuests } from '@/features/guests/api';
import { ApiKeysSection } from '@/features/profile/api-keys/ApiKeysSection';
import { AccessibilitySection } from '@/features/registration/sections/AccessibilitySection';
import { AttendingSection } from '@/features/registration/sections/AttendingSection';
import { DependentsSection } from '@/features/registration/sections/DependentsSection';
import { DietarySection } from '@/features/registration/sections/DietarySection';
import { EmergencyContactSection } from '@/features/registration/sections/EmergencyContactSection';
import { GuestsSection } from '@/features/registration/sections/GuestsSection';
import { PassportSection } from '@/features/registration/sections/PassportSection';
import { PersonalInfoSection } from '@/features/registration/sections/PersonalInfoSection';
import { SwagSection } from '@/features/registration/sections/SwagSection';
import { TransportSection } from '@/features/registration/sections/TransportSection';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { ActiveSubjectProvider } from './ActiveSubjectContext';
import { ProfileAvatar } from './ProfileAvatar';
import { RegistrationChecklist } from './RegistrationChecklist';
import { useActiveSubject } from './useActiveSubject';

const PROFILE_MODE = { kind: 'profile' } as const;

type SectionId =
  | 'attendance'
  | 'personal'
  | 'community'
  | 'dietary'
  | 'accessibility'
  | 'emergency'
  | 'passport'
  | 'guests'
  | 'dependents'
  | 'swag'
  | 'transport'
  | 'api-keys';

interface ProfileSection {
  id: SectionId;
  icon: LucideIcon;
  labelKey: string;
  render: () => JSX.Element;
  /** 'self' = signed-in user only; 'shared' = user OR dependent. */
  subject: 'self' | 'shared';
}

// Order matches the registration wizard + checklist (attending →
// personal → passport → emergency → dietary → accessibility → swag →
// transport). Sections that have no wizard equivalent (community,
// guests, dependents, API keys) trail at the end. Keep these three
// surfaces in sync — otherwise users see different orderings depending
// on where they land.
const SECTIONS: ReadonlyArray<ProfileSection> = [
  {
    id: 'attendance',
    icon: CalendarCheck,
    labelKey: 'profile.nav.attendance',
    render: () => <AttendingSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'personal',
    icon: User,
    labelKey: 'profile.nav.personal',
    render: () => <PersonalInfoSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'passport',
    icon: IdCard,
    labelKey: 'profile.nav.passport',
    render: () => <PassportSection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'emergency',
    icon: HeartPulse,
    labelKey: 'profile.nav.emergency',
    render: () => <EmergencyContactSection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'dietary',
    icon: Salad,
    labelKey: 'profile.nav.dietary',
    render: () => <DietarySection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'accessibility',
    icon: Accessibility,
    labelKey: 'profile.nav.accessibility',
    render: () => <AccessibilitySection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'swag',
    icon: Shirt,
    labelKey: 'profile.nav.swag',
    render: () => <SwagSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'transport',
    icon: Plane,
    labelKey: 'profile.nav.transport',
    render: () => <TransportSection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'community',
    icon: Sparkles,
    labelKey: 'profile.nav.community',
    render: () => <CommunityProfileSection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'guests',
    icon: Users,
    labelKey: 'profile.nav.guests',
    render: () => <GuestsSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'dependents',
    icon: Baby,
    labelKey: 'profile.nav.dependents',
    render: () => <DependentsSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'api-keys',
    icon: KeyRound,
    labelKey: 'profile.nav.apiKeys',
    render: () => <ApiKeysSection />,
    subject: 'self',
  },
];

export function ProfileScreen(): JSX.Element {
  return (
    <ActiveSubjectProvider>
      <ProfileScreenInner />
    </ActiveSubjectProvider>
  );
}

function ProfileScreenInner(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const subject = useActiveSubject();
  const navigate = useNavigate();
  const { sectionId } = useParams<{ sectionId?: string }>();

  // Shared query key with GuestsSection + DependentsSection.
  const { data: minors } = useQuery({
    queryKey: ['additional-guests', user?.id ?? null],
    enabled: !!user,
    queryFn: () => listAdditionalGuests(getSupabaseClient(), user!.id),
  });
  const hasMinors = (minors?.length ?? 0) > 0;

  const sections = SECTIONS.filter((s) => {
    if (subject.isDependent && s.subject !== 'shared') return false;
    if (!hasMinors && s.id === 'dependents') return false;
    return true;
  });
  // The active section is whichever URL slug matches a visible section,
  // falling back to the first one. Unknown slugs land on the default
  // rather than throwing a 404 — same behaviour Admin has.
  const active: SectionId = sections.find((s) => s.id === sectionId)?.id ?? sections[0]!.id;
  const activeSection = sections.find((s) => s.id === active) ?? sections[0]!;
  const setActive = (next: SectionId): void => {
    navigate(`/profile/${next}`);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-row items-center gap-6">
        <ProfileAvatar />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t('profile.title')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{user?.email}</span>
            {user ? <RolePill role={user.role} /> : null}
            {user?.isLeadership ? <LeadershipPill /> : null}
          </div>
        </div>
      </header>

      {hasMinors && minors ? (
        <SubjectSelector
          minors={minors.map((m) => ({
            userId: m.user_id ?? '',
            displayName: `${m.first_name} ${m.last_name}`.trim(),
          }))}
        />
      ) : null}

      {/* Mobile: horizontally scrollable pill row of section tabs. */}
      <div
        role="tablist"
        aria-label={t('profile.nav.label')}
        aria-orientation="horizontal"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden"
        style={{ scrollbarWidth: 'thin' }}
      >
        {sections.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
              active === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent',
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-6 md:flex">
          <div
            role="tablist"
            aria-label={t('profile.nav.label')}
            aria-orientation="vertical"
            className="flex flex-col gap-0.5"
          >
            {sections.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`profile-tab-${id}`}
                aria-controls="profile-tabpanel"
                aria-selected={active === id}
                onClick={() => setActive(id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                  active === id
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                <span>{t(labelKey)}</span>
              </button>
            ))}
          </div>
          {!subject.isDependent ? <RegistrationChecklist /> : null}
        </aside>
        <section
          id="profile-tabpanel"
          role="tabpanel"
          aria-labelledby={`profile-tab-${activeSection.id}`}
          className="min-w-0 flex-1"
        >
          {activeSection.render()}
        </section>
      </div>
    </main>
  );
}

interface SubjectChip {
  userId: string;
  displayName: string;
}

interface SubjectSelectorProps {
  minors: ReadonlyArray<SubjectChip>;
}

function SubjectSelector({ minors }: SubjectSelectorProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const subject = useActiveSubject();
  const selfSelected = !subject.isDependent;
  return (
    <nav
      aria-label={t('profile.subjectSelector.label')}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2"
    >
      <p className="ml-2 mr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('profile.subjectSelector.heading')}
      </p>
      <button
        type="button"
        onClick={() =>
          subject.setSubject({
            userId: user?.id ?? '',
            displayName: user?.email ?? '',
            isDependent: false,
          })
        }
        className={cn(
          'rounded-full px-3 py-1.5 text-sm transition-colors',
          selfSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-foreground hover:bg-accent',
        )}
      >
        {t('profile.subjectSelector.yourself')}
      </button>
      {minors.map((minor) => {
        const active = subject.isDependent && subject.userId === minor.userId;
        return (
          <button
            key={minor.userId || minor.displayName}
            type="button"
            disabled={!minor.userId}
            onClick={() =>
              subject.setSubject({
                userId: minor.userId,
                displayName: minor.displayName,
                isDependent: true,
              })
            }
            className={cn(
              'rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-accent',
            )}
          >
            {minor.displayName}
          </button>
        );
      })}
    </nav>
  );
}
