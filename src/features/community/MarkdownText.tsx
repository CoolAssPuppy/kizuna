import type { ReactNode } from 'react';
import { Fragment } from 'react';

/**
 * Renders chat markdown as a React node tree. Supports **bold**,
 * _italic_, __underline__, [label](url), and bare http(s) URLs. Anything
 * else falls through as plain text. The tokenizer is whitespace-agnostic
 * but does not recurse — chat markdown is intentionally limited.
 */

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'underline'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'br' };

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|_([^_\n]+)_|(https?:\/\/[^\s<]+[^\s<.,!?;:'")\]])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: 'text', value: line.slice(last, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = m[2];
      if (isHttpUrl(href)) {
        tokens.push({ kind: 'link', label: m[1], href });
      } else {
        tokens.push({ kind: 'text', value: m[0] });
      }
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'bold', value: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ kind: 'underline', value: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: 'italic', value: m[5] });
    } else if (m[6] !== undefined && isHttpUrl(m[6])) {
      tokens.push({ kind: 'link', label: m[6], href: m[6] });
    } else {
      tokens.push({ kind: 'text', value: m[0] });
    }
    last = pattern.lastIndex;
  }
  if (last < line.length) {
    tokens.push({ kind: 'text', value: line.slice(last) });
  }
  return tokens;
}

function tokenize(input: string): Token[] {
  const lines = input.split('\n');
  const out: Token[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    out.push(...tokenizeLine(lines[i] ?? ''));
    if (i < lines.length - 1) out.push({ kind: 'br' });
  }
  return out;
}

function tokenToNode(token: Token, key: number): ReactNode {
  switch (token.kind) {
    case 'text':
      return <Fragment key={key}>{token.value}</Fragment>;
    case 'bold':
      return <strong key={key}>{token.value}</strong>;
    case 'italic':
      return <em key={key}>{token.value}</em>;
    case 'underline':
      return <u key={key}>{token.value}</u>;
    case 'link':
      return (
        <a key={key} href={token.href} target="_blank" rel="noopener noreferrer">
          {token.label}
        </a>
      );
    case 'br':
      return <br key={key} />;
  }
}

interface Props {
  source: string;
}

export function MarkdownText({ source }: Props): JSX.Element {
  const tokens = tokenize(source);
  return <>{tokens.map((t, i) => tokenToNode(t, i))}</>;
}
