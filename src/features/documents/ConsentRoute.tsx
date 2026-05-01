import { EventGate } from '@/components/EventGate';

import { ConsentScreen } from './ConsentScreen';

export function ConsentRoute(): JSX.Element {
  return <EventGate>{(event) => <ConsentScreen eventId={event.id} />}</EventGate>;
}
