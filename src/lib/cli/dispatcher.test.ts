import { describe, expect, it } from 'vitest';

import { resolveCommand } from './dispatcher';
import './commands';

describe('resolveCommand', () => {
  it('resolves verb noun commands', () => {
    expect(resolveCommand('me itinerary --day 2')?.path).toEqual(['me', 'itinerary']);
  });

  it('resolves bare attendees commands with refs', () => {
    const resolved = resolveCommand('attendees @alice');
    expect(resolved?.path).toEqual(['attendees']);
    expect(resolved?.refs).toEqual({ user: 'alice' });
  });
});
