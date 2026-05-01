import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  show: (message: string, variant?: Toast['variant']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// 5 seconds is long enough that a user clicking Save and glancing back
// at their work still sees the result, short enough that a stack of
// rapid saves doesn't pile up on the screen.
const TOAST_TTL_MS = 5_000;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, variant: Toast['variant'] = 'success'): void => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Top-center anchor — bottom-right was getting missed on tall
          pages where the user's eyes stay on the form. The solid-color
          variants give the toast enough visual weight to register
          peripherally even when the user is mid-task. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2"
      >
        {toasts.map((toast) => {
          const Icon = toast.variant === 'error' ? XCircle : CheckCircle2;
          return (
            <div
              key={toast.id}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex min-w-[16rem] max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ring-1 ring-black/5 transition-all',
                toast.variant === 'error'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              <Icon aria-hidden className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
