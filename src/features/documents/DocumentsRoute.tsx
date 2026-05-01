import { EventGate } from '@/components/EventGate';

import { DocumentsTab } from './DocumentsTab';

export function DocumentsRoute(): JSX.Element {
  return <EventGate>{(event) => <DocumentsTab eventId={event.id} />}</EventGate>;
}
