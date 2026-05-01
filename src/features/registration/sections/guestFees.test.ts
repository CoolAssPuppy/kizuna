import { describe, expect, it } from 'vitest';

import type { AdditionalGuestRow, GuestInvitationRow } from '@/features/guests/types';

import { computeGuestFeeTotal } from './guestFees';

function inv(overrides: Partial<GuestInvitationRow> = {}): GuestInvitationRow {
  return {
    id: 'i-1',
    sponsor_id: 's-1',
    guest_email: 'g@x',
    full_name: 'Guest',
    age_bracket: 'adult',
    fee_amount: 950,
    signed_token: 't',
    status: 'pending',
    sent_at: '2027-01-01T00:00:00Z',
    accepted_at: null,
    expires_at: '2027-01-08T00:00:00Z',
    created_user_id: null,
    ...overrides,
  };
}

function minor(overrides: Partial<AdditionalGuestRow> = {}): AdditionalGuestRow {
  return {
    id: 'm-1',
    sponsor_id: 's-1',
    user_id: null,
    full_name: 'Kid',
    legal_name: null,
    age_bracket: 'under_12',
    fee_amount: 200,
    payment_status: 'pending',
    stripe_payment_id: null,
    dietary_restrictions: [],
    special_needs: [],
    notes: null,
    updated_at: '2027-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeGuestFeeTotal', () => {
  it('returns 0 when there are no guests', () => {
    expect(computeGuestFeeTotal([], [])).toBe(0);
  });

  it('sums adult invitations and minors together', () => {
    const total = computeGuestFeeTotal(
      [inv({ fee_amount: 950 }), inv({ id: 'i-2', fee_amount: 950 })],
      [minor({ fee_amount: 500 })],
    );
    expect(total).toBe(2400);
  });

  it('drops cancelled adult invitations from the total', () => {
    const total = computeGuestFeeTotal(
      [
        inv({ status: 'cancelled', fee_amount: 950 }),
        inv({ id: 'i-2', status: 'pending', fee_amount: 950 }),
      ],
      [],
    );
    expect(total).toBe(950);
  });

  it('keeps accepted adult invitations in the total', () => {
    const total = computeGuestFeeTotal([inv({ status: 'accepted', fee_amount: 950 })], []);
    expect(total).toBe(950);
  });

  it('coerces string-form numerics (Postgres numeric arrives as string)', () => {
    const total = computeGuestFeeTotal(
      [inv({ fee_amount: '950' as unknown as number })],
      [minor({ fee_amount: '200' as unknown as number })],
    );
    expect(total).toBe(1150);
  });
});
