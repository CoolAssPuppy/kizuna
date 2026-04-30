# Email templates

Paste-ready HTML for Supabase Auth's hosted email templates. The dashboard
lives at **Authentication → Email Templates**.

All templates here are rendered with the same dark Supabase theme defined in
`src/lib/email/theme.ts`. When the brand evolves, update that file (and
`src/lib/email/template.ts`) and re-run the snapshot script:

```bash
npm run email:snapshot
```

The script regenerates these files from the canonical TypeScript template
so this directory and the runtime stay in lockstep.

## Files

| File                        | Maps to                          | Variables                                    |
| --------------------------- | -------------------------------- | -------------------------------------------- |
| `confirm-signup.html`       | "Confirm signup"                 | `{{ .ConfirmationURL }}`, `{{ .Email }}`     |
| `magic-link.html`           | "Magic Link"                     | `{{ .ConfirmationURL }}`                     |
| `invite-user.html`          | "Invite user"                    | `{{ .ConfirmationURL }}`, `{{ .Email }}`     |
| `reset-password.html`       | "Reset Password"                 | `{{ .ConfirmationURL }}`                     |
| `change-email.html`         | "Change Email Address"           | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}`  |
| `reauthenticate.html`       | "Reauthentication"               | `{{ .Token }}`                               |

Supabase substitutes the `{{ . }}` placeholders at send time. The
templates here use those exact strings unaltered.

## Dark mode

Email clients vary wildly in CSS support. This template uses inline styles
exclusively and lives entirely on a near-black background so it looks
intentional in every client — not "the light theme broke for me."

## Adding a new template

1. Add a function to `src/lib/email/messages.ts` returning a
   `RenderedEmail`.
2. Add a snapshot entry to `scripts/snapshot-email-templates.ts`.
3. Run `npm run email:snapshot`.
4. Commit the regenerated `.html` files.
