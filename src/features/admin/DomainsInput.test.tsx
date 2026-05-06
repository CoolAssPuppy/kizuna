import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';

import { DomainsInput } from './DomainsInput';

describe('DomainsInput', () => {
  it('renders existing domains as chips with a remove control', () => {
    renderWithProviders(
      <DomainsInput value={['supabase.io', '*.kizuna.dev']} onChange={vi.fn()} />,
    );
    expect(screen.getByText('supabase.io')).toBeInTheDocument();
    expect(screen.getByText('*.kizuna.dev')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /supabase\.io/i })).toBeInTheDocument();
  });

  it('appends a domain on Enter and clears the input', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'supabase.io{Enter}');
    expect(onChange).toHaveBeenCalledWith(['supabase.io']);
  });

  it('lowercases and trims new entries', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '  Supabase.IO  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['supabase.io']);
  });

  it('rejects malformed entries with a localized error', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'not a domain{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('skips duplicates silently', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={['supabase.io']} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'supabase.io{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a domain when its X button is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={['supabase.io', 'kizuna.dev']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /supabase\.io/i }));
    expect(onChange).toHaveBeenCalledWith(['kizuna.dev']);
  });

  it('accepts subdomain wildcards', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DomainsInput value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '*.supabase.io{Enter}');
    expect(onChange).toHaveBeenCalledWith(['*.supabase.io']);
  });
});
