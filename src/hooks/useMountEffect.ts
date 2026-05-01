import { useEffect } from 'react';

/**
 * The only sanctioned wrapper for `useEffect`. Runs once on mount and
 * (if a cleanup is returned) on unmount. Using this hook makes the
 * "this is genuinely a one-time external sync" intent explicit; every
 * other useEffect call is forbidden by `no-restricted-syntax`.
 *
 * See `~/.claude/skills/no-use-effect/SKILL.md` for the playbook on
 * when each rule applies.
 */
export function useMountEffect(effect: () => void | (() => void)): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
