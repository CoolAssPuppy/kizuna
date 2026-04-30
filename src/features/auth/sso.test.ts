import { describe, expect, it, vi } from 'vitest';

import type { AppSupabaseClient } from '@/lib/supabase';

import { isSsoConfigured, signInWithSso } from './sso';

describe('isSsoConfigured', () => {
  it('is true only when both Okta domain and client id are set', () => {
    expect(isSsoConfigured({ oktaDomain: 'kizuna.okta.com', oktaClientId: 'abc' })).toBe(true);
    expect(isSsoConfigured({ oktaDomain: 'kizuna.okta.com' })).toBe(false);
    expect(isSsoConfigured({ oktaClientId: 'abc' })).toBe(false);
    expect(isSsoConfigured({})).toBe(false);
  });
});

describe('signInWithSso', () => {
  function makeClient(opts?: { ssoError?: Error; passwordError?: Error }): AppSupabaseClient {
    return {
      auth: {
        signInWithSSO: vi.fn().mockResolvedValue({ error: opts?.ssoError ?? null }),
        signInWithPassword: vi.fn().mockResolvedValue({ error: opts?.passwordError ?? null }),
      },
    } as unknown as AppSupabaseClient;
  }

  it('uses enterprise SSO with the configured Okta domain', async () => {
    const client = makeClient();
    await signInWithSso(client, { oktaDomain: 'kizuna.okta.com', oktaClientId: 'abc' });
    expect(client.auth.signInWithSSO).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'kizuna.okta.com' }),
    );
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('falls back to dev password grant when SSO is not configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = makeClient();

    await signInWithSso(client, {});

    expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(client.auth.signInWithSSO).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SSO not configured'));
    warn.mockRestore();
  });

  it('throws a helpful error when the dev fallback also fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = makeClient({ passwordError: new Error('invalid_credentials') });

    await expect(signInWithSso(client, {})).rejects.toThrow(/Dev SSO fallback failed/);
  });

  it('surfaces SSO errors when SSO is configured', async () => {
    const client = makeClient({ ssoError: new Error('redirect blocked') });
    await expect(
      signInWithSso(client, { oktaDomain: 'kizuna.okta.com', oktaClientId: 'abc' }),
    ).rejects.toThrow('redirect blocked');
  });
});
