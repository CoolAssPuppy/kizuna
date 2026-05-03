import { cn } from '@/lib/utils';

import type { SessionTag } from './tagsApi';

interface Props {
  tag: SessionTag;
  className?: string;
}

/**
 * Reads the foreground color from the tag's background luminance so
 * pills stay legible whether the admin picked a pastel or a deep tone.
 */
function readableForeground(hex: string): string {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return '#fff';
  const v = parseInt(match[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // Rec. 709 luma — fast and good enough for badge contrast.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6 ? '#0f172a' : '#ffffff';
}

export function TagPill({ tag, className }: Props): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight',
        className,
      )}
      style={{ backgroundColor: tag.color, color: readableForeground(tag.color) }}
    >
      {tag.name}
    </span>
  );
}

interface TagPillsProps {
  tags: ReadonlyArray<SessionTag>;
  className?: string;
}

export function TagPills({ tags, className }: TagPillsProps): JSX.Element | null {
  if (tags.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {tags.map((tag) => (
        <TagPill key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
