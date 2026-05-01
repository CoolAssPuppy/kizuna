// Edge function: create-sponsor-fees-checkout
//
// The sponsor pays for every guest they invited (adults + minors) in
// a single Stripe Checkout. Bundling the fees into one payment is what
// gates the invite emails: the webhook only flips guest_invitations to
// 'sent' (and dispatches mail) once payment succeeds.
//
// Inputs:
//   - Authorization header (sponsor's JWT)
//
// Behaviour:
//   - Sums all guest_invitations rows for the sponsor in {pending, sent}
//     plus all additional_guests in payment_status='pending'.
//     'sent' invites can re-pay if a previous attempt half-failed.
//   - Calls Stripe with metadata.sponsor_user_id so the webhook can fan
//     the success out across both tables.
//   - Stub mode (no STRIPE_SECRET_KEY): synthesises a session id and
//     returns a /payment-success URL with simulated=1, mirroring the
//     pattern in create-stripe-checkout. Local dev still exercises the
//     redirect.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { getUserClient } from '../_shared/supabaseClient.ts';

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const client = getUserClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const sponsorUserId = userData.user.id;

  // Pull every fee owing for this sponsor. RLS narrows guest_invitations
  // and additional_guests to the sponsor's own rows.
  const [invitationsResp, minorsResp] = await Promise.all([
    client
      .from('guest_invitations')
      .select('id, fee_amount, status')
      .eq('sponsor_id', sponsorUserId)
      .in('status', ['pending', 'sent']),
    client
      .from('additional_guests')
      .select('id, fee_amount, payment_status')
      .eq('sponsor_id', sponsorUserId)
      .eq('payment_status', 'pending'),
  ]);
  if (invitationsResp.error || minorsResp.error) {
    return jsonResponse(
      { error: invitationsResp.error?.message ?? minorsResp.error?.message ?? 'lookup_failed' },
      { status: 500 },
    );
  }

  const adultTotal = (invitationsResp.data ?? []).reduce(
    (sum, row) => sum + Number(row.fee_amount),
    0,
  );
  const minorTotal = (minorsResp.data ?? []).reduce(
    (sum, row) => sum + Number(row.fee_amount),
    0,
  );
  const totalCents = Math.round((adultTotal + minorTotal) * 100);

  if (totalCents <= 0) {
    return jsonResponse({ error: 'nothing_to_pay' }, { status: 400 });
  }

  const publicUrl = Deno.env.get('KIZUNA_PUBLIC_URL') ?? 'http://localhost:5173';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const successUrl = `${publicUrl}/payment-success`;
  const cancelUrl = `${publicUrl}/payment-cancelled`;

  if (!stripeKey) {
    // Stub branch: simulate the success URL so the SPA flow continues.
    // The webhook is the source of truth in production; without Stripe
    // we run a tiny inline fan-out so dev still completes the loop.
    await dispatchPaymentSucceeded(sponsorUserId);
    const stubbedSessionId = `cs_stub_sponsor_${sponsorUserId}_${Date.now()}`;
    return jsonResponse({
      url: `${successUrl}?session_id=${stubbedSessionId}&simulated=1`,
      sessionId: stubbedSessionId,
    });
  }

  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    customer_email: userData.user.email ?? '',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(totalCents),
    'line_items[0][price_data][product_data][name]': 'Supafest 2027 guest fees',
    'line_items[0][quantity]': '1',
    'metadata[sponsor_user_id]': sponsorUserId,
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const body = (await response.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!response.ok || !body.id || !body.url) {
    return jsonResponse(
      { error: body.error?.message ?? 'stripe_failed' },
      { status: 502 },
    );
  }

  return jsonResponse({ url: body.url, sessionId: body.id });
});

/**
 * Local-dev fan-out: when Stripe isn't configured we still want the
 * SPA to land in the post-payment state. Mirrors what stripe-webhook
 * does on payment_intent.succeeded with sponsor_user_id metadata.
 */
async function dispatchPaymentSucceeded(sponsorUserId: string): Promise<void> {
  const { dispatchSponsorPaymentSucceeded } = await import(
    '../_shared/sponsorPaymentFanOut.ts'
  );
  await dispatchSponsorPaymentSucceeded(sponsorUserId);
}
