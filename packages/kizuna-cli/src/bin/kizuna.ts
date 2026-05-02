#!/usr/bin/env node
// Kizuna CLI entry point. Two modes:
//   kizuna login [--url <url>] [--scope read|write|admin] [--profile name]
//     Bootstraps a PAT via the OAuth code flow against /cli/oauth-authorize.
//     Persists the PAT to ~/.kizuna/config.json (chmod 0600).
//
//   kizuna <verb> <noun?> [flags]
//     POSTs the rest of argv as a CLI string to /functions/v1/cli using
//     the active profile's PAT. JSON to stdout by default; --format md
//     for Markdown.
//
// All HTTP work funnels through src/httpClient.ts. The OAuth dance
// lives in src/oauth.ts. This file is just the dispatch table.

import {
  activeToken,
  clearConfig,
  CONFIG_FILE,
  readConfig,
  writeConfig,
  type ApiKeyScope,
  type KizunaConfig,
} from '../config';
import { formatOutput } from '../formatOutput';
import { runRemoteCommand } from '../httpClient';
import { bootstrapOAuth, exchangeManualCode } from '../oauth';

const argv = process.argv.slice(2);

async function main(): Promise<void> {
  const verb = argv[0];
  if (!verb || verb === '--help' || verb === '-h') {
    printHelp();
    return;
  }

  if (verb === 'login') {
    await loginCommand();
    return;
  }

  if (verb === 'logout') {
    await clearConfig();
    console.info('Logged out. Tokens removed from', CONFIG_FILE);
    return;
  }

  if (verb === 'whoami') {
    await whoamiCommand();
    return;
  }

  await runCommand();
}

async function loginCommand(): Promise<void> {
  const url = readFlag('--url') ?? process.env.KIZUNA_URL;
  if (!url) {
    throw new Error('Pass --url <kizuna-host> or set KIZUNA_URL.');
  }
  const profileName = readFlag('--profile') ?? 'default';
  const scope = (readFlag('--scope') as ApiKeyScope | undefined) ?? 'read';
  if (!['read', 'write', 'admin'].includes(scope)) {
    throw new Error('--scope must be one of: read, write, admin.');
  }

  const pasted = readFlag('--paste');
  const state = readFlag('--state');
  let result;
  if (pasted) {
    if (!state) {
      throw new Error('--paste requires --state (shown alongside the code on the callback page).');
    }
    result = await exchangeManualCode(url, pasted, state);
  } else {
    console.info('Starting OAuth bootstrap. A browser tab will open.');
    result = await bootstrapOAuth({ url, scope, clientName: 'Kizuna CLI' });
  }

  const existing = (await readConfig()) ?? emptyConfig();
  await writeConfig({
    url,
    tokenName: profileName,
    tokens: {
      ...existing.tokens,
      [profileName]: {
        value: result.token,
        scope: result.scope,
        expiresAt: null,
      },
    },
  });
  console.info(
    `Logged in as profile "${profileName}" (scope: ${result.scope}). Token saved to ${CONFIG_FILE}.`,
  );
}

async function whoamiCommand(): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.info('Not logged in. Run `kizuna login --url <kizuna-host>`.');
    return;
  }
  const token = activeToken(config);
  if (!token) {
    console.info('No active profile. Run `kizuna login` to bootstrap one.');
    return;
  }
  console.info(`url: ${config.url}`);
  console.info(`profile: ${config.tokenName}`);
  console.info(`scope: ${token.scope}`);
}

async function runCommand(): Promise<void> {
  const profileName = readFlag('--profile');
  const format = readFlag('--format') === 'md' ? 'md' : 'json';
  const config = await readConfig();
  if (!config) {
    throw new Error('Run `kizuna login --url <kizuna-host>` first.');
  }
  const effective = profileName ? { ...config, tokenName: profileName } : config;
  const token = activeToken(effective);
  if (!token) {
    throw new Error(
      `Profile "${effective.tokenName}" has no token. Run \`kizuna login --profile ${effective.tokenName}\`.`,
    );
  }

  const filtered = stripFlagsWithValues(argv, ['--profile', '--format']);
  const cliString = filtered.join(' ');
  const payload = await runRemoteCommand(effective, cliString, format);
  console.info(formatOutput(payload, format));
}

function emptyConfig(): KizunaConfig {
  return { url: '', tokenName: 'default', tokens: {} };
}

function readFlag(name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

/**
 * Returns argv with `flag value` pairs removed. Preserves boolean
 * flags so e.g. `me notifications --unread --format md` keeps
 * `--unread` while dropping `--format md`.
 */
function stripFlagsWithValues(args: string[], flags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg !== undefined && flags.includes(arg)) {
      i += 1; // skip the next token (value)
      continue;
    }
    if (arg !== undefined) out.push(arg);
  }
  return out;
}

function printHelp(): void {
  console.info(`kizuna <command> [options]

Authentication:
  kizuna login [--url <url>] [--scope read|write|admin] [--profile name]
  kizuna login --url <url> --paste <code> --state <state>
  kizuna logout
  kizuna whoami

Reading data (any command from \`kizuna schema\`):
  kizuna me
  kizuna me itinerary --day 2 --format md
  kizuna attendees --hobby snowboarding
  kizuna sessions --mandatory

Options:
  --format json|md     Output format. Default: json.
  --profile <name>     Use a named profile from ~/.kizuna/config.json.

Configuration is stored at ~/.kizuna/config.json with 0600 permissions.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
