import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownText } from './MarkdownText';

describe('MarkdownText', () => {
  it('renders bold text inside a strong tag', () => {
    const { container } = render(<MarkdownText source="hello **world**" />);
    expect(container.querySelector('strong')?.textContent).toBe('world');
  });

  it('renders underline text inside a u tag', () => {
    const { container } = render(<MarkdownText source="__warning__" />);
    expect(container.querySelector('u')?.textContent).toBe('warning');
  });

  it('renders italic text inside an em tag', () => {
    const { container } = render(<MarkdownText source="_emphasis_" />);
    expect(container.querySelector('em')?.textContent).toBe('emphasis');
  });

  it('renders [label](url) as an anchor with rel/target', () => {
    const { container } = render(<MarkdownText source="see [docs](https://example.com)" />);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.textContent).toBe('docs');
  });

  it('refuses non-http(s) link schemes', () => {
    const { container } = render(<MarkdownText source="[xss](javascript:alert(1))" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('[xss]');
  });

  it('escapes raw html as text', () => {
    const { container } = render(<MarkdownText source="<script>oops</script>" />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>oops</script>');
  });

  it('linkifies bare urls', () => {
    const { container } = render(<MarkdownText source="check https://example.com today" />);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders newlines as br elements', () => {
    const { container } = render(<MarkdownText source={`a\nb`} />);
    expect(container.querySelectorAll('br').length).toBe(1);
  });
});
