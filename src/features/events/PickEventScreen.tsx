import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useMountEffect } from '@/hooks/useMountEffect';
import { mediumDateFormatter } from '@/lib/formatters';

import { setEventOverride } from './eventOverride';
import { useEligibleEvents } from './useEligibleEvents';

/**
 * First-login event picker. Shown when:
 *   - the user is authenticated AND
 *   - has no per-browser event override set AND
 *   - has more than one eligible event
 *
 * The router-level gate auto-selects when there's exactly one eligible
 * event, so this screen never renders the "single card with no choice"
 * shape. When there are zero eligible events, we show a friendly empty
 * state with the support contact path.
 */
export function PickEventScreen(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: events, isLoading } = useEligibleEvents();

  // If only one event is eligible, the router gate should have picked
  // it for us. This is a belt-and-braces redirect for any path that
  // lands here directly (deep link, manual nav). useMountEffect runs
  // on the first render where `events` is populated; React's strict
  // double-invoke is fine because setEventOverride is idempotent.
  useMountEffect(() => {
    if (events.length === 1 && events[0]) {
      setEventOverride(events[0].id);
      navigate('/', { replace: true });
    }
  });

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center justify-center px-6 py-20">
        <p className="text-sm text-muted-foreground" aria-busy="true">
          {t('app.loading')}
        </p>
      </main>
    );
  }

  if (events.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('pickEvent.empty.title')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t('pickEvent.empty.subtitle', { email: user?.email ?? '' })}
        </p>
        <Link to="/" className="text-sm underline">
          {t('pickEvent.empty.signOutHint')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8 sm:py-20">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('pickEvent.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('pickEvent.subtitle')}</p>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {events.map((event) => (
          <li key={event.id}>
            <Button
              variant="outline"
              className="flex h-auto w-full flex-col items-start gap-2 px-5 py-5 text-left"
              onClick={() => {
                setEventOverride(event.id);
                navigate('/', { replace: true });
              }}
            >
              <span className="text-base font-semibold">{event.name}</span>
              {event.subtitle ? (
                <span className="text-xs text-muted-foreground">{event.subtitle}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {mediumDateFormatter.format(new Date(event.start_date))}
                {' – '}
                {mediumDateFormatter.format(new Date(event.end_date))}
                {event.location ? ` · ${event.location}` : ''}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
