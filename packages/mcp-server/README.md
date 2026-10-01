# @totemsdk/mcp-server

Model Context Protocol server exposing the full Totem SDK package set — packages, exports, cross-package dependency graphs, and scaffolding tools.

## Usage

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "totemsdk": {
      "command": "npx",
      "args": ["-y", "@totemsdk/mcp-server"]
    }
  }
}
```

### Any MCP client

```bash
npx -y @totemsdk/mcp-server
```

The server runs on stdio and communicates via JSON-RPC.

## Resources

| URI | Description |
|-----|-------------|
| `totemsdk://packages` | All packages with metadata |
| `totemsdk://packages/{name}` | Package metadata (deps, exports, domain) |
| `totemsdk://packages/{name}/exports` | Exported symbols |
| `totemsdk://packages/{name}/dependencies` | Dependency lists |
| `totemsdk://packages/by-domain/{layer}` | Packages in a domain |
| `totemsdk://conventions` | Coding conventions |
| `totemsdk://domain-map` | Packages grouped by domain |
| `totemsdk://symbol/{name}` | Symbol locations across packages |

## Tools

| Tool | Description |
|------|-------------|
| `search-symbol` | Find which packages export a symbol |
| `find-type` | Locate type definitions by name pattern |
| `dependency-graph` | Get outbound deps or inbound dependents |
| `validate-import` | Check if a cross-package import is valid |
| `scaffold-adapter` | Generate edge protocol adapter boilerplate |
| `scaffold-package` | Generate new package boilerplate |
| `package-stats` | Export counts, Rust/Go, tests, deps |
| `list-exports` | List exports filtered by kind and name |
| `suggest-template` | Suggest KISSVM templates matching a use case |
| `read-source` | Read a source file from a package's `src/` |
| `list-packages` | List packages filtered by domain or name |
| `search-packages` | Free-text package search |
| `refresh-index` | Rebuild the SDK index (development only) |

## Prompts

| Prompt | Description |
|--------|-------------|
| `analyze-cross-package` | Compare two packages' relationship |
| `new-edge-adapter` | Walk through creating a protocol adapter |

## How it works

At startup, the server builds an in-memory index of every `@totemsdk/*` package and its exports. When run inside the SDK monorepo it scans `packages/*` live; when installed from npm (e.g. via `npx`) it loads the prebuilt index shipped in `data/sdk-index.json`. No runtime dependency on any `@totemsdk/*` package.

If neither is available the server stays running but index-backed tools return an explicit **"SDK index unavailable"** error — never an empty result that looks like a real answer.

## License

MIT
