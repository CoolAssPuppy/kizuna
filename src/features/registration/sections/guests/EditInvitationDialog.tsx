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
import { joinFullName, splitFullName } from '@/lib/fullName';

interface EditInvitationDialogProps {
  target: GuestInvitationRow | null;
  onClose: () => void;
  onSubmit: (payload: { id: string; fullName: string; guestEmail: string }) => void;
}

// Editing is blocked at the call site once status='accepted' — by then
// the row points at a real auth user who owns their own profile.
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
  const fullName = joinFullName(first, last);
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
