import { EventGate } from '@/components/EventGate';

import { AgendaScreen } from './AgendaScreen';

export function AgendaRoute(): JSX.Element {
  return <EventGate>{(event) => <AgendaScreen event={event} />}</EventGate>;
}
