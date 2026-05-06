import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { buttonVariants } from './button-variants';

/**
 * Localized, accessible confirmation dialog. Replaces native `confirm()`
 * across the admin and profile flows. The hook returns a function that
 * resolves to true (confirmed) or false (cancelled / dismissed).
 *
 * Usage:
 * ```tsx
 * const confirm = useConfirm();
 * if (await confirm({ titleKey: 'agenda.deleteSession.title' })) {
 *   remove.mutate(id);
 * }
 * ```
 */

interface ConfirmOptions {
  /** i18n key for the title. Required. */
  titleKey: string;
  /** Interpolation values for titleKey. */
  titleValues?: Record<string, string | number>;
  /** Optional i18n key for the supporting body copy. */
  descriptionKey?: string;
  descriptionValues?: Record<string, string | number>;
  /** i18n key for the confirm button. Defaults to `actions.confirm`. */
  confirmLabelKey?: string;
  /** i18n key for the cancel button. Defaults to `actions.cancel`. */
  cancelLabelKey?: string;
  /** When true the confirm button uses the destructive variant. */
  destructive?: boolean;
}

interface InternalState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, setState] = useState<InternalState>({ open: false, options: null, resolve: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const { t } = useTranslation();

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    const current = stateRef.current;
    current.resolve?.(value);
    setState({ open: false, options: null, resolve: null });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const opts = state.options;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialogPrimitive.Root
        open={state.open}
        onOpenChange={(next) => {
          if (!next) handleClose(false);
        }}
      >
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-6 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            {opts ? (
              <>
                <AlertDialogPrimitive.Title className="text-base font-semibold">
                  {opts.titleValues ? t(opts.titleKey, opts.titleValues) : t(opts.titleKey)}
                </AlertDialogPrimitive.Title>
                {opts.descriptionKey ? (
                  <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                    {opts.descriptionValues
                      ? t(opts.descriptionKey, opts.descriptionValues)
                      : t(opts.descriptionKey)}
                  </AlertDialogPrimitive.Description>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                  <AlertDialogPrimitive.Cancel
                    className={cn(buttonVariants({ variant: 'ghost' }))}
                    onClick={() => handleClose(false)}
                  >
                    {t(opts.cancelLabelKey ?? 'actions.cancel')}
                  </AlertDialogPrimitive.Cancel>
                  <AlertDialogPrimitive.Action
                    className={cn(
                      buttonVariants({ variant: opts.destructive ? 'destructive' : 'default' }),
                    )}
                    onClick={() => handleClose(true)}
                  >
                    {t(opts.confirmLabelKey ?? 'actions.confirm')}
                  </AlertDialogPrimitive.Action>
                </div>
              </>
            ) : null}
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  return ctx;
}
