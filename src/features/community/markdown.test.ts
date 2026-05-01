import { describe, expect, it } from 'vitest';

import { markdownToSafeHtml } from './markdown';

describe('markdownToSafeHtml', () => {
  it('converts **bold** to a strong tag', () => {
    expect(markdownToSafeHtml('hello **world**')).toBe('hello <strong>world</strong>');
  });

  it('converts _italic_ to an em tag and __underline__ to u', () => {
    expect(markdownToSafeHtml('feeling _good_ and __great__')).toBe(
      'feeling <em>good</em> and <u>great</u>',
    );
  });

  it('renders [label](https://url) as an anchor with rel and target', () => {
    expect(markdownToSafeHtml('see [docs](https://supabase.com/docs)')).toBe(
      'see <a href="https://supabase.com/docs" target="_blank" rel="noopener noreferrer">docs</a>',
    );
  });

  it('rejects non-http(s) link schemes', () => {
    expect(markdownToSafeHtml('[xss](javascript:alert(1))')).toBe('[xss](javascript:alert(1))');
  });

  it('escapes raw html so injections are rendered as text', () => {
    expect(markdownToSafeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('preserves line breaks as br tags', () => {
    expect(markdownToSafeHtml('hi\nthere')).toBe('hi<br>there');
  });

  it('returns empty string for empty input', () => {
    expect(markdownToSafeHtml('')).toBe('');
  });

  it('treats raw urls as links when they are bare', () => {
    expect(markdownToSafeHtml('check https://example.com today')).toBe(
      'check <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a> today',
    );
  });
});
