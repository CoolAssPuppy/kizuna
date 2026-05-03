// Registers every Kizuna CLI command. Importing this module triggers
// the side-effect calls to `registerCommand` in each command file. The
// public API surface lives in `src/lib/cli/index.ts`.
//
// Order matters only because the dispatcher resolves the longest path
// match first; per-command files have no inter-dependency beyond
// shared zod fragments and helpers in `_schemas.ts` / `_shared.ts`.

import './help.ts';
import './schema.ts';
import './me.ts';
import './me-itinerary.ts';
import './me-sessions.ts';
import './me-documents.ts';
import './me-roommates.ts';
import './me-transport.ts';
import './me-notifications.ts';
import './attendees.ts';
import './sessions.ts';
import './sessions-propose.ts';
import './tags.ts';
import './events.ts';
import './agenda.ts';
import './photos.ts';
import './channels.ts';
