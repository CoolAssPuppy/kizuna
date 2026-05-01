import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Baby,
  HeartPulse,
  IdCard,
  Plane,
  Salad,
  Shirt,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LeadershipPill, RolePill } from '@/components/RolePill';
import { useAuth } from '@/features/auth/AuthContext';
import { AccessibilitySection } from '@/features/registration/sections/AccessibilitySection';
import { DependentsSection } from '@/features/registration/sections/DependentsSection';
import { DietarySection } from '@/features/registration/sections/DietarySection';
import { EmergencyContactSection } from '@/features/registration/sections/EmergencyContactSection';
import { GuestsSection } from '@/features/registration/sections/GuestsSection';
import { PassportSection } from '@/features/registration/sections/PassportSection';
import { PersonalInfoSection } from '@/features/registration/sections/PersonalInfoSection';
import { SwagSection } from '@/features/registration/sections/SwagSection';
import { TransportSection } from '@/features/registration/sections/TransportSection';
import { cn } from '@/lib/utils';

import { ProfileAvatar } from './ProfileAvatar';

const PROFILE_MODE = { kind: 'profile' } as const;

type SectionId =
  | 'personal'
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
}

const SECTIONS: ReadonlyArray<ProfileSection> = [
  {
    id: 'personal',
    icon: User,
    labelKey: 'profile.nav.personal',
    render: () => <PersonalInfoSection mode={PROFILE_MODE} />,
  },
  {
    id: 'dietary',
    icon: Salad,
    labelKey: 'profile.nav.dietary',
    render: () => <DietarySection mode={PROFILE_MODE} />,
  },
  {
    id: 'accessibility',
    icon: Accessibility,
    labelKey: 'profile.nav.accessibility',
    render: () => <AccessibilitySection mode={PROFILE_MODE} />,
  },
  {
    id: 'emergency',
    icon: HeartPulse,
    labelKey: 'profile.nav.emergency',
    render: () => <EmergencyContactSection mode={PROFILE_MODE} />,
  },
  {
    id: 'passport',
    icon: IdCard,
    labelKey: 'profile.nav.passport',
    render: () => <PassportSection mode={PROFILE_MODE} />,
  },
  {
    id: 'guests',
    icon: Users,
    labelKey: 'profile.nav.guests',
    render: () => <GuestsSection mode={PROFILE_MODE} />,
  },
  {
    id: 'dependents',
    icon: Baby,
    labelKey: 'profile.nav.dependents',
    render: () => <DependentsSection mode={PROFILE_MODE} />,
  },
  {
    id: 'swag',
    icon: Shirt,
    labelKey: 'profile.nav.swag',
    render: () => <SwagSection mode={PROFILE_MODE} />,
  },
  {
    id: 'transport',
    icon: Plane,
    labelKey: 'profile.nav.transport',
    render: () => <TransportSection mode={PROFILE_MODE} />,
  },
];

export function ProfileScreen(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [active, setActive] = useState<SectionId>('personal');
  const activeSection = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!;

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

      <div className="flex gap-8">
        <aside className="w-56 shrink-0 space-y-1">
          <div
            role="tablist"
            aria-label={t('profile.nav.label')}
            aria-orientation="vertical"
            className="flex flex-col gap-0.5"
          >
            {SECTIONS.map(({ id, icon: Icon, labelKey }) => (
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

