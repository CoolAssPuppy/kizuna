import { describe, expect, it } from 'vitest';

import { isScrolledToBottom } from './scroll';

describe('isScrolledToBottom', () => {
  it('returns true when the document fits without scrolling', () => {
    expect(isScrolledToBottom(0, 200, 400)).toBe(true);
  });

  it('returns false partway through a long document', () => {
    expect(isScrolledToBottom(100, 1000, 500)).toBe(false);
  });

  it('returns true at the exact bottom', () => {
    expect(isScrolledToBottom(500, 1000, 500)).toBe(true);
  });

  it('returns true within the tolerance threshold', () => {
    // scrollTop+clientHeight = 999, scrollHeight = 1000, default tolerance 4
    expect(isScrolledToBottom(499, 1000, 500)).toBe(true);
  });

  it('returns false just outside the tolerance threshold', () => {
    expect(isScrolledToBottom(495, 1000, 500)).toBe(false);
  });
});
