interface StatusDotProps {
  /** Filled square indicator when active, hollow when not. */
  active?: boolean;
  /** Override color; defaults to the theme accent when active, dim when not. */
  color?: string;
  /** Pixel size of the dot; default 6px. */
  size?: number;
}

export function StatusDot({ active = true, color, size = 6 }: StatusDotProps): JSX.Element {
  const fill = color ?? (active ? 'var(--c-accent)' : 'var(--c-dim)');
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: active ? fill : 'transparent',
        boxShadow: active ? undefined : `inset 0 0 0 1px ${fill}`,
      }}
    />
  );
}
