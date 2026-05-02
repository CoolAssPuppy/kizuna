import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

/**
 * Hardened external anchor defaults.
 *
 * - always opens in a new tab
 * - always sets noopener/noreferrer
 * - allows caller-provided classes/attrs
 */
export function SafeExternalLink({
  children,
  rel,
  target,
  ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>): JSX.Element {
  const mergedRel = [rel, 'noopener', 'noreferrer'].filter(Boolean).join(' ');

  return (
    <a {...props} target={target ?? '_blank'} rel={mergedRel}>
      {children}
    </a>
  );
}
