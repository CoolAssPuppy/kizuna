# Kizuna MCP

Stdio MCP server for exposing Kizuna commands to local agents.

```json
{
  "mcpServers": {
    "kizuna": {
      "command": "npx",
      "args": ["@kizuna/mcp"],
      "env": {
        "KIZUNA_URL": "https://your-kizuna-host",
        "KIZUNA_TOKEN": "kzn_read_xxx"
      }
    }
  }
}
```
