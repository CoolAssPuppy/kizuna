/**
 * Lightweight markdown for chat. Supports **bold**, _italic_, __underline__,
 * [label](url), and bare http(s) URLs. Anything else renders as plain text.
 * Raw HTML is escaped on the way through, so untrusted user input cannot
 * inject tags. The function returns a sanitized HTML string.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function safeUrl(raw: string): string | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    return url.toString();
  } catch {
    return null;
  }
}

// Sentinel character outside the printable range so it cannot appear in
// real user input. Survives escapeHtml without being mangled.
const SENTINEL = '';

export function markdownToSafeHtml(input: string): string {
  if (!input) return '';

  // Step 1: extract markdown links into sentinel placeholders so that
  // the body escape and inline formatting passes don't disturb them.
  const links: string[] = [];
  const withPlaceholders = input.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (whole, label: string, href: string) => {
      const url = safeUrl(href);
      if (!url) return whole;
      const idx = links.length;
      links.push(
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
      );
      return `${SENTINEL}LINK${idx}${SENTINEL}`;
    },
  );

  // Step 2: escape everything else.
  const escaped = escapeHtml(withPlaceholders);

  // Step 3: __underline__ before _italic_ so the longer pattern wins.
  const formatted = escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // Step 4: linkify bare URLs.
  const linkified = formatted.replace(
    /(^|\s)(https?:\/\/[^\s<]+[^\s<.,!?;:'")\]])/g,
    (_, lead: string, url: string) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  // Step 5: drop the sentinel placeholders back in.
  const restored = linkified.replace(
    new RegExp(`${SENTINEL}LINK(\\d+)${SENTINEL}`, 'g'),
    (_, idx: string) => links[Number(idx)] ?? '',
  );

  // Step 6: line breaks last so we don't disturb earlier patterns.
  return restored.replace(/\n/g, '<br>');
}
