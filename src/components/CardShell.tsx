import type { ReactNode } from 'react';

interface CardShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Visual container for a self-contained pane of content with a header
 * and optional action slot. Used by the profile editor cards, the
 * documents list, and admin report panels.
 */
export function CardShell({ title, description, actions, children }: CardShellProps): JSX.Element {
  return (
    <section
      className="border p-6 text-card-foreground"
      style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-rule)' }}
    >
      <header className="mb-4 flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="text-[11px] font-bold uppercase"
            style={{ color: 'var(--c-muted)', letterSpacing: '0.18em' }}
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
