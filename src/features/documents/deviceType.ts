/**
 * Map a User-Agent string to a coarse device type.
 *
 * The values match the document_acknowledgements.device_type check constraint:
 *   'mobile' | 'tablet' | 'desktop'.
 *
 * The detection is deliberately simple. We are recording the user's reported
 * device as part of a legal audit trail, not performing capability detection.
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

const TABLET_RE = /\b(ipad|tablet|playbook|silk)\b/i;
const MOBILE_RE = /\b(iphone|ipod|android.+mobile|blackberry|opera mini|windows phone|mobile)\b/i;

export function detectDeviceType(userAgent: string): DeviceType {
  if (TABLET_RE.test(userAgent)) return 'tablet';
  if (MOBILE_RE.test(userAgent)) return 'mobile';
  return 'desktop';
}
