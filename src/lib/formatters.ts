/**
 * Shared Intl formatters. Defining them at module scope avoids the cost
 * of building a new Intl.DateTimeFormat per render. Locale stays
 * `undefined` so each formatter respects the viewer's browser locale —
 * Kizuna's i18next setup picks up `navigator.language` already.
 */

export const mediumDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const mediumDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

export const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});
