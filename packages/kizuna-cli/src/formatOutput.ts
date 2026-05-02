export function formatOutput(payload: unknown, format: 'json' | 'md'): string {
  if (format === 'md' && isMarkdownPayload(payload)) return payload.markdown;
  return JSON.stringify(payload, null, 2);
}

function isMarkdownPayload(payload: unknown): payload is { markdown: string } {
  return typeof payload === 'object' && payload !== null && 'markdown' in payload;
}
