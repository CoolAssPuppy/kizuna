import { describe, expect, it } from 'vitest';

import { findStepByPath, isStepComplete, nextPendingStep, WIZARD_STEPS } from './wizardSteps';
import type { RegistrationTaskRow } from './types';

function fakeTask(overrides: Partial<RegistrationTaskRow>): RegistrationTaskRow {
  return {
    id: crypto.randomUUID(),
    registration_id: 'r1',
    task_key: 'personal_info',
    status: 'pending',
    applies_to: 'all',
    deadline: null,
    completed_at: null,
    is_auto_completed: false,
    nudge_count: 0,
    last_nudge_at: null,
    ...overrides,
  };
}

describe('nextPendingStep', () => {
  it('returns the first step when no tasks exist yet', () => {
    expect(nextPendingStep([])).toEqual(WIZARD_STEPS[0]);
  });

  it('returns the first step that is still pending', () => {
    const tasks: RegistrationTaskRow[] = [
      fakeTask({ task_key: 'personal_info', status: 'complete' }),
      fakeTask({ task_key: 'passport', status: 'complete' }),
      fakeTask({ task_key: 'emergency_contact', status: 'pending' }),
      fakeTask({ task_key: 'dietary', status: 'pending' }),
    ];
    expect(nextPendingStep(tasks)?.taskKey).toBe('emergency_contact');
  });

  it('treats waived as done when finding the next pending step', () => {
    const tasks: RegistrationTaskRow[] = [
      fakeTask({ task_key: 'personal_info', status: 'waived' }),
      fakeTask({ task_key: 'passport', status: 'waived' }),
      fakeTask({ task_key: 'emergency_contact', status: 'pending' }),
    ];
    expect(nextPendingStep(tasks)?.taskKey).toBe('emergency_contact');
  });

  it('returns null when every wizard step is complete or waived', () => {
    const tasks: RegistrationTaskRow[] = WIZARD_STEPS.map((step) =>
      fakeTask({ task_key: step.taskKey, status: 'complete' }),
    );
    expect(nextPendingStep(tasks)).toBeNull();
  });
});

describe('findStepByPath', () => {
  it('returns the matching step for a known slug', () => {
    expect(findStepByPath('dietary')?.taskKey).toBe('dietary');
  });

  it('returns null for an unknown slug', () => {
    expect(findStepByPath('not-a-step')).toBeNull();
  });
});

describe('isStepComplete', () => {
  it('treats complete and waived as done', () => {
    expect(isStepComplete([fakeTask({ task_key: 'dietary', status: 'complete' })], 'dietary')).toBe(
      true,
    );
    expect(isStepComplete([fakeTask({ task_key: 'dietary', status: 'waived' })], 'dietary')).toBe(
      true,
    );
  });

  it('treats pending or skipped as not done', () => {
    expect(isStepComplete([fakeTask({ task_key: 'dietary', status: 'pending' })], 'dietary')).toBe(
      false,
    );
    expect(isStepComplete([fakeTask({ task_key: 'dietary', status: 'skipped' })], 'dietary')).toBe(
      false,
    );
  });
});
