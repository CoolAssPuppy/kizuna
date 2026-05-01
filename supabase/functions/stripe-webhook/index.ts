// Edge function: stripe-webhook
//
// Receives payment_intent.succeeded / payment_intent.payment_failed events.
// Updates guest_profiles.payment_status accordingly. We use service-role
// here because Stripe is anonymous to us — no JWT to scope by.
//
// Signature verification: when STRIPE_WEBHOOK_SECRET is configured we
// verify the Stripe-Signature header. Without it we accept the webhook
// in dev mode and log a warning.

import { getAdminClient } from '../_shared/supabaseClient.ts';

import { jsonResponse } from '../_shared/cors.ts';

const ENCODER = new TextEncoder();

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Stripe sends a header like "t=1234,v1=hex". We hash `${t}.${rawBody}`
  // with HMAC-SHA-256 and compare to the v1 component.
  const parts = signatureHeader.split(',').map((p) => p.split('='));
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signature = parts.find(([k]) => k === 'v1')?.[1];
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    ENCODER.encode(`${timestamp}.${rawBody}`),
  );
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time-ish compare: same length first.
  if (expectedHex.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const rawBody = await req.text();

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (webhookSecret) {
    const sig = req.headers.get('Stripe-Signature') ?? '';
    const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
    if (!valid) {
      return jsonResponse({ error: 'bad_signature' }, { status: 400 });
    }
  } else {
    console.warn('[kizuna] STRIPE_WEBHOOK_SECRET missing — skipping signature verification.');
  }

  // Stripe webhook payloads are documented but the SDK shape only
  // applies when we use `stripe.webhooks.constructEvent`. We sign-
  // verify above and parse JSON ourselves; this is the narrow set of
  // fields we read.
  interface StripeIntent {
    id?: string;
    metadata?: { guest_user_id?: string };
  }
  interface StripeEvent {
    type?: string;
    data?: { object?: StripeIntent };
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = getAdminClient();

  const intent = event.data?.object;
  const guestUserId = intent?.metadata?.guest_user_id;

  if (event.type === 'payment_intent.succeeded' && guestUserId) {
    await admin
      .from('guest_profiles')
      .update({
        payment_status: 'paid',
        stripe_payment_id: intent?.id ?? null,
      })
      .eq('user_id', guestUserId);
  } else if (event.type === 'payment_intent.payment_failed' && guestUserId) {
    await admin
      .from('guest_profiles')
      .update({ payment_status: 'failed' })
      .eq('user_id', guestUserId);
  }

  return jsonResponse({ received: true });
});
