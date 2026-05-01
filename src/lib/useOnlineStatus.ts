import { useState } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

/**
 * Returns true while the browser reports online connectivity.
 * Subscribes to online/offline events so consumers re-render on transition.
 *
 * Note: navigator.onLine reflects the OS view, which can lag actual
 * reachability. For the offline indicator that's good enough — when we
 * actually need to know whether a request will succeed, we let the request
 * fail and surface its error.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useMountEffect(() => {
    const handleOnline = (): void => setOnline(true);
    const handleOffline = (): void => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  return online;
}
