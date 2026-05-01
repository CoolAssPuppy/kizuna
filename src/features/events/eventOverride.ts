import { useSyncExternalStore } from 'react';

/**
 * Per-browser admin override for "which event is the app showing."
 *
 * Default behaviour is unchanged: the home screen, itinerary, agenda, and
 * admin reports all read whichever event has `is_active = true`. Admins
 * can pick a different event from the All events screen, which writes
 * the chosen event id here. Once set, every consumer of useActiveEvent
 * reads against that override instead.
 *
 * Stored in localStorage so the override survives reloads. Cleared by
 * the All events screen via clearEventOverride().
 */

const STORAGE_KEY = 'kizuna:event-override';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

// Bind the cross-tab `storage` listener exactly once at module init so
// React StrictMode's double-subscribe in dev doesn't stack duplicate
// browser listeners on top of each other.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) emit();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useEventOverride(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setEventOverride(eventId: string): void {
  window.localStorage.setItem(STORAGE_KEY, eventId);
  emit();
}

export function clearEventOverride(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  emit();
}
