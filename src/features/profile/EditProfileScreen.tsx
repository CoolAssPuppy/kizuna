import { useTranslation } from 'react-i18next';

import { DietaryCard } from './DietaryCard';
import { EmergencyContactCard } from './EmergencyContactCard';
import { PersonalInfoCard } from './PersonalInfoCard';

export function EditProfileScreen(): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('profile.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.editSubtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PersonalInfoCard />
        <EmergencyContactCard />
        <DietaryCard />
      </div>
    </main>
  );
}
