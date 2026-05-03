import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { EventGate } from '@/components/EventGate';
import type { Database } from '@/types/database.types';

import { RegistrationLayout } from './RegistrationLayout';
import { AccessibilitySection } from './sections/AccessibilitySection';
import { DietarySection } from './sections/DietarySection';
import { EmergencyContactSection } from './sections/EmergencyContactSection';
import { PassportSection } from './sections/PassportSection';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { SwagSection } from './sections/SwagSection';
import { TransportSection } from './sections/TransportSection';
import type { SectionMode } from './sections/types';
import { useRegistration } from './useRegistration';
import { findStepByPath, nextPendingStep, WIZARD_STEPS } from './wizardSteps';

function StepRouter({ mode, stepPath }: { mode: SectionMode; stepPath: string }): JSX.Element {
  switch (stepPath) {
    case 'personal-info':
      return <PersonalInfoSection mode={mode} />;
    case 'passport':
      return <PassportSection mode={mode} />;
    case 'emergency-contact':
      return <EmergencyContactSection mode={mode} />;
    case 'dietary':
      return <DietarySection mode={mode} />;
    case 'accessibility':
      return <AccessibilitySection mode={mode} />;
    case 'swag':
      return <SwagSection mode={mode} />;
    case 'transport':
      return <TransportSection mode={mode} />;
    default:
      return <Navigate to="/registration" replace />;
  }
}

type EventRow = Database['public']['Tables']['events']['Row'];

function RegistrationInner({ event }: { event: EventRow }): JSX.Element {
  const { t } = useTranslation();
  const { stepPath } = useParams<{ stepPath?: string }>();
  const navigate = useNavigate();
  const { data: bundle, isLoading, error, invalidate } = useRegistration({ eventId: event.id });

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <p className="text-muted-foreground">{t('app.loadingEvent')}</p>
      </main>
    );
  }

  if (error || !bundle) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert" className="text-destructive">
          {error?.message ?? t('registration.errorSaving')}
        </p>
      </main>
    );
  }

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
    if (next) navigate(`/registration/${next.path}`);
    else navigate('/');
  }

  const wizardMode: SectionMode = {
    kind: 'wizard',
    bundle,
    onComplete: handleStepComplete,
  };

  return (
    <RegistrationLayout bundle={bundle} stepIndex={stepIndex}>
      <StepRouter mode={wizardMode} stepPath={stepPath} />
    </RegistrationLayout>
  );
}

export function RegistrationRoute(): JSX.Element {
  return <EventGate>{(event) => <RegistrationInner event={event} />}</EventGate>;
}
