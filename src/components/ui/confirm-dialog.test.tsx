import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';

import { Button } from './button';
import { ConfirmDialogProvider, useConfirm } from './confirm-dialog';

function ConfirmTrigger({
  onResult,
  destructive = false,
}: {
  onResult: (value: boolean) => void;
  destructive?: boolean;
}): JSX.Element {
  const confirm = useConfirm();
  return (
    <Button
      onClick={() => {
        void confirm({ titleKey: 'admin.agenda.deleteConfirm', destructive }).then(onResult);
      }}
    >
      open
    </Button>
  );
}

describe('ConfirmDialog', () => {
  it('resolves true when the confirm action is clicked', async () => {
    let captured: boolean | null = null;
    renderWithProviders(
      <ConfirmDialogProvider>
        <ConfirmTrigger
          destructive
          onResult={(v) => {
            captured = v;
          }}
        />
      </ConfirmDialogProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    // The dialog renders its own confirm + cancel buttons.
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(captured).toBe(true);
  });

  it('resolves false when the cancel action is clicked', async () => {
    let captured: boolean | null = null;
    renderWithProviders(
      <ConfirmDialogProvider>
        <ConfirmTrigger
          onResult={(v) => {
            captured = v;
          }}
        />
      </ConfirmDialogProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(captured).toBe(false);
  });

  it('resolves false when the dialog is dismissed via Escape', async () => {
    let captured: boolean | null = null;
    renderWithProviders(
      <ConfirmDialogProvider>
        <ConfirmTrigger
          onResult={(v) => {
            captured = v;
          }}
        />
      </ConfirmDialogProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await userEvent.keyboard('{Escape}');

    expect(captured).toBe(false);
  });
});
