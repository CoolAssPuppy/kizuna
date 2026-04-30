import { describe, expect, it, vi } from 'vitest';

import {
  ADULT_GUEST_FEE_USD_CENTS,
  CHILD_GUEST_FEE_USD_CENTS,
  createCheckoutSession,
  feeForTier,
  stripeStatus,
} from './stripe';

describe('feeForTier', () => {
  it('returns the configured cents amount for each tier', () => {
    expect(feeForTier('adult')).toBe(ADULT_GUEST_FEE_USD_CENTS);
    expect(feeForTier('child')).toBe(CHILD_GUEST_FEE_USD_CENTS);
  });
});

describe('stripeStatus', () => {
  it('reflects the presence of the secret key', () => {
    expect(stripeStatus({ secretKey: 'sk_test' }).mode).toBe('live');
    expect(stripeStatus({}).mode).toBe('stubbed');
  });
});

describe('createCheckoutSession', () => {
  const input = {
    guestUserId: 'u1',
    guestEmail: 'guest@example.com',
    tier: 'adult' as const,
    successUrl: 'https://app.kizuna/payment-success',
    cancelUrl: 'https://app.kizuna/payment-cancelled',
  };

  it('returns a stubbed session when Stripe is not configured', async () => {
    const session = await createCheckoutSession({}, input);
    expect(session.mode).toBe('stubbed');
    expect(session.amountCents).toBe(ADULT_GUEST_FEE_USD_CENTS);
    expect(session.url).toContain(input.successUrl);
    expect(session.url).toContain('simulated=1');
  });

  it('calls the Stripe API with the right shape when keyed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'cs_123', url: 'https://checkout.stripe.com/c/pay/cs_123' }),
    });
    const session = await createCheckoutSession({ secretKey: 'sk_test', fetchImpl }, input);
    expect(session).toEqual({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/c/pay/cs_123',
      amountCents: ADULT_GUEST_FEE_USD_CENTS,
      mode: 'live',
    });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test' });
    const body = init.body as string;
    expect(body).toContain('customer_email=guest%40example.com');
    expect(body).toContain('metadata%5Bguest_user_id%5D=u1');
  });

  it('throws when the Stripe API returns an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { message: 'invalid_request' } }),
    });
    await expect(createCheckoutSession({ secretKey: 'sk_test', fetchImpl }, input)).rejects.toThrow(
      'invalid_request',
    );
  });
});
