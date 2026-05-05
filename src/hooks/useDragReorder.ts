import type { DragEvent } from 'react';
import { useState } from 'react';

interface Identified {
  id: string;
}

export interface DragRowProps {
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

interface UseDragReorderResult {
  /** Currently dragging row id, or null. UI uses it to fade the source row. */
  dragId: string | null;
  /** Spread onto the row element (e.g. `<li {...rowProps(item.id)}>`). */
  rowProps: (rowId: string) => DragRowProps;
}

/**
 * HTML5 drag-and-drop reorder for a list of rows keyed by `id`. Same
 * shape used by the admin feed, agenda tags, and swag list — kept here
 * so all three behave identically (and so a future swap to a richer DnD
 * library only touches one file).
 *
 * Pass `disabled = true` to opt out of drag entirely (e.g. swag list
 * when swag selection is locked).
 */
export function useDragReorder<T extends Identified>(
  items: ReadonlyArray<T>,
  onReorder: (orderedIds: string[]) => void,
  disabled = false,
): UseDragReorderResult {
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(targetId: string): void {
    if (dragId === null || dragId === targetId) return;
    const fromIdx = items.findIndex((row) => row.id === dragId);
    const toIdx = items.findIndex((row) => row.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = items.slice();
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    onReorder(next.map((row) => row.id));
    setDragId(null);
  }

  function rowProps(rowId: string): DragRowProps {
    return {
      draggable: !disabled,
      onDragStart: () => setDragId(rowId),
      onDragOver: (event: DragEvent) => event.preventDefault(),
      onDrop: () => handleDrop(rowId),
      onDragEnd: () => setDragId(null),
    };
  }

  return { dragId, rowProps };
}
