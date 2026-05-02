import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardShell } from '@/components/CardShell';
import { Button } from '@/components/ui/button';

import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { RevealOnceDialog } from './RevealOnceDialog';
import { useApiKeys, useRevokeApiKey } from './hooks';
import type { ApiKeyRow } from './types';

export function ApiKeysSection(): JSX.Element {
  const { t } = useTranslation();
  const { data: keys = [], isLoading } = useApiKeys();
  const revoke = useRevokeApiKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const active = keys.filter((key) => key.revoked_at === null);
  const revoked = keys.filter((key) => key.revoked_at !== null).slice(0, 20);

  return (
    <>
      <CardShell
        title={t('profile.apiKeys.title')}
        description={t('profile.apiKeys.description')}
        actions={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden />
            {t('profile.apiKeys.create')}
          </Button>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
        ) : active.length === 0 ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">
              {t('profile.apiKeys.empty')}
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {active.map((key) => (
              <ApiKeyRowView
                key={key.id}
                apiKey={key}
                onRevoke={() => {
                  if (window.confirm(t('profile.apiKeys.revokeConfirm', { name: key.name }))) {
                    void revoke.mutateAsync(key.id);
                  }
                }}
              />
            ))}
          </div>
        )}
        {revoked.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t('profile.apiKeys.revoked')}
            </summary>
            <div className="mt-2 divide-y rounded-md border opacity-70">
              {revoked.map((key) => (
                <ApiKeyRowView key={key.id} apiKey={key} />
              ))}
            </div>
          </details>
        ) : null}
      </CardShell>
      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setRevealedToken}
      />
      <RevealOnceDialog token={revealedToken} onClose={() => setRevealedToken(null)} />
    </>
  );
}

function ApiKeyRowView({
  apiKey,
  onRevoke,
}: {
  apiKey: ApiKeyRow;
  onRevoke?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{apiKey.name}</p>
        <p className="font-mono text-xs text-muted-foreground">...{apiKey.token_last4}</p>
      </div>
      <span className="rounded-full bg-muted px-2 py-1 text-xs">
        {t(`profile.apiKeys.scope.${apiKey.scope}`)}
      </span>
      <span className="text-xs text-muted-foreground">
        {t('profile.apiKeys.created', { date: new Date(apiKey.created_at).toLocaleDateString() })}
      </span>
      <span className="text-xs text-muted-foreground">
        {apiKey.last_used_at
          ? t('profile.apiKeys.lastUsed', {
              date: new Date(apiKey.last_used_at).toLocaleDateString(),
            })
          : t('profile.apiKeys.neverUsed')}
      </span>
      {onRevoke ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRevoke}>
          <Trash2 aria-hidden />
          {t('profile.apiKeys.revoke')}
        </Button>
      ) : null}
    </div>
  );
}
