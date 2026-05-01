// Edge function: create-stripe-checkout
//
// Authenticated guest asks Kizuna to start a checkout session. Falls back
// to a stubbed redirect when STRIPE_SECRET_KEY is missing so local dev
// can complete the flow end-to-end.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { publicUrl } from '../_shared/env.ts';
import { getUserClient } from '../_shared/supabaseClient.ts';

const ADULT_FEE_CENTS = 95_000;
const CHILD_FEE_CENTS = 50_000;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const baseUrl = publicUrl();

  const client = getUserClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 });
  }
  const guestUserId = userData.user.id;

  const { data: profile, error: profileError } = await client
    .from('guest_profiles')
    .select('full_name, payment_status, fee_amount')
    .eq('user_id', guestUserId)
    .maybeSingle();
  if (profileError || !profile) {
    return jsonResponse({ error: 'guest_profile_not_found' }, { status: 404 });
  }

  // Phase 1: every guest is charged the adult fee. Children fee handled
  // when the children step ships and the age computation lands.
  const amountCents = ADULT_FEE_CENTS;
  const successUrl = `${baseUrl}/payment-success`;
  const cancelUrl = `${baseUrl}/payment-cancelled`;

  if (!stripeKey) {
    const stubbedSessionId = `cs_stub_${guestUserId}_${Date.now()}`;
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
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][price_data][product_data][name]': 'Supafest 2027 guest fee',
    'line_items[0][quantity]': '1',
    'metadata[guest_user_id]': guestUserId,
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

  // Stamp the pending session id on the guest profile so the webhook can
  // reconcile by metadata if needed.
  await client
    .from('guest_profiles')
    .update({ stripe_payment_id: body.id, fee_amount: amountCents / 100 })
    .eq('user_id', guestUserId);

  return jsonResponse({ url: body.url, sessionId: body.id });
});
