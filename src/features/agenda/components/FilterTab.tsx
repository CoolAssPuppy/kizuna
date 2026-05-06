import { cn } from '@/lib/utils';

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

/**
 * Pill-style tab used by the agenda filter row. Extracted so the
 * agenda screen stays presentation-light and the same shape is reusable
 * if a future surface needs the same controls.
 */
export function FilterTab({ active, onClick, label }: FilterTabProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}
