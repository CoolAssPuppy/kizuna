import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/test/renderWithProviders';

import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  it('renders the app name and tagline from i18n resources', () => {
    renderWithProviders(<WelcomeScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kizuna');
    expect(screen.getByText('An enduring bond')).toBeInTheDocument();
  });
});
