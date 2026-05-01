/**
 * Section helpers shared across multi-select fieldsets (dietary,
 * accessibility, guests). Extracted so the same toggle logic doesn't
 * drift between sections.
 */

/** Returns a new array with `value` toggled — added if absent, removed if present. */
export function toggleArrayMember<T>(list: ReadonlyArray<T>, value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
