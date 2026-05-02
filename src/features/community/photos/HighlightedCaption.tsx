import { useId } from 'react';

import { captionTokens } from './captionParser';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
}

/**
 * Caption input that colors #hashtags and @mentions in the live preview.
 * Implementation: a <pre> renders the tokenised caption as the visible
 * layer, and a transparent <textarea> sits on top to capture input,
 * caret, and selection. Padding, font, and line-height match exactly so
 * the layers stay aligned at every cursor position.
 */
export function HighlightedCaption({
  value,
  onChange,
  placeholder,
  rows = 3,
  ariaLabel,
}: Props): JSX.Element {
  const id = useId();
  const tokens = captionTokens(value);
  // Trailing newline forces the highlight layer to grow with the
  // textarea on a final ENTER, otherwise the last line wraps to the
  // wrong height.
  const trailing = value.endsWith('\n') ? '​' : '';
  return (
    <div className="relative">
      <pre
        aria-hidden
        className="pointer-events-none m-0 min-h-[5.5rem] whitespace-pre-wrap break-words rounded-md border px-3 py-2 font-sans text-sm leading-6"
        style={{
          color: 'var(--c-fg)',
          backgroundColor: 'var(--c-surface-soft)',
          borderColor: 'var(--c-rule)',
        }}
      >
        {tokens.map((tok, i) =>
          tok.kind === 'hashtag' ? (
            <span key={`${id}-${i}`} style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
              #{tok.value}
            </span>
          ) : tok.kind === 'mention' ? (
            <span key={`${id}-${i}`} style={{ color: 'var(--c-accent-soft)', fontWeight: 600 }}>
              @{tok.value}
            </span>
          ) : (
            <span key={`${id}-${i}`}>{tok.value}</span>
          ),
        )}
        {trailing}
      </pre>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 m-0 h-full w-full resize-y rounded-md border bg-transparent px-3 py-2 font-sans text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          color: 'transparent',
          caretColor: 'var(--c-fg)',
          borderColor: 'var(--c-rule)',
        }}
      />
    </div>
  );
}
