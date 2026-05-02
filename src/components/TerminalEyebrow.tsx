import type { ReactNode } from 'react';

interface TerminalEyebrowProps {
  /** Snake-case section label, e.g. "event.stats" or "queue · 3 items". */
  label: string;
  /** Optional right-aligned slot, e.g. "live" or sort indicator. */
  trailing?: ReactNode;
  /** Render with top + bottom rule (used for full-width section headers). */
  ruled?: boolean;
}

/**
 * Snake-case section heading with terminal eyebrow styling. The label is
 * transformed to uppercase via CSS so callers pass plain strings (good
 * for screen readers and for translators who don't have to repeat the
 * caps convention in every locale).
 */
export function TerminalEyebrow({
  label,
  trailing,
  ruled = false,
}: TerminalEyebrowProps): JSX.Element {
  return (
    <div
      className="flex items-center justify-between"
      style={
        ruled
          ? {
              borderTop: '1px solid var(--c-rule)',
              borderBottom: '1px solid var(--c-rule)',
              padding: '16px 0',
            }
          : undefined
      }
    >
      <span
        className="text-[11px] font-bold uppercase"
        style={{ color: 'var(--c-muted)', letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      {trailing ? (
        <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
