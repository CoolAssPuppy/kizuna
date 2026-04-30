/**
 * Regenerates supabase/email-templates/*.html from the canonical
 * TypeScript template. Run with:
 *
 *   npx tsx scripts/snapshot-email-templates.ts
 *
 * Or via the npm alias:
 *
 *   npm run email:snapshot
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderEmail } from '../src/lib/email/template';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'supabase', 'email-templates');
mkdirSync(outDir, { recursive: true });

interface Snapshot {
  filename: string;
  subject: string;
  preheader: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  text: string;
}

// Note on placeholders: Supabase Auth's hosted templates use `{{ .Foo }}`
// substitution. The strings flow through renderEmail() which HTML-escapes
// the heading and subject, but our templates avoid putting placeholders
// in those fields so the substitution remains literal in the output.
const snapshots: ReadonlyArray<Snapshot> = [
  {
    filename: 'confirm-signup.html',
    subject: 'Confirm your Kizuna account',
    preheader: 'One tap to confirm.',
    heading: 'Confirm your account',
    bodyHtml:
      '<p>Welcome to Kizuna. Confirm the email address {{ .Email }} so you can sign in to manage your event registration.</p>',
    cta: { label: 'Confirm email', url: '{{ .ConfirmationURL }}' },
    text: 'Confirm your Kizuna account: {{ .ConfirmationURL }}',
  },
  {
    filename: 'magic-link.html',
    subject: 'Your Kizuna sign-in link',
    preheader: 'Tap to sign in. Expires in 60 minutes.',
    heading: 'Sign in to Kizuna',
    bodyHtml: '<p>Use the button below to sign in. The link expires in 60 minutes.</p>',
    cta: { label: 'Sign in', url: '{{ .ConfirmationURL }}' },
    text: 'Sign in to Kizuna: {{ .ConfirmationURL }}',
  },
  {
    filename: 'invite-user.html',
    subject: 'You have been invited to Kizuna',
    preheader: 'Accept your invitation to get started.',
    heading: 'You have been invited',
    bodyHtml:
      '<p>{{ .Email }} has been invited to Kizuna. Accept the invitation to set a password and access your registration.</p>',
    cta: { label: 'Accept invitation', url: '{{ .ConfirmationURL }}' },
    text: 'Accept your Kizuna invitation: {{ .ConfirmationURL }}',
  },
  {
    filename: 'reset-password.html',
    subject: 'Reset your Kizuna password',
    preheader: 'Choose a new password.',
    heading: 'Reset your password',
    bodyHtml: '<p>Use the link below to choose a new password. It expires in 60 minutes.</p>',
    cta: { label: 'Reset password', url: '{{ .ConfirmationURL }}' },
    text: 'Reset your Kizuna password: {{ .ConfirmationURL }}',
  },
  {
    filename: 'change-email.html',
    subject: 'Confirm your new email address',
    preheader: 'Final step to update your email.',
    heading: 'Confirm your new email',
    bodyHtml:
      '<p>Your Kizuna account email is changing to {{ .NewEmail }}. Confirm to complete the change.</p>',
    cta: { label: 'Confirm email change', url: '{{ .ConfirmationURL }}' },
    text: 'Confirm your new email: {{ .ConfirmationURL }}',
  },
  {
    filename: 'reauthenticate.html',
    subject: 'Reauthentication code for Kizuna',
    preheader: 'Use this code to confirm a sensitive change.',
    heading: 'Your reauthentication code',
    bodyHtml:
      '<p>Use the following code to confirm a sensitive change to your Kizuna account.</p>' +
      '<p style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #3ECF8E;">{{ .Token }}</p>',
    text: 'Reauthentication code: {{ .Token }}',
  },
];

for (const snapshot of snapshots) {
  const rendered = renderEmail({
    subject: snapshot.subject,
    preheader: snapshot.preheader,
    heading: snapshot.heading,
    bodyHtml: snapshot.bodyHtml,
    ...(snapshot.cta ? { cta: snapshot.cta } : {}),
    text: snapshot.text,
  });
  writeFileSync(resolve(outDir, snapshot.filename), rendered.html, 'utf8');
  console.log(`wrote ${snapshot.filename}`);
}
