import type { RegistrationBundle } from '../types';

/**
 * A Section can render in two contexts:
 *  - inside the registration wizard (with task-completion side effects)
 *  - inside the Profile editor (with toast feedback)
 *
 * The Section components are the single source of truth for each domain
 * (personal info, dietary, etc.). The wizard and the profile both
 * render the same Section, only the chrome and post-save side effects
 * differ.
 */
export type SectionMode =
  | { kind: 'profile' }
  | { kind: 'wizard'; bundle: RegistrationBundle; onComplete: () => void };

export interface SectionProps {
  mode: SectionMode;
}
