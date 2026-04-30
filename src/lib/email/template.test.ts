import { describe, expect, it } from 'vitest';

import { renderEmail } from './template';

describe('renderEmail', () => {
  it('produces an html document with the subject, heading, and body', () => {
    const result = renderEmail({
      subject: 'Welcome',
      preheader: 'Hello there',
      heading: 'Hi friend',
      bodyHtml: '<p>Body</p>',
      text: 'Hi friend, welcome.',
    });

    expect(result.subject).toBe('Welcome');
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hi friend');
    expect(result.html).toContain('<p>Body</p>');
    expect(result.html).toContain('Hello there');
    expect(result.text).toBe('Hi friend, welcome.');
  });

  it('renders a CTA button when provided', () => {
    const result = renderEmail({
      subject: 'Confirm',
      preheader: 'Confirm your seat',
      heading: 'Confirm',
      bodyHtml: '<p>Click below.</p>',
      cta: { label: 'Accept invitation', url: 'https://app.kizuna/accept?token=abc' },
      text: 'Click https://app.kizuna/accept?token=abc',
    });
    expect(result.html).toContain('Accept invitation');
    expect(result.html).toContain('https://app.kizuna/accept?token=abc');
  });

  it('escapes user-supplied subject and heading text', () => {
    const result = renderEmail({
      subject: 'Hello <script>',
      preheader: 'preheader',
      heading: 'Hi <b>',
      bodyHtml: '<p>safe</p>',
      text: 'safe',
    });
    expect(result.html).toContain('Hello &lt;script&gt;');
    expect(result.html).toContain('Hi &lt;b&gt;');
  });

  it('escapes the CTA url and label safely', () => {
    const result = renderEmail({
      subject: 'x',
      preheader: 'x',
      heading: 'x',
      bodyHtml: '<p>x</p>',
      cta: { label: 'Go now', url: 'https://example.com/path?q="trick"' },
      text: 'x',
    });
    // The double quote in the URL should be escaped so it can't break out
    // of the href attribute.
    expect(result.html).toContain('q=&quot;trick&quot;');
  });
});
