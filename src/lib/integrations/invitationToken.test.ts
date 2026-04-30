import { describe, expect, it } from 'vitest';

import { signInvitationToken, verifyInvitationToken } from './invitationToken';

const SECRET = 'a-test-secret-that-is-not-short-enough-to-be-trivial';

describe('invitation token round-trip', () => {
  it('signs a token that verifies cleanly with the same secret', async () => {
    const token = await signInvitationToken({
      secret: SECRET,
      invitationId: 'invite-1',
      sponsorUserId: 'paul',
      guestEmail: 'alex@example.com',
    });

    const result = await verifyInvitationToken({ secret: SECRET, token });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.inv).toBe('invite-1');
      expect(result.claims.sub).toBe('paul');
      expect(result.claims.email).toBe('alex@example.com');
      expect(result.claims.exp).toBeGreaterThan(result.claims.iat);
    }
  });

  it('reports bad_signature when verified with the wrong secret', async () => {
    const token = await signInvitationToken({
      secret: SECRET,
      invitationId: 'invite-2',
      sponsorUserId: 'paul',
      guestEmail: 'alex@example.com',
    });

    const result = await verifyInvitationToken({ secret: 'something-else', token });
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('reports malformed when the token does not have three parts', async () => {
    const result = await verifyInvitationToken({ secret: SECRET, token: 'not-a-jwt' });
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('reports expired when the token is past its exp claim', async () => {
    const past = 1_000_000;
    const token = await signInvitationToken({
      secret: SECRET,
      invitationId: 'invite-3',
      sponsorUserId: 'paul',
      guestEmail: 'alex@example.com',
      ttlSeconds: 60,
      now: past,
    });

    const result = await verifyInvitationToken({ secret: SECRET, token, now: past + 120 });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('uses a 7-day default TTL', async () => {
    const start = 2_000_000;
    const token = await signInvitationToken({
      secret: SECRET,
      invitationId: 'invite-4',
      sponsorUserId: 'paul',
      guestEmail: 'alex@example.com',
      now: start,
    });
    const result = await verifyInvitationToken({ secret: SECRET, token, now: start + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.exp - result.claims.iat).toBe(7 * 24 * 60 * 60);
    }
  });
});
