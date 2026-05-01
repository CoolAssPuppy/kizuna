/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';

/**
 * Mount-only effect. Wraps useEffect with an explicit empty dependency
 * array so intent is unambiguous. Use this for one-time external sync
 * (DOM integration, third-party widget lifecycles, browser API
 * subscriptions) — not for state derivation or data fetching.
 *
 * For dynamic dependencies, prefer remounting via a parent `key` prop or
 * a TanStack Query.
 */
export function useMountEffect(effect: () => void | (() => void)): void {
  useEffect(effect, []);
}
