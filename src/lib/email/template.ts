/**
 * Single source of truth for transactional email shape.
 *
 * Every email Kizuna sends — invitations, reminders, receipts, nudges,
 * Supabase Auth confirmations — runs through `wrapEmail`. The wrapper
 * adds the dark Supabase chrome (logo, footer, brand colors) so we
 * never have to update twenty templates when the brand evolves.
 *
 * Inline styles are unavoidable for email clients. We accept the verbosity
 * and centralise it here.
 */

import { emailTheme } from './theme';

export interface EmailContent {
  /** Subject line. */
  subject: string;
  /** Single line shown above the headline (e.g. "You're invited"). */
  preheader: string;
  /** Headline shown at the top of the body. */
  heading: string;
  /** Markdown-free HTML allowed inside the body. Keep it simple. */
  bodyHtml: string;
  /** Optional call-to-action button. */
  cta?: {
    label: string;
    url: string;
  };
  /** Plain-text fallback. */
  text: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const FOOTER_TEXT = 'Kizuna · Powered by Supabase';

export function renderEmail(content: EmailContent): RenderedEmail {
  const { colors, fonts, spacing } = emailTheme;

  const cta = content.cta
    ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td>
              <a href="${escapeAttr(content.cta.url)}" style="
                display: inline-block;
                padding: 12px 24px;
                background-color: ${colors.primary};
                color: ${colors.primaryText};
                font-family: ${fonts.sans};
                font-size: 14px;
                font-weight: 600;
                text-decoration: none;
                border-radius: ${spacing.radius};
              ">${escapeText(content.cta.label)}</a>
            </td>
          </tr>
        </table>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeText(content.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: ${fonts.sans}; color: ${colors.text};">
  <span style="display: none; font-size: 1px; color: ${colors.background}; max-height: 0; overflow: hidden;">${escapeText(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="padding: 0 ${spacing.pad} 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="
                      display: inline-block;
                      width: 32px;
                      height: 32px;
                      background-color: ${colors.surfaceMuted};
                      color: ${colors.text};
                      font-family: ${fonts.sans};
                      font-weight: 700;
                      font-size: 18px;
                      text-align: center;
                      line-height: 32px;
                      border-radius: 8px;
                    ">絆</span>
                    <span style="font-family: ${fonts.sans}; color: ${colors.text}; font-weight: 600; font-size: 14px; padding-left: 8px; vertical-align: middle;">Kizuna</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: ${spacing.radius}; padding: ${spacing.pad};">
              <h1 style="margin: 0 0 12px; font-family: ${fonts.sans}; color: ${colors.text}; font-size: 24px; font-weight: 600; line-height: 1.25;">${escapeText(content.heading)}</h1>
              <div style="font-family: ${fonts.sans}; color: ${colors.text}; font-size: 14px; line-height: 22px;">${content.bodyHtml}</div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px ${spacing.pad}; font-family: ${fonts.sans}; color: ${colors.textMuted}; font-size: 12px; line-height: 18px;">
              ${escapeText(FOOTER_TEXT)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: content.subject,
    html,
    text: content.text,
  };
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
