import { describe, expect, it } from 'vitest';

import { backgroundFor, timeOfDay } from './timeOfDay';

function at(hour: number): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

describe('timeOfDay', () => {
  it('returns night before 7 AM', () => {
    expect(timeOfDay(at(6))).toBe('night');
    expect(timeOfDay(at(0))).toBe('night');
  });

  it('returns day from 7 AM up to but not including 4 PM', () => {
    expect(timeOfDay(at(7))).toBe('day');
    expect(timeOfDay(at(12))).toBe('day');
    expect(timeOfDay(at(15))).toBe('day');
  });

  it('returns night from 4 PM onward', () => {
    expect(timeOfDay(at(16))).toBe('night');
    expect(timeOfDay(at(20))).toBe('night');
    expect(timeOfDay(at(23))).toBe('night');
  });
});

describe('backgroundFor', () => {
  it('returns the day asset path for day', () => {
    expect(backgroundFor('day')).toBe('/backgrounds/day.jpg');
  });
  it('returns the night asset path for night', () => {
    expect(backgroundFor('night')).toBe('/backgrounds/night.jpg');
  });
});
