import type { RegistrationTaskKey, RegistrationTaskRow } from './types';

/**
 * Ordered registration steps. The order is part of the spec — consent
 * (waiver) always runs first, the rest run in onboarding order.
 *
 * Each step maps 1:1 to a `registration_tasks.task_key` so the database
 * trigger that maintains `registrations.completion_pct` works without
 * any client-side bookkeeping.
 */
export interface WizardStep {
  taskKey: RegistrationTaskKey;
  /** i18n key used to label the step in nav and headers. */
  i18nKey: string;
  /** Path segment under /registration. */
  path: string;
}

export const WIZARD_STEPS: ReadonlyArray<WizardStep> = [
  { taskKey: 'personal_info', i18nKey: 'registration.steps.personalInfo', path: 'personal-info' },
  { taskKey: 'passport', i18nKey: 'registration.steps.passport', path: 'passport' },
  {
    taskKey: 'emergency_contact',
    i18nKey: 'registration.steps.emergencyContact',
    path: 'emergency-contact',
  },
  { taskKey: 'dietary', i18nKey: 'registration.steps.dietary', path: 'dietary' },
  { taskKey: 'swag', i18nKey: 'registration.steps.swag', path: 'swag' },
  { taskKey: 'transport', i18nKey: 'registration.steps.transport', path: 'transport' },
];

/** Returns the slug of the first step that is still pending. */
export function nextPendingStep(tasks: ReadonlyArray<RegistrationTaskRow>): WizardStep | null {
  for (const step of WIZARD_STEPS) {
    const task = tasks.find((t) => t.task_key === step.taskKey);
    if (!task || task.status === 'pending') return step;
  }
  return null;
}

export function findStepByPath(path: string): WizardStep | null {
  return WIZARD_STEPS.find((step) => step.path === path) ?? null;
}

export function isStepComplete(
  tasks: ReadonlyArray<RegistrationTaskRow>,
  taskKey: RegistrationTaskKey,
): boolean {
  const task = tasks.find((t) => t.task_key === taskKey);
  return task?.status === 'complete' || task?.status === 'waived';
}
