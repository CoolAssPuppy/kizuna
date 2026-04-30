import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface StepShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSubmit: () => void;
  busy: boolean;
  errorKey: string | null;
  submitDisabled?: boolean;
}

/**
 * Layout chrome shared by every wizard step. The page itself (header,
 * progress bar) is owned by the route-level layout — this component is
 * just the form card.
 */
export function StepShell({
  title,
  subtitle,
  children,
  onSubmit,
  busy,
  errorKey,
  submitDisabled = false,
}: StepShellProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !submitDisabled) onSubmit();
      }}
      className="space-y-6 rounded-md border bg-card p-6 text-card-foreground shadow-sm"
      noValidate
    >
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      <div className="space-y-4">{children}</div>

      <Button type="submit" disabled={busy || submitDisabled} size="lg" className="w-full">
        {busy ? t('registration.saving') : t('registration.saveAndContinue')}
      </Button>

      {errorKey ? (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
    </form>
  );
}
