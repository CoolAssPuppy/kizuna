import { describe, expect, it } from 'vitest';

import { composeLegalName } from './personalInfo';

describe('composeLegalName', () => {
  it('joins first and last when middle is missing', () => {
    expect(
      composeLegalName({ first_name: 'Hermione', middle_initial: null, last_name: 'Granger' }),
    ).toBe('Hermione Granger');
  });

  it('inserts a middle initial with a trailing dot', () => {
    expect(composeLegalName({ first_name: 'Mary', middle_initial: 'J', last_name: 'Watson' })).toBe(
      'Mary J. Watson',
    );
  });

  it('preserves an existing dot rather than doubling it', () => {
    expect(
      composeLegalName({ first_name: 'Mary', middle_initial: 'J.', last_name: 'Watson' }),
    ).toBe('Mary J. Watson');
  });

  it('returns an empty string when every part is missing', () => {
    expect(composeLegalName({ first_name: null, middle_initial: null, last_name: null })).toBe('');
  });

  it('handles a single-name attendee gracefully', () => {
    expect(composeLegalName({ first_name: 'Sting', middle_initial: null, last_name: null })).toBe(
      'Sting',
    );
  });
});
