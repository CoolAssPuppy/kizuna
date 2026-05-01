import { EventGate } from '@/components/EventGate';

import { ItineraryScreen } from './ItineraryScreen';

export function ItineraryRoute(): JSX.Element {
  return <EventGate>{(event) => <ItineraryScreen event={event} />}</EventGate>;
}
