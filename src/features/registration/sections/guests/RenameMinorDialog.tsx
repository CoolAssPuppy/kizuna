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

interface RenameMinorTarget {
  id: string;
  firstName: string;
  lastName: string;
}

interface RenameMinorDialogProps {
  target: RenameMinorTarget | null;
  onClose: () => void;
  onSubmit: (payload: RenameMinorTarget) => void;
}

export function RenameMinorDialog({
  target,
  onClose,
  onSubmit,
}: RenameMinorDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (target && target.id !== lastId) {
    setLastId(target.id);
    setFirst(target.firstName);
    setLast(target.lastName);
  }
  const valid = first.trim().length >= 1 && last.trim().length >= 1;
  return (
    <Dialog
      open={!!target}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('registration.guests.renameTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rename-first">{t('registration.guests.firstName')}</Label>
            <Input
              id="rename-first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder={t('registration.guests.firstNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-last">{t('registration.guests.lastName')}</Label>
            <Input
              id="rename-last"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder={t('registration.guests.lastNamePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            disabled={!target || !valid}
            onClick={() => {
              if (target) {
                onSubmit({ id: target.id, firstName: first.trim(), lastName: last.trim() });
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
