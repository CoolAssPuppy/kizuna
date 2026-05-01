import { useState } from 'react';

// Hydrate a local form-state slot from a TanStack query result on the
// first render where `hydrated` flips true. The conditional setState
// during render is intentional — it only fires on the hydration edge.
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
