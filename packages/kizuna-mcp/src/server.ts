// Kizuna MCP server. Reflects every command in the shared registry as
// an MCP tool with its zod input schema. Agents (Claude Desktop,
// Cursor, Claude Code) can therefore call commands with structured
// arguments rather than raw CLI strings, and discover the surface via
// the kizuna://schema resource.
//
// The HTTP boundary is the existing /functions/v1/cli edge function;
// this package never touches the database or RLS directly. PAT lives
// in KIZUNA_TOKEN.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, type ZodObject, type ZodRawShape, type ZodType } from 'zod';

import {
  allCommands,
  commandKey,
  serializeCommand,
  type Command,
} from '../../../src/lib/cli/index';
import { runRemoteCommand } from './httpClient';

const SERVER_NAME = 'kizuna';
const SERVER_VERSION = '0.1.0';

export async function startServer(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerSchemaResource(server);
  registerTools(server);
  await server.connect(new StdioServerTransport());
}

function registerSchemaResource(server: McpServer): void {
  server.registerResource(
    'kizuna_schema',
    'kizuna://schema',
    {
      title: 'Kizuna command schema',
      description:
        'Every command exposed by this Kizuna instance, with scope, mutation flag, and example invocations.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(buildSchemaPayload(), null, 2),
        },
      ],
    }),
  );
}

interface SchemaToolEntry {
  name: string;
  command: string;
  description: string;
  scope: Command<object, unknown>['scope'];
  mutation: boolean;
  examples: ReadonlyArray<string>;
}

function buildSchemaPayload(): { server: typeof SERVER_NAME; tools: SchemaToolEntry[] } {
  return {
    server: SERVER_NAME,
    tools: allCommands().map((command) => ({
      name: toolNameFor(command),
      command: commandKey(command.path),
      description: command.descriptionKey,
      scope: command.scope,
      mutation: command.mutation ?? false,
      examples: command.examples,
    })),
  };
}

function registerTools(server: McpServer): void {
  for (const command of allCommands()) {
    const shape = inputShape(command);
    if (!shape) {
      console.warn(
        `Command ${commandKey(command.path)} has a non-object input schema; skipping MCP registration.`,
      );
      continue;
    }
    const formattedInputs = removeKey(shape, 'args');
    server.registerTool(
      toolNameFor(command),
      {
        title: commandKey(command.path),
        description: command.descriptionKey,
        inputSchema: formattedInputs,
      },
      async (args: Record<string, unknown>) => {
        const cliString = serializeCommand({
          path: command.path,
          input: args ?? {},
        });
        const transportFormat: 'json' | 'md' = args.format === 'md' ? 'md' : 'json';
        const payload = await runRemoteCommand(cliString, transportFormat);
        return {
          content: [
            {
              type: 'text' as const,
              text: renderPayload(payload, transportFormat),
            },
          ],
          structuredContent: payload as unknown as Record<string, unknown>,
          isError: payload.ok === false,
        };
      },
    );
  }
}

function toolNameFor(command: Command<object, unknown>): string {
  return `kizuna_${command.path.join('_').replace(/-/g, '_')}`;
}

function inputShape(command: Command<object, unknown>): ZodRawShape | null {
  const candidate = command.input as ZodType<object> | ZodObject<ZodRawShape>;
  if (candidate instanceof z.ZodObject) {
    return candidate.shape;
  }
  return null;
}

function removeKey(shape: ZodRawShape, key: string): ZodRawShape {
  const entries = Object.entries(shape).filter(([name]) => name !== key);
  return Object.fromEntries(entries);
}

interface RemotePayload {
  ok: boolean;
  data?: unknown;
  markdown?: string;
  error?: { code: string; message: string };
  request_id?: string;
}

function renderPayload(payload: RemotePayload, format: 'json' | 'md'): string {
  if (format === 'md' && typeof payload.markdown === 'string') return payload.markdown;
  return JSON.stringify(payload.data ?? payload, null, 2);
}
