import { activeToken, type KizunaConfig } from './config';

interface CliResponse {
  ok: boolean;
  data?: unknown;
  format?: 'json' | 'md';
  markdown?: string;
  error?: { code: string; message: string; details?: unknown };
  request_id?: string;
}

export async function runRemoteCommand(
  config: KizunaConfig,
  command: string,
  format: 'json' | 'md',
): Promise<CliResponse> {
  const token = activeToken(config);
  if (!token) {
    throw new Error('Run `kizuna login` first.');
  }
  if (!config.url) {
    throw new Error('No Kizuna URL configured. Re-run `kizuna login --url <host>`.');
  }

  const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/cli`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, format }),
  });

  let payload: CliResponse;
  try {
    payload = (await response.json()) as CliResponse;
  } catch {
    throw new Error(`Kizuna returned a non-JSON response (HTTP ${response.status}).`);
  }
  return payload;
}
