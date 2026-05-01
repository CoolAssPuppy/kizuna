import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';

import { StepShell } from '../StepShell';
import type { SectionMode } from './types';

interface SectionChromeProps {
  mode: SectionMode;
  title: string;
  description?: string;
  busy: boolean;
  hydrated: boolean;
  errorKey: string | null;
  onSubmit: () => void;
  /** Disable submit beyond the hydrated/busy gate (e.g. unanswered radio). */
  submitDisabled?: boolean;
  children: ReactNode;
}

/**
 * Renders a Section with the right chrome for its mode:
 *  - wizard → StepShell (full-width "Save and Continue")
 *  - profile → CardShell with bottom-right Save button + inline error
 */
export function SectionChrome({
  mode,
  title,
  description,
  busy,
  hydrated,
  errorKey,
  onSubmit,
  submitDisabled = false,
  children,
}: SectionChromeProps): JSX.Element {
  const { t } = useTranslation();
  const disabled = submitDisabled || !hydrated;

  if (mode.kind === 'wizard') {
    return (
      <StepShell
        title={title}
        {...(description ? { subtitle: description } : {})}
        onSubmit={onSubmit}
        busy={busy}
        errorKey={errorKey}
        submitDisabled={disabled}
      >
        {children}
      </StepShell>
    );
  }

  return (
    <CardShell title={title} {...(description ? { description } : {})}>
      <div className="space-y-4">
        {children}
        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={busy || disabled}>
            {busy ? t('registration.saving') : t('actions.save')}
          </Button>
        </div>
        {errorKey ? (
          <p role="alert" className="text-sm text-destructive">
            {t(errorKey)}
          </p>
        ) : null}
      </div>
    </CardShell>
  );
}
