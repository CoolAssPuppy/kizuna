/**
 * Stripe checkout wrapper.
 *
 * Like resend.ts, this never runs in the browser bundle in production. The
 * client redirects to a checkout URL returned by an edge function. The
 * module exists for shared types and dev/test stubs.
 *
 * Stripe fees per spec: $950 for an adult guest, $500 for a child 12+.
 */

import type { IntegrationStatus } from './types';

export const ADULT_GUEST_FEE_USD_CENTS = 95_000;
export const CHILD_GUEST_FEE_USD_CENTS = 50_000;

export type GuestFeeTier = 'adult' | 'child';

export function feeForTier(tier: GuestFeeTier): number {
  return tier === 'adult' ? ADULT_GUEST_FEE_USD_CENTS : CHILD_GUEST_FEE_USD_CENTS;
}

export interface CheckoutSessionInput {
  guestUserId: string;
  guestEmail: string;
  tier: GuestFeeTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  amountCents: number;
  mode: 'live' | 'stubbed';
}

interface DriverConfig {
  secretKey?: string | undefined;
  fetchImpl?: typeof fetch;
}

export function stripeStatus(config: DriverConfig): IntegrationStatus {
  return config.secretKey
    ? { mode: 'live' }
    : { mode: 'stubbed', reason: 'STRIPE_SECRET_KEY missing' };
}

async function createCheckoutSessionLive(
  config: DriverConfig & { secretKey: string },
  input: CheckoutSessionInput,
): Promise<CheckoutSession> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const amountCents = feeForTier(input.tier);

  const params = new URLSearchParams({
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.guestEmail,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][price_data][product_data][name]':
      input.tier === 'adult' ? 'Supafest 2027 guest fee' : 'Supafest 2027 child fee',
    'line_items[0][quantity]': '1',
    'metadata[guest_user_id]': input.guestUserId,
    'metadata[tier]': input.tier,
  });

  const response = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const body = (await response.json()) as {
    id?: string;
    url?: string;
    error?: { message: string };
  };
  if (!response.ok || !body.id || !body.url) {
    throw new Error(body.error?.message ?? `Stripe checkout failed (${response.status})`);
  }
  return { id: body.id, url: body.url, amountCents, mode: 'live' };
}

function createCheckoutSessionStub(input: CheckoutSessionInput): CheckoutSession {
  const id = `cs_stub_${input.guestUserId}_${Date.now()}`;
  // The stub URL points back at the success URL with a fake session id so
  // local development can complete the redirect dance.
  const url = `${input.successUrl}?session_id=${id}&simulated=1`;
  return { id, url, amountCents: feeForTier(input.tier), mode: 'stubbed' };
}

export function createCheckoutSession(
  config: DriverConfig,
  input: CheckoutSessionInput,
): Promise<CheckoutSession> {
  if (stripeStatus(config).mode === 'stubbed') {
    return Promise.resolve(createCheckoutSessionStub(input));
  }
  return createCheckoutSessionLive(config as DriverConfig & { secretKey: string }, input);
}
