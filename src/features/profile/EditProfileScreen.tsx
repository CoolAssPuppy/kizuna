import { useTranslation } from 'react-i18next';

import { ChildrenSection } from '@/features/registration/sections/ChildrenSection';
import { DietarySection } from '@/features/registration/sections/DietarySection';
import { EmergencyContactSection } from '@/features/registration/sections/EmergencyContactSection';
import { PassportSection } from '@/features/registration/sections/PassportSection';
import { PersonalInfoSection } from '@/features/registration/sections/PersonalInfoSection';
import { SwagSection } from '@/features/registration/sections/SwagSection';
import { TransportSection } from '@/features/registration/sections/TransportSection';

const PROFILE_MODE = { kind: 'profile' } as const;

export function EditProfileScreen(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('profile.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.editSubtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PersonalInfoSection mode={PROFILE_MODE} />
        <EmergencyContactSection mode={PROFILE_MODE} />
        <DietarySection mode={PROFILE_MODE} />
        <PassportSection mode={PROFILE_MODE} />
        <ChildrenSection mode={PROFILE_MODE} />
        <SwagSection mode={PROFILE_MODE} />
        <TransportSection mode={PROFILE_MODE} />
      </div>
    </main>
  );
}
