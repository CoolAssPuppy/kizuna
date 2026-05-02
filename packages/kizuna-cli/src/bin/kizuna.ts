#!/usr/bin/env node
import { clearConfig, readConfig, writeConfig } from '../config';
import { formatOutput } from '../formatOutput';
import { runRemoteCommand } from '../httpClient';

const args = process.argv.slice(2);

async function main(): Promise<void> {
  const command = args[0];
  if (!command || command === '--help') {
    printHelp();
    return;
  }

  if (command === 'login') {
    await login();
    return;
  }

  if (command === 'logout') {
    await clearConfig();
    console.info('Logged out.');
    return;
  }

  const format = readFlag('--format') === 'md' ? 'md' : 'json';
  const profile = readFlag('--profile');
  const config = await readConfig();
  if (!config) throw new Error('Run `kizuna login --token <token> --url <url>` first.');
  const effective = profile ? { ...config, tokenName: profile } : config;
  const cleaned = args.filter((arg, index) => {
    const previous = args[index - 1];
    return arg !== '--format' && previous !== '--format' && arg !== '--profile' && previous !== '--profile';
  });
  const payload = await runRemoteCommand(effective, cleaned.join(' '), format);
  console.info(formatOutput(payload, format));
}

async function login(): Promise<void> {
  const url = readFlag('--url') ?? process.env.KIZUNA_URL;
  const token = readFlag('--token') ?? process.env.KIZUNA_TOKEN;
  const profile = readFlag('--profile') ?? 'default';
  if (!url || !token) {
    throw new Error('Pass --url and --token, or set KIZUNA_URL and KIZUNA_TOKEN.');
  }

  const existing = (await readConfig()) ?? { url, tokenName: profile, tokens: {} };
  await writeConfig({
    url,
    tokenName: profile,
    tokens: {
      ...existing.tokens,
      [profile]: { value: token, scope: token.split('_')[1] ?? 'read', expiresAt: null },
    },
  });
  console.info('Logged in.');
}

function readFlag(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function printHelp(): void {
  console.info(`kizuna <command> [--format json|md]

Commands:
  login --url <url> --token <kzn_...>
  logout
  me
  me itinerary --format md
  attendees --hobby snowboarding`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
