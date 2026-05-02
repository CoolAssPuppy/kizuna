import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface KizunaConfig {
  url: string;
  tokenName: string;
  tokens: Record<string, { value: string; scope: string; expiresAt: string | null }>;
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
}

export async function clearConfig(): Promise<void> {
  await writeConfig({ url: '', tokenName: 'default', tokens: {} });
}
