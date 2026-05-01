// Sponsor-side bundled checkout. Sums every pending guest_invitation +
// additional_guest fee for the calling user and opens one Stripe
// Checkout. The webhook (or the stub branch below) flips invitations
// to 'sent' and dispatches the invite email post-payment.

import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { publicUrl } from '../_shared/env.ts';
import { dispatchSponsorPaymentSucceeded } from '../_shared/sponsorPaymentFanOut.ts';
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

  const baseUrl = publicUrl();
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const successUrl = `${baseUrl}/payment-success`;
  const cancelUrl = `${baseUrl}/payment-cancelled`;

  if (!stripeKey) {
    // Stub branch — webhook is the source of truth in prod; we fan
    // out inline here so local dev still completes the loop.
    await dispatchSponsorPaymentSucceeded(sponsorUserId);
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
