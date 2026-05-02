export interface KizunaToolDefinition {
  name: string;
  command: string;
  description: string;
}

export const KIZUNA_TOOLS: readonly KizunaToolDefinition[] = [
  { name: 'kizuna_help', command: 'help', description: 'List available Kizuna commands.' },
  { name: 'kizuna_schema', command: 'schema', description: 'Return Kizuna command metadata.' },
  { name: 'kizuna_me', command: 'me', description: 'Show the authenticated user profile.' },
  { name: 'kizuna_me_itinerary', command: 'me itinerary', description: 'Show the user itinerary.' },
  { name: 'kizuna_me_sessions', command: 'me sessions', description: 'Show registered or favorited sessions.' },
  { name: 'kizuna_me_documents', command: 'me documents', description: 'Show signable documents.' },
  { name: 'kizuna_me_roommates', command: 'me roommates', description: 'Show room assignment and roommates.' },
  { name: 'kizuna_me_transport', command: 'me transport', description: 'Show transport requests.' },
  { name: 'kizuna_me_notifications', command: 'me notifications', description: 'Show notifications.' },
  { name: 'kizuna_attendees', command: 'attendees', description: 'Find attendees by filters.' },
  { name: 'kizuna_sessions', command: 'sessions', description: 'List sessions.' },
  { name: 'kizuna_events', command: 'events', description: 'List visible events.' },
  { name: 'kizuna_event', command: 'event', description: 'Show event details.' },
  { name: 'kizuna_agenda', command: 'agenda', description: 'Show the event agenda.' },
  { name: 'kizuna_photos', command: 'photos', description: 'List visible photos.' },
  { name: 'kizuna_channels', command: 'channels', description: 'List community channels.' },
];

export function buildCommand(base: string, args: string | undefined): string {
  const trimmed = args?.trim();
  return trimmed ? `${base} ${trimmed}` : base;
}
