import { useTranslation } from 'react-i18next';

import { AccessibilitySection } from '@/features/registration/sections/AccessibilitySection';
import { DietarySection } from '@/features/registration/sections/DietarySection';
import { EmergencyContactSection } from '@/features/registration/sections/EmergencyContactSection';
import { GuestsSection } from '@/features/registration/sections/GuestsSection';
import { PassportSection } from '@/features/registration/sections/PassportSection';
import { PersonalInfoSection } from '@/features/registration/sections/PersonalInfoSection';
import { SwagSection } from '@/features/registration/sections/SwagSection';
import { TransportSection } from '@/features/registration/sections/TransportSection';

import { ProfileAvatar } from './ProfileAvatar';

const PROFILE_MODE = { kind: 'profile' } as const;

export function ProfileScreen(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-8 py-10">
      <header className="flex flex-row items-center gap-6">
        <ProfileAvatar />
        <h1 className="text-3xl font-semibold tracking-tight">{t('profile.title')}</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PersonalInfoSection mode={PROFILE_MODE} />
        <EmergencyContactSection mode={PROFILE_MODE} />
        <DietarySection mode={PROFILE_MODE} />
        <AccessibilitySection mode={PROFILE_MODE} />
        <PassportSection mode={PROFILE_MODE} />
        <GuestsSection mode={PROFILE_MODE} />
        <SwagSection mode={PROFILE_MODE} />
        <TransportSection mode={PROFILE_MODE} />
      </div>
    </main>
  );
}
