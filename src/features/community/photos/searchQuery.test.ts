import { describe, expect, it } from 'vitest';

import { classifyQuery } from './searchQuery';

describe('classifyQuery', () => {
  it('classifies empty as empty', () => {
    expect(classifyQuery('')).toEqual({ kind: 'empty' });
    expect(classifyQuery('   ')).toEqual({ kind: 'empty' });
  });

  it('classifies # prefix as hashtag', () => {
    expect(classifyQuery('#banff')).toEqual({ kind: 'hashtag', value: 'banff' });
    expect(classifyQuery('  #BANFF  ')).toEqual({ kind: 'hashtag', value: 'banff' });
  });

  it('classifies @ prefix as mention', () => {
    expect(classifyQuery('@ada')).toEqual({ kind: 'mention', value: 'ada' });
    expect(classifyQuery('@AdA')).toEqual({ kind: 'mention', value: 'ada' });
  });

  it('classifies plain words as text', () => {
    expect(classifyQuery('mountain hike')).toEqual({ kind: 'text', value: 'mountain hike' });
  });

  it('treats lone # / @ as empty', () => {
    expect(classifyQuery('#')).toEqual({ kind: 'empty' });
    expect(classifyQuery('@')).toEqual({ kind: 'empty' });
  });
});
