import { describe, expect, it } from 'vitest';

import {
  utcIsoToZonedDateTimeLocal,
  zonedDateTimeLocalToUtcIso,
  zonedWallTimeToUtcIso,
} from './timezone';

describe('zonedWallTimeToUtcIso', () => {
  it('converts an Edmonton wall-clock to UTC across DST regimes', () => {
    // Mountain Standard Time, MST = UTC-7
    expect(zonedWallTimeToUtcIso('2026-01-11', '08:00', 'America/Edmonton')).toBe(
      '2026-01-11T15:00:00.000Z',
    );
    // Mountain Daylight Time, MDT = UTC-6
    expect(zonedWallTimeToUtcIso('2026-07-15', '08:00', 'America/Edmonton')).toBe(
      '2026-07-15T14:00:00.000Z',
    );
  });

  it('handles a zone that does not observe DST', () => {
    // Tokyo is JST (UTC+9) year-round
    expect(zonedWallTimeToUtcIso('2026-04-01', '09:00', 'Asia/Tokyo')).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });
});

describe('zonedDateTimeLocalToUtcIso', () => {
  it('parses a datetime-local string and converts to UTC in the event timezone', () => {
    expect(zonedDateTimeLocalToUtcIso('2026-01-11T08:00', 'America/Edmonton')).toBe(
      '2026-01-11T15:00:00.000Z',
    );
  });
});

describe('utcIsoToZonedDateTimeLocal', () => {
  it('round-trips with zonedDateTimeLocalToUtcIso', () => {
    const zone = 'America/Edmonton';
    const original = '2026-01-11T08:00';
    const utc = zonedDateTimeLocalToUtcIso(original, zone);
    expect(utcIsoToZonedDateTimeLocal(utc, zone)).toBe(original);
  });

  it('formats UTC instants in the supplied zone', () => {
    expect(utcIsoToZonedDateTimeLocal('2026-07-15T14:00:00.000Z', 'America/Edmonton')).toBe(
      '2026-07-15T08:00',
    );
    expect(utcIsoToZonedDateTimeLocal('2026-04-01T00:00:00.000Z', 'Asia/Tokyo')).toBe(
      '2026-04-01T09:00',
    );
  });
});
