# CLAUDE.md

## Project Overview

MCP server for Eclipse Che — exposes DevWorkspace operations and tmux-based coding agent session control as MCP tools. Stateless bridge between MCP clients and the Kubernetes API.

## Tech Stack

- TypeScript (ES2022, Node16 modules, strict mode)
- `@modelcontextprotocol/sdk` for MCP server
- `@kubernetes/client-node` for Kubernetes API
- Vitest for testing

## Commands

- `npm run build` — compile TypeScript (`tsc`)
- `npm test` — run all tests (`vitest run`)
- `npm run test:watch` — run tests in watch mode
- `npm start` — run the compiled server

## Project Structure

```
src/
  index.ts          — MCP server setup, tool registration
  types.ts          — shared types and constants
  kube/
    client.ts       — Kubernetes client initialization
    exec.ts         — pod exec helper
  tools/
    list-workspaces.ts
    start-agent-session.ts
    read-agent-output.ts
    send-agent-input.ts
    get-agent-state.ts
    stop-agent-session.ts
tests/              — mirrors src/ structure, *.test.ts files
```

## Conventions

- ESM (`"type": "module"`) — all imports use `.js` extensions
- Tool implementations are one-per-file under `src/tools/`
- Tests mirror source structure under `tests/`
- Constants and shared types live in `src/types.ts`
- Kebab-case filenames, snake_case for MCP tool names
