import { Route, Routes } from 'react-router-dom';

import { NotFound } from '@/features/errors/NotFound';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
