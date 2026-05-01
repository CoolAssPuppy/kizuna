import { useState } from 'react';

/**
 * Hydrate a local form-state slot from a TanStack Query result EXACTLY once.
 *
 * Every Section in this directory follows the same shape: render a controlled
 * form whose initial values come from a `useQuery` call. The fetched row is
 * mapped into a local `useState` so the user can edit freely without the
 * query cache fighting them. Before this hook landed each section reinvented
 * the same pattern:
 *
 *   const [values, setValues] = useState(EMPTY);
 *   const [synced, setSynced] = useState(false);
 *   if (!synced && hydrated) {
 *     setSynced(true);
 *     setValues(map(row));
 *   }
 *
 * The conditional-during-render setState is intentional — Section render is
 * idempotent until hydration completes. Centralising the pattern here keeps
 * the call sites short and prevents drift (one Section was checking
 * `!synced && hydrated && loaded` while the rest weren't).
 *
 * `mapper` runs ONCE on the first render after `hydrated` flips true. Pass a
 * stable reference (defined outside the component or memoised) — re-creating
 * it on every render is harmless because we only invoke it once.
 */
export function useHydratedFormState<TRow, TState>(
  hydrated: boolean,
  row: TRow,
  empty: TState,
  mapper: (row: TRow) => TState,
): [TState, React.Dispatch<React.SetStateAction<TState>>] {
  const [values, setValues] = useState<TState>(empty);
  const [synced, setSynced] = useState(false);
  if (!synced && hydrated) {
    setSynced(true);
    setValues(mapper(row));
  }
  return [values, setValues];
}
