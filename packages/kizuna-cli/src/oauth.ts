// OAuth bootstrap for the local CLI. Binds an ephemeral loopback
// server, opens the user's browser to /cli/oauth-authorize on the
// configured Kizuna host, waits for the callback page to POST the
// authorization code back, and exchanges the code for a PAT.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import type { ApiKeyScope } from './config';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — agents idle.

export interface BootstrapInput {
  url: string;
  scope: ApiKeyScope;
  clientName?: string;
}

export interface BootstrapResult {
  id: string;
  token: string;
  scope: ApiKeyScope;
}

export async function bootstrapOAuth(input: BootstrapInput): Promise<BootstrapResult> {
  const state = randomBytes(16).toString('hex');
  const { server, port, awaitCode } = await listenForCode(state);
  const redirect = `http://127.0.0.1:${port}/callback`;
  const authorizeUrl = buildAuthorizeUrl(input, state, redirect);

  console.info(`Opening browser to ${authorizeUrl}`);
  console.info('If the browser does not open, paste that URL into a browser yourself.');
  openBrowser(authorizeUrl);

  let code: string;
  try {
    code = await awaitCode;
  } finally {
    server.close();
  }

  return exchangeCode(input.url, code, state);
}

interface PendingExchange {
  server: Server;
  port: number;
  awaitCode: Promise<string>;
}

function listenForCode(expectedState: string): Promise<PendingExchange> {
  return new Promise((resolveServer, rejectServer) => {
    const codeReady: { resolve: (code: string) => void; reject: (err: Error) => void } = {
      resolve: () => {
        /* assigned below */
      },
      reject: () => {
        /* assigned below */
      },
    };
    const awaitCode = new Promise<string>((res, rej) => {
      codeReady.resolve = res;
      codeReady.reject = rej;
      setTimeout(() => rej(new Error('Timed out waiting for authorization.')), DEFAULT_TIMEOUT_MS);
    });

    const server = createServer((req, res) => {
      handleRequest(req, res, expectedState, codeReady);
    });

    server.once('error', (err) => {
      rejectServer(err);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address && 'port' in address) {
        resolveServer({ server, port: address.port, awaitCode });
      } else {
        rejectServer(new Error('Failed to bind localhost port.'));
      }
    });
  });
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  expectedState: string,
  ready: { resolve: (code: string) => void; reject: (err: Error) => void },
): void {
  // Allow CORS preflight from the Kizuna callback page.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    });
    res.end();
    return;
  }

  if (req.url !== '/callback' || req.method !== 'POST') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let raw = '';
  req.on('data', (chunk: Buffer) => {
    raw += chunk.toString('utf8');
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(raw) as { code?: string; state?: string };
      if (!parsed.code || !parsed.state) {
        res.writeHead(400, corsHeaders());
        res.end();
        ready.reject(new Error('Callback payload missing code or state.'));
        return;
      }
      if (parsed.state !== expectedState) {
        res.writeHead(400, corsHeaders());
        res.end();
        ready.reject(new Error('OAuth state mismatch (possible replay).'));
        return;
      }
      res.writeHead(204, corsHeaders());
      res.end();
      ready.resolve(parsed.code);
    } catch (err) {
      res.writeHead(400, corsHeaders());
      res.end();
      ready.reject(err instanceof Error ? err : new Error('Invalid callback payload.'));
    }
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
}

function buildAuthorizeUrl(input: BootstrapInput, state: string, redirect: string): string {
  const params = new URLSearchParams({
    scope: input.scope,
    state,
    redirect,
    client: input.clientName ?? 'Kizuna CLI',
  });
  return `${trimSlash(input.url)}/cli/oauth-authorize?${params.toString()}`;
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd.exe' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Headless box — caller already printed the URL.
  }
}

interface ExchangeResponse {
  ok: boolean;
  id?: string;
  token?: string;
  scope?: ApiKeyScope;
  error?: { code: string; message: string };
}

async function exchangeCode(url: string, code: string, state: string): Promise<BootstrapResult> {
  const response = await fetch(`${trimSlash(url)}/functions/v1/cli-oauth-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  const payload = (await response.json()) as ExchangeResponse;
  if (!response.ok || !payload.ok || !payload.id || !payload.token || !payload.scope) {
    const message = payload.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Token exchange failed: ${message}`);
  }
  return { id: payload.id, token: payload.token, scope: payload.scope };
}

/**
 * Manual paste path. Used when the loopback server failed to receive
 * the code (firewall, container, different machine). The user copies
 * the code from the callback page and pastes it into the terminal.
 */
export async function exchangeManualCode(
  url: string,
  code: string,
  state: string,
): Promise<BootstrapResult> {
  return exchangeCode(url, code, state);
}
