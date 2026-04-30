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

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, variant: Toast['variant'] = 'success'): void => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm shadow-md',
              toast.variant === 'error'
                ? 'border-destructive/30 text-destructive'
                : 'border-primary/30 text-foreground',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
