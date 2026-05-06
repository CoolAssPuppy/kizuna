import { joinFullName, resolveProfileName } from '@/lib/fullName';
import { flatJoin, type AppSupabaseClient } from '@/lib/supabase';

import type { CsvRow } from '../csv';

export interface PaymentReconciliationRow extends CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  guests: string;
  total_due: number;
  total_received: number;
  payment_status: string;
  stripe_payment_id: string;
}

interface GuestPaymentLeg {
  first_name: string;
  last_name: string;
  fee_amount: number | null;
  payment_status: string;
  stripe_payment_id: string | null;
}

/** Returns null when the employee has no guests so the caller can skip the row. */
function summarizePaymentLegs(legs: ReadonlyArray<GuestPaymentLeg>): {
  guests: string;
  total_due: number;
  total_received: number;
  payment_status: string;
  stripe_payment_id: string;
} | null {
  if (legs.length === 0) return null;
  let totalDue = 0;
  let totalReceived = 0;
  const guestNames: string[] = [];
  const stripeIds: string[] = [];
  const statusSet = new Set<string>();
  for (const leg of legs) {
    const fee = leg.fee_amount ?? 0;
    totalDue += fee;
    if (leg.payment_status === 'paid') totalReceived += fee;
    statusSet.add(leg.payment_status);
    const fullName = joinFullName(leg.first_name, leg.last_name);
    if (fullName) guestNames.push(fullName);
    if (leg.stripe_payment_id) stripeIds.push(leg.stripe_payment_id);
  }
  const status = statusSet.size === 1 ? [...statusSet][0]! : 'mixed';
  return {
    guests: guestNames.join(', '),
    total_due: totalDue,
    total_received: totalReceived,
    payment_status: status,
    stripe_payment_id: stripeIds.join(', '),
  };
}

export async function fetchPaymentReconciliation(
  client: AppSupabaseClient,
): Promise<PaymentReconciliationRow[]> {
  const { data, error } = await client
    .from('users')
    .select(
      `
      email,
      employee_profiles ( first_name, last_name, preferred_name, legal_name ),
      sponsored_guests:guest_profiles!guest_profiles_sponsor_id_fkey (
        first_name, last_name, fee_amount, payment_status, stripe_payment_id
      ),
      sponsored_dependents:additional_guests!additional_guests_sponsor_id_fkey (
        first_name, last_name, fee_amount, payment_status, stripe_payment_id
      )
    `,
    )
    .eq('role', 'employee');
  if (error) throw error;

  const rows: PaymentReconciliationRow[] = [];
  for (const row of data ?? []) {
    const sponsored = [
      ...(row.sponsored_guests ?? []),
      ...(row.sponsored_dependents ?? []),
    ] as GuestPaymentLeg[];
    const summary = summarizePaymentLegs(sponsored);
    if (!summary) continue;
    const { first, last } = resolveProfileName(flatJoin(row.employee_profiles), null);
    rows.push({
      first_name: first,
      last_name: last,
      email: row.email ?? '',
      ...summary,
    });
  }
  rows.sort((a, b) => a.payment_status.localeCompare(b.payment_status));
  return rows;
}
