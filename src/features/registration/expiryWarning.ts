/**
 * Returns true when a passport's expiry date is less than six months after
 * the end of an event. Many countries refuse entry to passports with under
 * six months of validity remaining, so this is a real travel-blocking rule.
 *
 * Pure helper extracted from PassportStep so the threshold logic can be
 * unit-tested without rendering the form.
 */
export function isExpiryRiskyForEvent(
  passportExpiryDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): boolean {
  if (!passportExpiryDate || !eventEndDate) return false;
  const expiry = new Date(passportExpiryDate);
  const end = new Date(eventEndDate);
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(end.getTime())) return false;

  const sixMonthsAfter = new Date(end);
  sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6);

  return expiry < sixMonthsAfter;
}
