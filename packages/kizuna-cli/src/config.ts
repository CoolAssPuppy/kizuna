// Tiny per-user config store. Persists to ~/.kizuna/config.json with
// 0600 permissions so other accounts on the host cannot read PATs.
// We never ship the token in plaintext over the wire after the
// initial OAuth bootstrap; this file is the only durable copy.

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ConfigToken {
  value: string;
  scope: ApiKeyScope;
  expiresAt: string | null;
}

export interface KizunaConfig {
  url: string;
  tokenName: string;
  tokens: Record<string, ConfigToken>;
}

const CONFIG_PATH = join(homedir(), '.kizuna', 'config.json');

export async function readConfig(): Promise<KizunaConfig | null> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as KizunaConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: KizunaConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  // Best-effort chmod; on Windows this is a no-op but doesn't throw.
  try {
    await chmod(CONFIG_PATH, 0o600);
  } catch {
    /* ignore platforms without POSIX permissions */
  }
}

export async function clearConfig(): Promise<void> {
  await writeConfig({ url: '', tokenName: 'default', tokens: {} });
}

export function activeToken(config: KizunaConfig): ConfigToken | null {
  return config.tokens[config.tokenName] ?? null;
}

export const CONFIG_FILE = CONFIG_PATH;
