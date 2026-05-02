import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsAdmin } from '@/features/auth/hooks';

import { useCreateApiKey } from './hooks';
import type { ApiKeyScope } from './types';

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: string) => void;
}

type Expiry = '30d' | '90d' | '1y' | 'never';

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateApiKeyDialogProps): JSX.Element {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const create = useCreateApiKey();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('read');
  const [expiry, setExpiry] = useState<Expiry>('90d');

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const created = await create.mutateAsync({
      name,
      scope,
      expiresAt: expiryToDate(expiry),
    });
    setName('');
    setScope('read');
    setExpiry('90d');
    onOpenChange(false);
    onCreated(created.token);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('profile.apiKeys.create')}</DialogTitle>
            <DialogDescription>{t('profile.apiKeys.createDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="api-key-name">{t('profile.apiKeys.name')}</Label>
            <Input
              id="api-key-name"
              value={name}
              minLength={1}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('profile.apiKeys.nameHelp')}</p>
          </div>

          <Fieldset legend={t('profile.apiKeys.scope.label')}>
            {(['read', 'write'] as const).map((value) => (
              <RadioOption
                key={value}
                name="api-key-scope"
                checked={scope === value}
                label={t(`profile.apiKeys.scope.${value}`)}
                onChange={() => setScope(value)}
              />
            ))}
            {isAdmin ? (
              <RadioOption
                name="api-key-scope"
                checked={scope === 'admin'}
                label={t('profile.apiKeys.scope.admin')}
                onChange={() => setScope('admin')}
              />
            ) : null}
          </Fieldset>

          <Fieldset legend={t('profile.apiKeys.expiry.label')}>
            {(['30d', '90d', '1y', 'never'] as const).map((value) => (
              <RadioOption
                key={value}
                name="api-key-expiry"
                checked={expiry === value}
                label={t(`profile.apiKeys.expiry.${value}`)}
                onChange={() => setExpiry(value)}
              />
            ))}
          </Fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('profile.apiKeys.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }): JSX.Element {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function RadioOption({
  name,
  checked,
  label,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function expiryToDate(expiry: Expiry): string | null {
  if (expiry === 'never') return null;
  const date = new Date();
  if (expiry === '30d') date.setDate(date.getDate() + 30);
  if (expiry === '90d') date.setDate(date.getDate() + 90);
  if (expiry === '1y') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
