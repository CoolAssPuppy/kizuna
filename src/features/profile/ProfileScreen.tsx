import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Baby,
  HeartPulse,
  IdCard,
  Plane,
  Salad,
  Shirt,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LeadershipPill, RolePill } from '@/components/RolePill';
import { useAuth } from '@/features/auth/AuthContext';
import { CommunityProfileSection } from '@/features/community/CommunityProfileSection';
import { listAdditionalGuests } from '@/features/guests/api';
import { AccessibilitySection } from '@/features/registration/sections/AccessibilitySection';
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
import { useActiveSubject } from './useActiveSubject';

const PROFILE_MODE = { kind: 'profile' } as const;

type SectionId =
  | 'personal'
  | 'community'
  | 'dietary'
  | 'accessibility'
  | 'emergency'
  | 'passport'
  | 'guests'
  | 'dependents'
  | 'swag'
  | 'transport';

interface ProfileSection {
  id: SectionId;
  icon: LucideIcon;
  labelKey: string;
  render: () => JSX.Element;
  /** 'self' = signed-in user only; 'shared' = user OR dependent. */
  subject: 'self' | 'shared';
}

const SECTIONS: ReadonlyArray<ProfileSection> = [
  {
    id: 'personal',
    icon: User,
    labelKey: 'profile.nav.personal',
    render: () => <PersonalInfoSection mode={PROFILE_MODE} />,
    subject: 'self',
  },
  {
    id: 'community',
    icon: Sparkles,
    labelKey: 'profile.nav.community',
    render: () => <CommunityProfileSection mode={PROFILE_MODE} />,
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
    id: 'emergency',
    icon: HeartPulse,
    labelKey: 'profile.nav.emergency',
    render: () => <EmergencyContactSection mode={PROFILE_MODE} />,
    subject: 'shared',
  },
  {
    id: 'passport',
    icon: IdCard,
    labelKey: 'profile.nav.passport',
    render: () => <PassportSection mode={PROFILE_MODE} />,
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
  const [active, setActive] = useState<SectionId>('personal');

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
  const activeSection = sections.find((s) => s.id === active) ?? sections[0]!;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-8 py-10">
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
            displayName: m.full_name,
          }))}
        />
      ) : null}

      <div className="flex gap-8">
        <aside className="w-56 shrink-0 space-y-1">
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
