import type { KizunaConfig } from './config';

export async function runRemoteCommand(
  config: KizunaConfig,
  command: string,
  format: 'json' | 'md',
): Promise<unknown> {
  const token = config.tokens[config.tokenName]?.value;
  if (!token) {
    throw new Error('Run `kizuna login --token <token> --url <url>` first.');
  }

  const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/cli`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, format }),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}
