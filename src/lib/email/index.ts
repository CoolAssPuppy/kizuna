/**
 * Public surface of the email library. One import path, one place to
 * change.
 */

export { emailTheme } from './theme';
export type { EmailTheme } from './theme';
export { renderEmail } from './template';
export type { EmailContent, RenderedEmail } from './template';
export { guestInvitationEmail, paymentReceiptEmail, deadlineReminderEmail } from './messages';
