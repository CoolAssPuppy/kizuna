import { describe, expect, it } from 'vitest';

import { computeFitDimensions } from './imageProcess';

describe('computeFitDimensions', () => {
  it('returns dimensions unchanged when both fit', () => {
    expect(computeFitDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('scales down by long edge when wider than tall', () => {
    expect(computeFitDimensions(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('scales down by long edge when taller than wide', () => {
    expect(computeFitDimensions(1440, 2560, 1280)).toEqual({ width: 720, height: 1280 });
  });

  it('rounds to integers', () => {
    expect(computeFitDimensions(2561, 1441, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('handles square images', () => {
    expect(computeFitDimensions(2000, 2000, 320)).toEqual({ width: 320, height: 320 });
  });

  it('preserves dimensions for tiny images', () => {
    expect(computeFitDimensions(100, 100, 1280)).toEqual({ width: 100, height: 100 });
  });

  it('clamps zero / negative inputs to 1px', () => {
    expect(computeFitDimensions(0, 0, 320)).toEqual({ width: 1, height: 1 });
    expect(computeFitDimensions(-100, 200, 320)).toEqual({ width: 1, height: 1 });
  });
});
