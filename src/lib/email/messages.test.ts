import { describe, expect, it } from 'vitest';

import {
  deadlineReminderEmail,
  guestInvitationEmail,
  paymentReceiptEmail,
} from './messages';

describe('guestInvitationEmail', () => {
  const ctx = {
    guestEmail: 'alex@example.com',
    sponsorName: 'Paul Park',
    acceptUrl: 'https://kizuna.dev/accept-invitation?token=t1',
    eventName: 'Supafest 2027',
  };

  it('embeds the event name and accept URL', () => {
    const out = guestInvitationEmail(ctx);
    expect(out.subject).toContain('Supafest 2027');
    expect(out.html).toContain(ctx.acceptUrl);
    expect(out.text).toContain(ctx.acceptUrl);
  });

  it('escapes html-special characters in event names', () => {
    const out = guestInvitationEmail({ ...ctx, eventName: 'Best & Brightest <2027>' });
    expect(out.html).not.toContain('<2027>');
    expect(out.html).toContain('&lt;2027&gt;');
    expect(out.html).toContain('&amp;');
  });
});

describe('paymentReceiptEmail', () => {
  it('formats the amount as USD with currency symbol', () => {
    const out = paymentReceiptEmail({
      guestEmail: 'a@example.com',
      amountUsd: 950,
      paymentRef: 'pi_abc',
      eventName: 'Supafest 2027',
    });
    expect(out.html).toMatch(/\$950(?:\.00)?/);
    expect(out.text).toContain('pi_abc');
  });
});

describe('deadlineReminderEmail', () => {
  it('embeds the recipient name, task label, and url', () => {
    const out = deadlineReminderEmail({
      recipientName: 'Mae',
      taskLabel: 'Passport',
      deadlineIso: '2027-01-12T18:00:00Z',
      taskUrl: 'https://kizuna.dev/registration/passport',
    });
    expect(out.subject).toContain('Passport');
    expect(out.html).toContain('Passport');
    expect(out.text).toContain('Mae');
    expect(out.text).toContain('https://kizuna.dev/registration/passport');
  });
});
