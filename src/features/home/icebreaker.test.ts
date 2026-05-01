import { describe, expect, it } from 'vitest';

import { pickIcebreakerTarget, reframeAsTeammateQuestion } from './icebreaker';

describe('reframeAsTeammateQuestion', () => {
  it('strips leading "I once" and yields a teammate question', () => {
    expect(reframeAsTeammateQuestion('I once played first chair in a Klingon opera.')).toBe(
      'Which teammate once played first chair in a Klingon opera?',
    );
  });

  it("expands I've to has", () => {
    expect(reframeAsTeammateQuestion("I've never seen a snowflake.")).toBe(
      'Which teammate has never seen a snowflake?',
    );
  });

  it('expands "I am" to is', () => {
    expect(reframeAsTeammateQuestion('I am a recovering tax accountant.')).toBe(
      'Which teammate is a recovering tax accountant?',
    );
  });

  it('strips a leading bare "I"', () => {
    expect(reframeAsTeammateQuestion('I make my own kombucha.')).toBe(
      'Which teammate make my own kombucha?',
    );
    // Note the verb agreement is intentionally left as-is — clean
    // grammar is what the OpenAI rephraser is for. The heuristic just
    // needs to be readable.
  });

  it('lowercases the first letter so the wrapped question reads naturally', () => {
    expect(reframeAsTeammateQuestion('Born in Naboo.')).toBe('Which teammate born in Naboo?');
  });

  it('handles empty input gracefully', () => {
    expect(reframeAsTeammateQuestion('')).toBe('');
    expect(reframeAsTeammateQuestion('   ')).toBe('');
  });

  it('drops trailing punctuation before appending its own question mark', () => {
    expect(reframeAsTeammateQuestion('I love chess!')).toBe('Which teammate love chess?');
  });
});

describe('pickIcebreakerTarget', () => {
  const people = [
    { user_id: 'a', fun_fact: 'I love chess.' },
    { user_id: 'b', fun_fact: null },
    { user_id: 'c', fun_fact: '   ' },
    { user_id: 'd', fun_fact: 'I keep bees.' },
  ];

  it('skips people without a fun_fact and people with whitespace-only ones', () => {
    const choices = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const pick = pickIcebreakerTarget(people, seed);
      if (pick) choices.add(pick.user_id);
    }
    expect(choices).toEqual(new Set(['a', 'd']));
  });

  it('returns null when no candidates have a fact', () => {
    expect(pickIcebreakerTarget([{ user_id: 'x', fun_fact: null }], 0)).toBeNull();
  });

  it('is deterministic for a fixed seed', () => {
    const a = pickIcebreakerTarget(people, 7);
    const b = pickIcebreakerTarget(people, 7);
    expect(a?.user_id).toBe(b?.user_id);
  });
});
