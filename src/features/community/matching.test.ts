import { describe, expect, it } from 'vitest';

import {
  rankByHobbyOverlap,
  filterByHometown,
  filterByCurrentTown,
  type Profile,
} from './matching';

const me: Profile = {
  user_id: 'me',
  first_name: 'Mae',
  last_name: 'Self',
  email: 'me@kizuna.dev',
  avatar_url: null,
  hobbies: ['skiing', 'photography', 'coffee'],
  hometown_city: 'Banff',
  hometown_country: 'CA',
  current_city: 'Toronto',
  current_country: 'CA',
};

const others: Profile[] = [
  {
    user_id: 'a',
    first_name: 'A',
    last_name: 'L',
    email: 'a@example.com',
    avatar_url: null,
    hobbies: ['skiing', 'cooking'],
    hometown_city: 'Banff',
    hometown_country: 'CA',
    current_city: 'New York',
    current_country: 'US',
  },
  {
    user_id: 'b',
    first_name: 'B',
    last_name: 'L',
    email: 'b@example.com',
    avatar_url: null,
    hobbies: ['skiing', 'photography'],
    hometown_city: 'Vancouver',
    hometown_country: 'CA',
    current_city: 'Toronto',
    current_country: 'CA',
  },
  {
    user_id: 'c',
    first_name: 'C',
    last_name: 'L',
    email: 'c@example.com',
    avatar_url: null,
    hobbies: [],
    hometown_city: 'Banff',
    hometown_country: 'CA',
    current_city: 'Toronto',
    current_country: 'CA',
  },
];

describe('rankByHobbyOverlap', () => {
  it('returns hobby-overlap ranked descending, excluding self', () => {
    const ranked = rankByHobbyOverlap(me, [me, ...others]);
    expect(ranked.map((p) => p.user_id)).toEqual(['b', 'a']);
    expect(ranked[0]!.matched).toEqual(['skiing', 'photography']);
    expect(ranked[1]!.matched).toEqual(['skiing']);
  });

  it('omits people with zero overlap', () => {
    const ranked = rankByHobbyOverlap(me, [others[2]!]);
    expect(ranked).toEqual([]);
  });

  it('handles a self profile with no hobbies', () => {
    expect(rankByHobbyOverlap({ ...me, hobbies: [] }, others)).toEqual([]);
  });
});

describe('filterByHometown', () => {
  it('matches on city + country, excluding self', () => {
    const out = filterByHometown(me, [me, ...others]);
    expect(out.map((p) => p.user_id)).toEqual(['a', 'c']);
  });

  it('returns empty when self has no hometown', () => {
    expect(filterByHometown({ ...me, hometown_city: null }, others)).toEqual([]);
  });
});

describe('filterByCurrentTown', () => {
  it('matches on current city + country, excluding self', () => {
    const out = filterByCurrentTown(me, [me, ...others]);
    expect(out.map((p) => p.user_id)).toEqual(['b', 'c']);
  });
});
