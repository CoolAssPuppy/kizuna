import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { runKizunaCommand } from './httpClient';
import { buildCommand, KIZUNA_TOOLS } from './toolFromCommand';

const ToolInput = {
  args: z.string().optional().describe('Additional CLI args, such as --day 2 or --format md.'),
  format: z.enum(['json', 'md']).optional().describe('Output format. Defaults to json.'),
};

export async function startServer(): Promise<void> {
  const server = new McpServer({ name: 'kizuna', version: '0.1.0' });

  server.registerResource(
    'kizuna_schema',
    'kizuna://schema',
    {
      title: 'Kizuna command schema',
      description: 'The command surface exposed by the Kizuna MCP server.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(KIZUNA_TOOLS, null, 2),
        },
      ],
    }),
  );

  for (const tool of KIZUNA_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: ToolInput,
      },
      async ({ args, format }) => {
        const payload = await runKizunaCommand(buildCommand(tool.command, args), format ?? 'json');
        return {
          content: [
            {
              type: 'text',
              text: renderPayload(payload, format ?? 'json'),
            },
          ],
        };
      },
    );
  }

  await server.connect(new StdioServerTransport());
}

function renderPayload(payload: unknown, format: 'json' | 'md'): string {
  if (format === 'md' && hasMarkdown(payload)) return payload.markdown;
  return JSON.stringify(payload, null, 2);
}

function hasMarkdown(payload: unknown): payload is { markdown: string } {
  return typeof payload === 'object' && payload !== null && 'markdown' in payload;
}
