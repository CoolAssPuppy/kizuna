# Kizuna MCP

Stdio MCP server for exposing Kizuna commands to local agents.

```json
{
  "mcpServers": {
    "kizuna": {
      "command": "npx",
      "args": ["-p", "@strategicnerds/kizuna-mcp", "kizuna-mcp"],
      "env": {
        "KIZUNA_URL": "https://your-kizuna-host",
        "KIZUNA_TOKEN": "kzn_read_xxx"
      }
    }
  }
}
```
