interface PayloadShape {
  ok?: boolean;
  data?: unknown;
  markdown?: string;
  error?: { code: string; message: string };
}

export function formatOutput(payload: PayloadShape, format: 'json' | 'md'): string {
  if (format === 'md' && typeof payload.markdown === 'string') {
    return payload.markdown;
  }
  return JSON.stringify(payload.ok === true ? (payload.data ?? null) : payload, null, 2);
}
