---
name: mcp-cli
description: Interface for MCP (Model Context Protocol) servers via CLI. Use when you need to interact with external tools, APIs, or data sources through MCP servers.
---

# MCP-CLI

Access MCP servers through the command line. MCP enables interaction with external systems like GitHub, filesystems, databases, and APIs.

## Configuration

**Claude Code projects use `.mcp.json`** (not `mcp_servers.json`). Always use `-c .mcp.json`:

```bash
mcp-cli -c .mcp.json              # List servers
mcp-cli -c .mcp.json info server  # Server info
mcp-cli -c .mcp.json call server tool '{"arg": "value"}'
```

## Commands

| Command | Output |
|---------|--------|
| `mcp-cli -c .mcp.json` | List all servers and tools |
| `mcp-cli -c .mcp.json info <server>` | Show server tools and parameters |
| `mcp-cli -c .mcp.json info <server> <tool>` | Get tool JSON schema |
| `mcp-cli -c .mcp.json grep "<pattern>"` | Search tools by name |
| `mcp-cli -c .mcp.json call <server> <tool>` | Call tool (reads JSON from stdin if no args) |
| `mcp-cli -c .mcp.json call <server> <tool> '<json>'` | Call tool with arguments |

**Both formats work:** `<server> <tool>` or `<server>/<tool>`

## Workflow

1. **Discover**: `mcp-cli -c .mcp.json` → see available servers
2. **Explore**: `mcp-cli -c .mcp.json info <server>` → see tools with parameters
3. **Inspect**: `mcp-cli -c .mcp.json info <server> <tool>` → get full JSON schema
4. **Execute**: `mcp-cli -c .mcp.json call <server> <tool> '<json>'` → run with arguments

## Examples

```bash
# List all servers (Claude Code projects)
mcp-cli -c .mcp.json

# With descriptions  
mcp-cli -c .mcp.json -d

# See server tools
mcp-cli -c .mcp.json info filesystem

# Get tool schema (both formats work)
mcp-cli -c .mcp.json info filesystem read_file
mcp-cli -c .mcp.json info filesystem/read_file

# Call tool
mcp-cli -c .mcp.json call filesystem read_file '{"path": "./README.md"}'

# Pipe from stdin (no '-' needed!)
cat args.json | mcp-cli -c .mcp.json call filesystem read_file

# Search for tools
mcp-cli -c .mcp.json grep "*file*"

# Output is raw text (pipe-friendly)
mcp-cli -c .mcp.json call filesystem read_file '{"path": "./file"}' | head -10
```

## Advanced Chaining

```bash
# Chain: search files → read first match
mcp-cli -c .mcp.json call filesystem search_files '{"path": ".", "pattern": "*.md"}' \
  | head -1 \
  | xargs -I {} mcp-cli -c .mcp.json call filesystem read_file '{"path": "{}"}'

# Loop: process multiple files
mcp-cli -c .mcp.json call filesystem list_directory '{"path": "./src"}' \
  | while read f; do mcp-cli -c .mcp.json call filesystem read_file "{\"path\": \"$f\"}"; done

# Conditional: check before reading
mcp-cli -c .mcp.json call filesystem list_directory '{"path": "."}' \
  | grep -q "README" \
  && mcp-cli -c .mcp.json call filesystem read_file '{"path": "./README.md"}'

# Multi-server aggregation
{
  mcp-cli -c .mcp.json call github search_repositories '{"query": "mcp", "per_page": 3}'
  mcp-cli -c .mcp.json call filesystem list_directory '{"path": "."}'
}

# Save to file
mcp-cli -c .mcp.json call github get_file_contents '{"owner": "x", "repo": "y", "path": "z"}' > output.txt
```

**Note:** `call` outputs raw text content directly (no jq needed for text extraction)

## Options

| Flag | Purpose |
|------|---------|
| `-d` | Include descriptions |
| `-c <path>` | Specify config file (**required for Claude Code: `-c .mcp.json`**) |

## Common Errors

| Wrong Command | Error | Fix |
|---------------|-------|-----|
| `mcp-cli` (no config flag) | CONFIG_NOT_FOUND | Use `-c .mcp.json` for Claude Code projects |
| `mcp-cli server tool` | AMBIGUOUS_COMMAND | Use `call server tool` or `info server tool` |
| `mcp-cli run server tool` | UNKNOWN_SUBCOMMAND | Use `call` instead of `run` |
| `mcp-cli list` | UNKNOWN_SUBCOMMAND | Use `info` instead of `list` |
| `mcp-cli call server` | MISSING_ARGUMENT | Add tool name |
| `mcp-cli call server tool {bad}` | INVALID_JSON | Use valid JSON with quotes |

## Exit Codes

- `0`: Success
- `1`: Client error (bad args, missing config)
- `2`: Server error (tool failed)
- `3`: Network error
