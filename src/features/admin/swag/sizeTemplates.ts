/**
 * Size templates the admin form offers as one-click "fill the list with X".
 * Admins can still add or remove individual entries after applying a
 * template — the templates are starting points, not constraints.
 */

export interface SizeTemplate {
  /** i18n key for the button label (under adminSwag.templates). */
  labelKey: string;
  /** Stable id used as React key + chosen template marker. */
  id: 'apparel' | 'shoes_us' | 'shoes_eu';
  sizes: string[];
}

export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'] as const;

export const US_SHOE_SIZES = [
  '5',
  '5.5',
  '6',
  '6.5',
  '7',
  '7.5',
  '8',
  '8.5',
  '9',
  '9.5',
  '10',
  '10.5',
  '11',
  '11.5',
  '12',
  '12.5',
  '13',
] as const;

export const EU_SHOE_SIZES = [
  '36',
  '36.5',
  '37',
  '37.5',
  '38',
  '38.5',
  '39',
  '39.5',
  '40',
  '40.5',
  '41',
  '42',
  '42.5',
  '43',
  '43.5',
  '44',
  '44.5',
  '45',
  '46',
  '47',
  '48',
] as const;

export const SIZE_TEMPLATES: ReadonlyArray<SizeTemplate> = [
  { id: 'apparel', labelKey: 'adminSwag.templates.apparel', sizes: [...APPAREL_SIZES] },
  { id: 'shoes_us', labelKey: 'adminSwag.templates.shoesUs', sizes: [...US_SHOE_SIZES] },
  { id: 'shoes_eu', labelKey: 'adminSwag.templates.shoesEu', sizes: [...EU_SHOE_SIZES] },
];
