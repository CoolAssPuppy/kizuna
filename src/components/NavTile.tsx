import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface NavTileProps {
  to: string;
  title: string;
  description: string;
  highlight?: boolean;
}

export function NavTile({ to, title, description, highlight = false }: NavTileProps): JSX.Element {
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border p-6 transition-colors hover:bg-accent',
        highlight ? 'border-primary/40 bg-primary/5' : 'bg-card',
      )}
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
