/**
 * Barrel for registration data access.
 *
 * Each domain (personal info, dietary, etc.) lives in its own file so the
 * import surface stays focused. The Section components and tests should
 * import the helpers they need directly from the matching file rather
 * than pulling everything through this barrel — but the barrel exists for
 * consumers (admin reports, integrations) that need the full toolkit.
 */

export * from './accessibility';
export * from './additionalGuests';
export * from './attending';
export * from './dietary';
export * from './emergencyContact';
export * from './passport';
export * from './personalInfo';
export * from './registration';
export * from './swag';
