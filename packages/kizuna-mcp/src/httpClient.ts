export async function runKizunaCommand(command: string, format: 'json' | 'md'): Promise<unknown> {
  const url = process.env.KIZUNA_URL;
  const token = process.env.KIZUNA_TOKEN;
  if (!url || !token) {
    throw new Error('Set KIZUNA_URL and KIZUNA_TOKEN before starting @kizuna/mcp.');
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/cli`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, format }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
  return payload;
}
