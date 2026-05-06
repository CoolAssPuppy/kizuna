import { Button } from '@/components/ui/button';

interface IconActionProps {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Square icon-only button with a tooltip-style title for the admin
 * toolbars (download CSV, import CSV, etc). Keeps the action row
 * dense without sacrificing accessibility.
 */
export function IconAction({ icon, label, onClick, disabled }: IconActionProps): JSX.Element {
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
