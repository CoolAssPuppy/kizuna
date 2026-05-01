import { describe, expect, it } from 'vitest';

import { JET_LAG_TIPS, pickJetLagTip } from './jetLagTips';

describe('JET_LAG_TIPS', () => {
  it('ships at least 20 tips', () => {
    expect(JET_LAG_TIPS.length).toBeGreaterThanOrEqual(20);
  });

  it('every tip has a non-empty id, direction, and text', () => {
    for (const tip of JET_LAG_TIPS) {
      expect(tip.id).toMatch(/^[a-z0-9-]+$/);
      expect(['east', 'west', 'any']).toContain(tip.direction);
      expect(tip.text.length).toBeGreaterThan(20);
    }
  });

  it('every tip id is unique', () => {
    const ids = new Set(JET_LAG_TIPS.map((t) => t.id));
    expect(ids.size).toBe(JET_LAG_TIPS.length);
  });
});

describe('pickJetLagTip', () => {
  it('returns the same tip for the same seed and direction (deterministic)', () => {
    const a = pickJetLagTip('east', 12345);
    const b = pickJetLagTip('east', 12345);
    expect(a?.id).toBe(b?.id);
  });

  it('returns a different tip for a sufficiently different seed', () => {
    const a = pickJetLagTip('any' as 'east', 0);
    const b = pickJetLagTip('any' as 'east', 1);
    // No guarantee of difference, but two adjacent indices in a 20-item
    // pool give distinct tips.
    expect(a?.id).not.toBe(b?.id);
  });

  it('east direction never returns a west-tagged tip', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const tip = pickJetLagTip('east', seed);
      expect(tip?.direction).not.toBe('west');
    }
  });

  it('west direction never returns an east-tagged tip', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const tip = pickJetLagTip('west', seed);
      expect(tip?.direction).not.toBe('east');
    }
  });

  it('none direction only returns universal tips', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const tip = pickJetLagTip('none', seed);
      expect(tip?.direction).toBe('any');
    }
  });

  it('handles negative seeds without crashing', () => {
    expect(pickJetLagTip('east', -42)).not.toBeNull();
  });
});
