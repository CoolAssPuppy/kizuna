import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TagPill, TagPills } from './TagPill';
import type { SessionTag } from './tagsApi';

const TAG_DARK: SessionTag = {
  id: 't-1',
  event_id: 'e-1',
  name: 'Engineering',
  color: '#1f2937',
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
};

const TAG_LIGHT: SessionTag = {
  id: 't-2',
  event_id: 'e-1',
  name: 'People',
  color: '#fde68a',
  position: 1,
  created_at: '2026-01-01T00:00:00Z',
};

describe('TagPill', () => {
  it('renders the tag name', () => {
    render(<TagPill tag={TAG_DARK} />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('uses white text on dark backgrounds for legibility', () => {
    render(<TagPill tag={TAG_DARK} />);
    const pill = screen.getByText('Engineering');
    // happy-dom keeps inline color values verbatim; jsdom would normalise.
    expect(pill.style.color.toLowerCase()).toMatch(/^(#ffffff|rgb\(255,\s*255,\s*255\))$/);
  });

  it('uses near-black text on light backgrounds for legibility', () => {
    render(<TagPill tag={TAG_LIGHT} />);
    const pill = screen.getByText('People');
    expect(pill.style.color.toLowerCase()).toMatch(/^(#0f172a|rgb\(15,\s*23,\s*42\))$/);
  });
});

describe('TagPills', () => {
  it('renders nothing when the list is empty', () => {
    const { container } = render(<TagPills tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one pill per tag', () => {
    render(<TagPills tags={[TAG_DARK, TAG_LIGHT]} />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
  });
});
