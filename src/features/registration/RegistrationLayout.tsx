import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Progress } from '@/components/ui/progress';

import { WIZARD_STEPS } from './wizardSteps';
import type { RegistrationBundle } from './types';

interface Props {
  bundle: RegistrationBundle;
  /** Index in WIZARD_STEPS for the active step. */
  stepIndex: number;
  children: ReactNode;
}

export function RegistrationLayout({ bundle, stepIndex, children }: Props): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('registration.stepLabel', {
              current: stepIndex + 1,
              total: WIZARD_STEPS.length,
            })}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('registration.title')}</h1>
          <Progress
            value={bundle.registration.completion_pct}
            aria-label={t('registration.progress', { percent: bundle.registration.completion_pct })}
          />
        </header>
        {children}
      </div>
    </main>
  );
}
