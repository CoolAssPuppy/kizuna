/**
 * Pre-baked transactional email payloads.
 *
 * Each function takes the minimum context the message needs and returns
 * a `RenderedEmail`. Callers (edge functions, server side) hand the
 * rendered email to the configured driver (Resend in production, in-memory
 * outbox in dev).
 *
 * To add a new transactional email:
 *   1. Add a function below.
 *   2. Add a snapshot in supabase/email-templates/ for the Supabase
 *      dashboard's hosted templates if needed.
 *   3. Call from the relevant edge function via this module — never
 *      construct HTML inline.
 */

import { renderEmail, type RenderedEmail } from './template';

export interface InviteContext {
  guestEmail: string;
  sponsorName: string;
  acceptUrl: string;
  eventName: string;
}

export function guestInvitationEmail(ctx: InviteContext): RenderedEmail {
  return renderEmail({
    subject: `You're invited to ${ctx.eventName}`,
    preheader: `${ctx.sponsorName} has invited you. Accept within seven days.`,
    heading: `You're invited to ${ctx.eventName}`,
    bodyHtml: `
      <p>${ctx.sponsorName} has added you as a guest for ${escapeText(ctx.eventName)}. To confirm your spot, set a password and complete your profile within the next seven days.</p>
      <p>This link is unique to you. If you didn't expect this invitation, you can safely ignore the message.</p>
    `,
    cta: { label: 'Accept invitation', url: ctx.acceptUrl },
    text: `${ctx.sponsorName} invited you to ${ctx.eventName}. Accept within seven days at ${ctx.acceptUrl}`,
  });
}

export interface ReceiptContext {
  guestEmail: string;
  amountUsd: number;
  paymentRef: string;
  eventName: string;
}

export function paymentReceiptEmail(ctx: ReceiptContext): RenderedEmail {
  const formatted = ctx.amountUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  return renderEmail({
    subject: `Payment received for ${ctx.eventName}`,
    preheader: `${formatted} confirmed.`,
    heading: 'Payment received',
    bodyHtml: `
      <p>Thank you. We have charged your card ${formatted} for ${escapeText(ctx.eventName)}.</p>
      <p style="color: #a1a1aa; font-size: 12px;">Reference: ${escapeText(ctx.paymentRef)}</p>
    `,
    text: `Payment received: ${formatted} for ${ctx.eventName}. Reference ${ctx.paymentRef}.`,
  });
}

export interface DeadlineContext {
  recipientName: string;
  taskLabel: string;
  deadlineIso: string;
  taskUrl: string;
}

export function deadlineReminderEmail(ctx: DeadlineContext): RenderedEmail {
  const dateLabel = new Date(ctx.deadlineIso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return renderEmail({
    subject: `Reminder: ${ctx.taskLabel}`,
    preheader: `Due ${dateLabel}`,
    heading: `Hi ${ctx.recipientName}, we're missing your ${ctx.taskLabel.toLowerCase()}`,
    bodyHtml: `
      <p>This task is due on <strong>${escapeText(dateLabel)}</strong>. It only takes a couple of minutes.</p>
    `,
    cta: { label: 'Finish now', url: ctx.taskUrl },
    text: `Hi ${ctx.recipientName}, finish your ${ctx.taskLabel} by ${dateLabel}: ${ctx.taskUrl}`,
  });
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
