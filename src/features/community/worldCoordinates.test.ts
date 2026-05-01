import { describe, expect, it } from 'vitest';

import { locate, project } from './worldCoordinates';

describe('locate', () => {
  it('returns null when no country is supplied', () => {
    expect(locate('Banff', null)).toBeNull();
  });

  it('returns the city coordinate when both city and country resolve', () => {
    const out = locate('Banff', 'CA');
    expect(out).not.toBeNull();
    expect(out!.lat).toBeCloseTo(51.18, 1);
    expect(out!.lon).toBeCloseTo(-115.57, 1);
  });

  it('falls back to the country centroid when the city is unknown', () => {
    const out = locate('Some Town', 'US');
    expect(out).not.toBeNull();
    expect(out!.lat).toBeCloseTo(39.5, 1);
  });

  it('returns null when country is unknown', () => {
    expect(locate('Town', 'XX')).toBeNull();
  });
});

describe('project', () => {
  it('places (0,0) at the centre of a 360x180 canvas', () => {
    const p = project({ lat: 0, lon: 0 }, 360, 180);
    expect(p.x).toBe(180);
    expect(p.y).toBe(90);
  });

  it('places the south pole at the bottom edge', () => {
    const p = project({ lat: -90, lon: 0 }, 360, 180);
    expect(p.y).toBe(180);
  });

  it('places the prime meridian dateline at the right edge', () => {
    const p = project({ lat: 0, lon: 180 }, 360, 180);
    expect(p.x).toBe(360);
  });
});
