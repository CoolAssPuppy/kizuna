import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GuestInvitationRow } from '@/features/guests/types';

interface EditInvitationDialogProps {
  target: GuestInvitationRow | null;
  onClose: () => void;
  onSubmit: (payload: { id: string; fullName: string; guestEmail: string }) => void;
}

function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: '', last: '' };
  const idx = trimmed.lastIndexOf(' ');
  if (idx === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx).trim(), last: trimmed.slice(idx + 1).trim() };
}

/**
 * Sponsor-side editor for an existing adult invitation. Editing is
 * blocked at the call site for status='accepted' rows because at that
 * point the row points at a real auth user — that user owns their own
 * profile. Allowed states: pending, sent, expired, cancelled.
 *
 * Email and full_name persist via PATCH on guest_invitations; RLS
 * narrows the row to the calling sponsor. We re-key off `target.id`
 * to refill when a different invitation opens the dialog.
 */
export function EditInvitationDialog({
  target,
  onClose,
  onSubmit,
}: EditInvitationDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (target && target.id !== lastId) {
    setLastId(target.id);
    const split = splitFullName(target.full_name);
    setFirst(split.first);
    setLast(split.last);
    setEmail(target.guest_email);
  }
  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const valid =
    first.trim().length >= 1 && last.trim().length >= 1 && email.trim().includes('@');

  return (
    <Dialog
      open={!!target}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('registration.guests.editInvitationTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-invite-first">{t('registration.guests.firstName')}</Label>
              <Input
                id="edit-invite-first"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder={t('registration.guests.firstNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-invite-last">{t('registration.guests.lastName')}</Label>
              <Input
                id="edit-invite-last"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder={t('registration.guests.lastNamePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-invite-email">{t('registration.guests.guestEmail')}</Label>
            <Input
              id="edit-invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('registration.guests.emailPlaceholder')}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('registration.guests.editInvitationHint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            disabled={!target || !valid}
            onClick={() => {
              if (target) {
                onSubmit({ id: target.id, fullName, guestEmail: email.trim() });
                onClose();
              }
            }}
          >
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
