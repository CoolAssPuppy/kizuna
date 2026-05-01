/**
 * Single currency formatter used by every guest-flow surface (invite
 * dialog, fee tally, edit dialog). Co-located with the dialogs that
 * read it so a future locale split surfaces here naturally.
 */
export const CURRENCY_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
