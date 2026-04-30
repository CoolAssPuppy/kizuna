import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { useActiveEvent } from '@/features/events/useActiveEvent';

import { DietaryStep } from './DietaryStep';
import { EmergencyContactStep } from './EmergencyContactStep';
import { PassportStep } from './PassportStep';
import { PersonalInfoStep } from './PersonalInfoStep';
import { RegistrationLayout } from './RegistrationLayout';
import { SwagStep } from './SwagStep';
import { TransportStep } from './TransportStep';
import { useRegistration } from './useRegistration';
import type { RegistrationBundle } from './types';
import { findStepByPath, nextPendingStep, WIZARD_STEPS } from './wizardSteps';

function StepRouter({
  bundle,
  onComplete,
  stepPath,
}: {
  bundle: RegistrationBundle;
  onComplete: () => void;
  stepPath: string;
}): JSX.Element {
  switch (stepPath) {
    case 'personal-info':
      return <PersonalInfoStep bundle={bundle} onComplete={onComplete} />;
    case 'passport':
      return <PassportStep bundle={bundle} onComplete={onComplete} />;
    case 'emergency-contact':
      return <EmergencyContactStep bundle={bundle} onComplete={onComplete} />;
    case 'dietary':
      return <DietaryStep bundle={bundle} onComplete={onComplete} />;
    case 'swag':
      return <SwagStep bundle={bundle} onComplete={onComplete} />;
    case 'transport':
      return <TransportStep bundle={bundle} onComplete={onComplete} />;
    default:
      return <Navigate to="/registration" replace />;
  }
}

export function RegistrationRoute(): JSX.Element {
  const { t } = useTranslation();
  const { stepPath } = useParams<{ stepPath?: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading: eventLoading, error: eventError } = useActiveEvent();
  const eventId = event?.id ?? null;
  const {
    data: bundle,
    isLoading: regLoading,
    error: regError,
    invalidate,
  } = useRegistration({ eventId: eventId ?? '' });

  if (eventLoading || regLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('auth.checkingSession')}</p>
      </main>
    );
  }

  if (eventError || !event) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {eventError?.message ?? t('documents.noDocuments')}
        </p>
      </main>
    );
  }

  if (regError || !bundle) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {regError?.message ?? t('registration.errorSaving')}
        </p>
      </main>
    );
  }

  // Without a path, send the user to the next pending step.
  if (!stepPath) {
    const next = nextPendingStep(bundle.tasks);
    if (next) return <Navigate to={`/registration/${next.path}`} replace />;
    return <Navigate to="/" replace />;
  }

  const activeStep = findStepByPath(stepPath);
  if (!activeStep) {
    return <Navigate to="/registration" replace />;
  }
  const stepIndex = WIZARD_STEPS.indexOf(activeStep);

  function handleStepComplete(): void {
    invalidate();
    const idx = WIZARD_STEPS.findIndex((s) => s.path === stepPath);
    const next = WIZARD_STEPS[idx + 1];
    if (next) {
      navigate(`/registration/${next.path}`);
    } else {
      navigate('/');
    }
  }

  return (
    <RegistrationLayout bundle={bundle} stepIndex={stepIndex}>
      <StepRouter bundle={bundle} onComplete={handleStepComplete} stepPath={stepPath} />
    </RegistrationLayout>
  );
}
