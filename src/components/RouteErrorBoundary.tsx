import { AlertTriangle } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/errorReporter';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the route subtree and shows a
 * recoverable fallback rather than blanking the whole app. Reload reset
 * brings the route back; the error is surfaced to the console for
 * triage.
 *
 * The Trans component avoids needing the i18n context to read keys
 * during a crash where the provider may itself be the thing that
 * crashed.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    reportError(error, {
      source: 'route_error_boundary',
      componentStack: info.componentStack ?? null,
    });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 py-20 text-center">
        <AlertTriangle aria-hidden className="h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans i18nKey="errors.routeBoundary.title" defaults="Something went wrong." />
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="errors.routeBoundary.body"
            defaults="The page hit an unexpected error. Try reloading. If it keeps happening, ping the events team."
          />
        </p>
        <pre className="max-h-40 w-full overflow-auto rounded-md border bg-muted p-3 text-left text-xs">
          {error.message}
        </pre>
        <Button onClick={() => window.location.reload()}>
          <Trans i18nKey="errors.routeBoundary.reload" defaults="Reload" />
        </Button>
      </main>
    );
  }
}
