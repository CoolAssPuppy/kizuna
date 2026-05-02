// Thin HTTP client that forwards an already-serialized CLI command
// string to the Kizuna edge function. Configuration lives in env so
// the same npm bin works against staging, prd, or a local supabase
// functions serve session.

interface CliResponse {
  ok: boolean;
  data?: unknown;
  markdown?: string;
  format?: 'json' | 'md';
  error?: { code: string; message: string; details?: unknown };
  request_id?: string;
}

export async function runRemoteCommand(
  command: string,
  format: 'json' | 'md',
): Promise<CliResponse> {
  const url = process.env.KIZUNA_URL;
  const token = process.env.KIZUNA_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Set KIZUNA_URL and KIZUNA_TOKEN before starting @kizuna/mcp. ' +
        'Run `npx kizuna login` to issue a PAT.',
    );
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/cli`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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

  // Surface upstream errors as MCP tool errors rather than raising —
  // the agent then sees a structured error in the tool result instead
  // of a transport failure.
  return payload;
}
