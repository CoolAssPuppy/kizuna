import { Check, Clipboard } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RevealOnceDialogProps {
  token: string | null;
  onClose: () => void;
}

export function RevealOnceDialog({ token, onClose }: RevealOnceDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={token !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.apiKeys.revealOnce.title')}</DialogTitle>
          <DialogDescription>{t('profile.apiKeys.revealOnce.warning')}</DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
          <code>{token}</code>
        </pre>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (token) void navigator.clipboard?.writeText(token);
              setCopied(true);
            }}
          >
            {copied ? <Check aria-hidden /> : <Clipboard aria-hidden />}
            {t(copied ? 'profile.apiKeys.revealOnce.copied' : 'profile.apiKeys.revealOnce.copy')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
