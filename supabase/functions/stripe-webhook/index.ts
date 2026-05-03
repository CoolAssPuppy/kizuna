// Edge function: stripe-webhook
//
// Two distinct flows route through this webhook:
//
//   * `checkout.session.completed` (PRIMARY): the bundled sponsor
//     checkout opens a Stripe Checkout Session and stamps
//     metadata.sponsor_user_id. The session — not the underlying
//     PaymentIntent — is what carries the metadata, so we must listen
//     on this event for the fan-out (invitations pending → sent +
//     invite emails) to fire.
//
//   * `payment_intent.{succeeded,payment_failed}` (LEGACY): the
//     single-guest checkout (`create-stripe-checkout`) charges the
//     guest's own seat and stamps metadata.guest_user_id on the intent.
//     This still fires for that flow.
//
// Updates use the admin client because Stripe is anonymous to us —
// no JWT to scope by.
//
// Signature verification: when STRIPE_WEBHOOK_SECRET is configured we
// verify the Stripe-Signature header. Without it we accept the webhook
// in dev mode and log a warning.

import { getAdminClient } from '../_shared/supabaseClient.ts';
import { dispatchSponsorPaymentSucceeded } from '../_shared/sponsorPaymentFanOut.ts';

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
  const expected = await crypto.subtle.sign('HMAC', key, ENCODER.encode(`${timestamp}.${rawBody}`));
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
  // fields we read across the supported event types.
  interface StripeObject {
    id?: string;
    payment_status?: string;
    metadata?: { guest_user_id?: string; sponsor_user_id?: string };
  }
  interface StripeEvent {
    type?: string;
    data?: { object?: StripeObject };
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = getAdminClient();
  const obj = event.data?.object;
  const guestUserId = obj?.metadata?.guest_user_id;
  const sponsorUserId = obj?.metadata?.sponsor_user_id;

  switch (event.type) {
    // Bundled sponsor checkout — primary success signal. The Session
    // (not the PaymentIntent) carries metadata.sponsor_user_id.
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      // Async payment methods (e.g. Klarna, ACH) flip
      // payment_status='paid' on the async_payment_succeeded event;
      // checkout.session.completed for card payments is already paid.
      // Be defensive and only fan out when payment_status indicates
      // success — Stripe also fires session.completed for unpaid
      // sessions (e.g. setup mode), which we never want to act on.
      if (obj?.payment_status === 'paid' && sponsorUserId) {
        await dispatchSponsorPaymentSucceeded(sponsorUserId);
      }
      // The single-guest legacy flow still uses Checkout Session too;
      // mirror the same metadata read here.
      if (obj?.payment_status === 'paid' && guestUserId) {
        await admin
          .from('guest_profiles')
          .update({ payment_status: 'paid', stripe_payment_id: obj.id ?? null })
          .eq('user_id', guestUserId);
      }
      break;
    }
    case 'checkout.session.async_payment_failed': {
      if (guestUserId) {
        await admin
          .from('guest_profiles')
          .update({ payment_status: 'failed' })
          .eq('user_id', guestUserId);
      }
      break;
    }
    // Legacy events kept for forward compatibility — older single-
    // guest charge flows that posted PaymentIntent metadata still work.
    case 'payment_intent.succeeded': {
      if (sponsorUserId) {
        await dispatchSponsorPaymentSucceeded(sponsorUserId);
      }
      if (guestUserId) {
        await admin
          .from('guest_profiles')
          .update({ payment_status: 'paid', stripe_payment_id: obj?.id ?? null })
          .eq('user_id', guestUserId);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      if (guestUserId) {
        await admin
          .from('guest_profiles')
          .update({ payment_status: 'failed' })
          .eq('user_id', guestUserId);
      }
      break;
    }
  }

  return jsonResponse({ received: true });
});
