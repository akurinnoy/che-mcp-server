# che-mcp-server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that exposes Eclipse Che workspace listing and interactive coding agent session control (via tmux) as tools.

**Architecture:** Stateless stdio MCP server → Kubernetes API (list DevWorkspaces) + pod exec (tmux operations). User's OAuth token from kubeconfig for auth. Each tool call is a one-shot K8s operation.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@kubernetes/client-node`, `vitest` for tests. Versions are not pinned — `npm install` fetches the latest compatible versions.

**Spec:** `docs/2026-03-19-che-mcp-server-design.md`
**DoD:** `docs/2026-03-19-definition-of-done.md`

---

## File Structure

```
che-mcp-server/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio transport)
│   ├── types.ts                    # Shared types (WorkspaceInfo, AgentState, etc.)
│   ├── kube/
│   │   ├── client.ts               # KubeConfig loading, namespace resolution, API clients
│   │   └── exec.ts                 # One-shot pod exec via WebSocket (runs command, returns stdout)
│   └── tools/
│       ├── list-workspaces.ts      # list_workspaces tool
│       ├── start-agent-session.ts  # start_agent_session tool
│       ├── read-agent-output.ts    # read_agent_output tool
│       ├── send-agent-input.ts     # send_agent_input tool
│       ├── get-agent-state.ts      # get_agent_state tool
│       └── stop-agent-session.ts   # stop_agent_session tool
├── tests/
│   ├── kube/
│   │   ├── client.test.ts          # Namespace resolution, error handling
│   │   └── exec.test.ts            # Pod exec wrapper
│   └── tools/
│       ├── list-workspaces.test.ts
│       ├── start-agent-session.test.ts
│       ├── read-agent-output.test.ts
│       ├── send-agent-input.test.ts
│       ├── get-agent-state.test.ts
│       └── stop-agent-session.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `.gitignore`

**DoD gates:** G1 (project builds, MCP server starts, bin entry)

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/okurinny/Workspace/akurinnoy/che-mcp-server
npm init -y
```

Edit `package.json` to:
```json
{
  "name": "che-mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Eclipse Che workspace management and coding agent orchestration",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "che-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "license": "Apache-2.0"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk @kubernetes/client-node
npm install -D typescript vitest @types/node
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 5: Create minimal MCP server entry point**

Create `src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'che-mcp-server',
  version: '0.1.0',
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start che-mcp-server:', error);
  process.exit(1);
});
```

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Expected: zero errors, `dist/index.js` created.

- [ ] **Step 7: Verify MCP server responds to initialize**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js 2>/dev/null | head -1
```

Expected: JSON response with server info.

- [ ] **Step 8: Commit**

```bash
git init
printf 'node_modules/\ndist/\n' > .gitignore
git add -A
git commit -s -m "feat: project scaffolding with MCP server shell"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types**

Create `src/types.ts`:
```typescript
export interface WorkspaceInfo {
  name: string;
  phase: string;
  url: string;
  annotations: Record<string, string>;
}

export interface AgentState {
  session_alive: boolean;
  process_running: boolean;
  exit_code: number | null;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const AGENT_ANNOTATION_PREFIX = 'che.eclipse.org/agent-';

export const CHE_GATEWAY_CONTAINER = 'che-gateway';

export const DEFAULT_SESSION_NAME = 'agent';

export const DEFAULT_LINES = 50;

export const EXEC_TIMEOUT_MS = 10_000;

export const TMUX_HISTORY_LIMIT = 5000;
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -s -m "feat: add shared types and constants"
```

---

## Task 3: Kubernetes Client Setup

**Files:**
- Create: `src/kube/client.ts`
- Create: `tests/kube/client.test.ts`

**DoD gates:** G2 (kubeconfig loading, namespace resolution, error handling)

- [ ] **Step 1: Write failing tests**

Create `tests/kube/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@kubernetes/client-node');

describe('KubeClient', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CHE_MCP_NAMESPACE;
  });

  it('resolves namespace from kubeconfig context', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({ namespace: 'user-namespace' }),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(() => mockKc as any);

    const { getNamespace, initKubeClient } = await import('../../src/kube/client.js');
    initKubeClient();
    expect(getNamespace()).toBe('user-namespace');
  });

  it('falls back to CHE_MCP_NAMESPACE env var', async () => {
    process.env.CHE_MCP_NAMESPACE = 'env-namespace';
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({}),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(() => mockKc as any);

    const { getNamespace, initKubeClient } = await import('../../src/kube/client.js');
    initKubeClient();
    expect(getNamespace()).toBe('env-namespace');
  });

  it('throws when no namespace is available', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn(),
      getCurrentContext: vi.fn().mockReturnValue('test-context'),
      getContextObject: vi.fn().mockReturnValue({}),
      makeApiClient: vi.fn().mockReturnValue({}),
    };
    vi.mocked(KubeConfig).mockImplementation(() => mockKc as any);

    const { initKubeClient } = await import('../../src/kube/client.js');
    expect(() => initKubeClient()).toThrow('namespace');
  });

  it('throws when kubeconfig cannot be loaded', async () => {
    const { KubeConfig } = await import('@kubernetes/client-node');
    const mockKc = {
      loadFromDefault: vi.fn().mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      }),
    };
    vi.mocked(KubeConfig).mockImplementation(() => mockKc as any);

    const { initKubeClient } = await import('../../src/kube/client.js');
    expect(() => initKubeClient()).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/kube/client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement kube client**

Create `src/kube/client.ts`:
```typescript
import * as k8s from '@kubernetes/client-node';

let kubeConfig: k8s.KubeConfig;
let namespace: string;
let customObjectsApi: k8s.CustomObjectsApi;
let coreV1Api: k8s.CoreV1Api;

export function initKubeClient(): void {
  kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromDefault();

  const context = kubeConfig.getContextObject(kubeConfig.getCurrentContext());
  namespace = context?.namespace
    || process.env.CHE_MCP_NAMESPACE
    || '';

  if (!namespace) {
    throw new Error(
      'Cannot determine namespace. Set namespace in kubeconfig context or CHE_MCP_NAMESPACE env var.'
    );
  }

  customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
  coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
}

export function getNamespace(): string {
  return namespace;
}

export function getCustomObjectsApi(): k8s.CustomObjectsApi {
  return customObjectsApi;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  return coreV1Api;
}

export function getKubeConfig(): k8s.KubeConfig {
  return kubeConfig;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/kube/client.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/kube/client.ts tests/kube/client.test.ts
git commit -s -m "feat: kubernetes client setup with namespace resolution"
```

---

## Task 4: Pod Exec Wrapper

**Files:**
- Create: `src/kube/exec.ts`
- Create: `tests/kube/exec.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/kube/exec.test.ts` with tests for:
- `findPodForWorkspace` — queries with correct label selector
- `selectContainer` — picks first non-`che-gateway` container
- `selectContainer` — uses explicit container when provided
- `selectContainer` — throws when explicit container not found
- `findPodForWorkspace` — throws when no running pod found
- `execInPod` — times out after `EXEC_TIMEOUT_MS` and returns error
- `execInPod` — parses WebSocket status channel (stream 3) for exec-level errors

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/kube/exec.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement exec wrapper**

Create `src/kube/exec.ts` with:
- `findPodForWorkspace(workspaceName)` — list pods by label `controller.devfile.io/devworkspace_name`, filter Running, return pod name + container names. This implicitly validates that the workspace is Running — if no Running pods exist, the error "No running pod found for workspace X" covers both "workspace not Running" and "workspace doesn't exist" cases
- `selectContainer(containers, explicit?)` — pick first non-`che-gateway` or use explicit
- `execInPod(podName, containerName, command[])` — one-shot exec via `k8s.Exec`, captures stdout/stderr via WebSocket channels, returns `ExecResult`. 10-second timeout.

Note: The `@kubernetes/client-node` Exec API uses WebSocket streams. Each message has a channel byte prefix: 1=stdout, 2=stderr, 3=status. The implementer should verify the exact API against the installed SDK version. All commands are passed as string arrays to the exec API — never interpolated into shell strings.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/kube/exec.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/kube/exec.ts tests/kube/exec.test.ts
git commit -s -m "feat: pod exec wrapper with container auto-detection"
```

---

## Task 5: `list_workspaces` Tool

**Files:**
- Create: `src/tools/list-workspaces.ts`
- Create: `tests/tools/list-workspaces.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G3

- [ ] **Step 1: Write failing tests**

Tests for:
- Returns workspace name, phase, url, and filtered annotations (only `che.eclipse.org/agent-*` keys)
- Returns empty `url` when workspace is not Running (no `mainUrl`)
- Returns empty array when no workspaces exist
- Populates `url` from `status.mainUrl`

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement list-workspaces tool**

Create `src/tools/list-workspaces.ts`: query `CustomObjectsApi.listNamespacedCustomObject`, map results to `WorkspaceInfo[]`, filter annotations by `AGENT_ANNOTATION_PREFIX`.

- [ ] **Step 4: Register tool in MCP server**

Update `src/index.ts` — add `server.tool('list_workspaces', ...)` with the tool handler calling `listWorkspaces()`. Initialize kube client in `main()` before connecting transport.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Build and verify tool appears**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/tools/list-workspaces.ts tests/tools/list-workspaces.test.ts src/index.ts
git commit -s -m "feat: add list_workspaces tool"
```

---

## Task 6: `start_agent_session` Tool

**Files:**
- Create: `src/tools/start-agent-session.ts`
- Create: `tests/tools/start-agent-session.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G4

- [ ] **Step 1: Write failing tests**

Tests for:
- Creates tmux session with correct arguments (`new-session -d -s {name} -x 200 -y 50`)
- Sets `remain-on-exit on` and `history-limit 5000` via follow-up exec calls
- Uses default session name `"agent"` when not specified
- Returns error when workspace is not Running
- Returns error when session already exists (tmux reports "duplicate session")
- Returns error when tmux is not installed (exec returns "command not found" or similar)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement start-agent-session**

Resolve workspace → pod, select container, exec `tmux new-session`, then `tmux set-option` x2. Detect "duplicate session" in stderr for clear error message. Detect tmux not found by checking for "not found" or "No such file" in stderr.

- [ ] **Step 4: Register tool in MCP server**

Input schema: `workspace` (required), `command` (required), `session_name` (optional), `container` (optional).

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add src/tools/start-agent-session.ts tests/tools/start-agent-session.test.ts src/index.ts
git commit -s -m "feat: add start_agent_session tool"
```

---

## Task 7: `read_agent_output` Tool

**Files:**
- Create: `src/tools/read-agent-output.ts`
- Create: `tests/tools/read-agent-output.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G5

- [ ] **Step 1: Write failing tests**

Tests for:
- Returns captured pane output as plain text
- `lines_returned` reflects actual line count
- Uses default 50 lines when not specified
- Works on dead session (returns last output due to `remain-on-exit`)
- Returns error when session does not exist

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement read-agent-output**

Exec `tmux capture-pane -t {name} -p -S -{lines}`. Count newlines in output for `lines_returned`.

- [ ] **Step 4: Register tool in MCP server**

Input schema: `workspace` (required), `session_name` (optional), `lines` (optional), `container` (optional).

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add src/tools/read-agent-output.ts tests/tools/read-agent-output.test.ts src/index.ts
git commit -s -m "feat: add read_agent_output tool"
```

---

## Task 8: `send_agent_input` Tool

**Files:**
- Create: `src/tools/send-agent-input.ts`
- Create: `tests/tools/send-agent-input.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G6

- [ ] **Step 1: Write failing tests**

Tests for:
- Sends text with literal flag (`-l`) — verify exec args include `-l`
- Sends Enter when `enter: true` (second exec call with `Enter`)
- Does not send Enter when `enter: false`
- Text with quotes, `$vars`, and backticks is passed verbatim (no shell interpretation)
- Returns error when session does not exist

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement send-agent-input**

Two exec calls: `['tmux', 'send-keys', '-t', name, '-l', text]` then optionally `['tmux', 'send-keys', '-t', name, 'Enter']`. Text is passed as a command array element, never shell-interpolated.

- [ ] **Step 4: Register tool in MCP server**

Input schema: `workspace` (required), `text` (required), `session_name` (optional), `enter` (optional, default true), `container` (optional).

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add src/tools/send-agent-input.ts tests/tools/send-agent-input.test.ts src/index.ts
git commit -s -m "feat: add send_agent_input tool"
```

---

## Task 9: `get_agent_state` Tool

**Files:**
- Create: `src/tools/get-agent-state.ts`
- Create: `tests/tools/get-agent-state.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G7

- [ ] **Step 1: Write failing tests**

Tests for:
- Returns `{ session_alive: true, process_running: true, exit_code: null }` for running session (tmux output: `"12345 0 "`)
- Returns `{ session_alive: true, process_running: false, exit_code: 0 }` for exited process (tmux output: `"12345 1 0"`)
- Returns non-zero `exit_code` (tmux output: `"12345 1 1"`)
- Returns `{ session_alive: false, process_running: false, exit_code: null }` when tmux session doesn't exist (exec returns error)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement get-agent-state**

Exec `tmux list-panes -t {name} -F '#{pane_pid} #{pane_dead} #{pane_dead_status}'`. Parse the three fields. If exec fails (session gone), return `session_alive: false`.

- [ ] **Step 4: Register tool in MCP server**

Input schema: `workspace` (required), `session_name` (optional), `container` (optional).

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add src/tools/get-agent-state.ts tests/tools/get-agent-state.test.ts src/index.ts
git commit -s -m "feat: add get_agent_state tool"
```

---

## Task 10: `stop_agent_session` Tool

**Files:**
- Create: `src/tools/stop-agent-session.ts`
- Create: `tests/tools/stop-agent-session.test.ts`
- Modify: `src/index.ts`

**DoD gates:** G8

- [ ] **Step 1: Write failing tests**

Tests for:
- Kills the tmux session (verify exec args: `['tmux', 'kill-session', '-t', name]`)
- Returns success when session is already dead — idempotent (exec returns error, tool returns success)
- Returns error when workspace is not Running

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement stop-agent-session**

Exec `tmux kill-session -t {name}`. Catch exec failure (session not found) and return success anyway.

- [ ] **Step 4: Register tool in MCP server**

Input schema: `workspace` (required), `session_name` (optional), `container` (optional).

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add src/tools/stop-agent-session.ts tests/tools/stop-agent-session.test.ts src/index.ts
git commit -s -m "feat: add stop_agent_session tool"
```

---

## Task 11: README

**Files:**
- Create: `README.md`

**DoD gates:** G10

- [ ] **Step 1: Write README**

Cover:
- What the server does (one paragraph)
- Prerequisites (tmux 3.1+, kubeconfig, Node.js 18+)
- Installation (`npm install -g che-mcp-server` or `npx`)
- Configuration (kubeconfig, `CHE_MCP_NAMESPACE` env var)
- Tool reference table with input/output schemas for all 6 tools
- Usage example: configuring as MCP server in Claude Code (`claude mcp add`)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -s -m "docs: add README with tool reference and usage examples"
```

---

## Task 12: Integration Verification

**DoD gates:** G9 (end-to-end scenario)

Manual verification against a real Eclipse Che cluster with a running DevWorkspace that has tmux installed.

- [ ] **Step 1: Build and install globally**

```bash
npm run build
npm link
```

- [ ] **Step 2: Configure as MCP server in Claude Code**

```bash
claude mcp add che-mcp-server che-mcp-server
```

- [ ] **Step 3: Run the end-to-end sequence**

From an MCP client, execute in order:
1. `list_workspaces` — verify at least one Running workspace appears
2. `start_agent_session` with `command: "bash"` — verify session created
3. `read_agent_output` — verify prompt appears
4. `send_agent_input` with `text: "echo hello"` — send command
5. `read_agent_output` — verify "hello" in output
6. `get_agent_state` — verify `session_alive: true, process_running: true`
7. `stop_agent_session` — terminate the session
8. `get_agent_state` — verify `session_alive: false`

- [ ] **Step 4: Record results and fix any issues**
