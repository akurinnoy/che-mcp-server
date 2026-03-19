# che-mcp-server — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Author:** akurinnoy + Claude Code

## Problem

Developers using Eclipse Che need a way for AI agents (ZeroClaw, Claude Code, Gemini CLI, etc.) to manage DevWorkspaces and orchestrate coding agents programmatically. Today this requires manual interaction with the Che Dashboard or kubectl — there's no standardized agent-friendly interface.

## Solution

A lightweight MCP (Model Context Protocol) server that exposes Eclipse Che workspace management and coding agent session control as tools. Any MCP-compatible AI agent can use it to list workspaces, launch coding agents inside them, monitor their output, and relay user input when the agent is blocked.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Agent Workspace (DevWorkspace)                 │
│                                                 │
│  ┌──────────┐    stdio    ┌──────────────────┐  │
│  │ AI Agent │◄───────────►│ che-mcp-server   │  │
│  │ (any MCP │             │                  │  │
│  │  client) │             │ - list_workspaces│  │
│  └──────────┘             │ - start_agent_*  │  │
│                           │ - read_agent_*   │  │
│                           │ - send_agent_*   │  │
│                           │ - get/stop_agent │  │
│                           └───────┬──────────┘  │
│                                   │              │
└───────────────────────────────────┼──────────────┘
                                    │ user's OAuth token
                                    ▼
┌───────────────────────────────────────────────────┐
│  Kubernetes API                                   │
│                                                   │
│  DevWorkspace CR ◄── list / read annotations      │
│                                                   │
│  Pod exec ◄── tmux new-session / capture-pane /   │
│               send-keys (into target workspaces)  │
└───────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │ Target    │  │ Target    │  │ Target    │
             │ Workspace │  │ Workspace │  │ Workspace │
             │ A         │  │ B         │  │ C         │
             │ tmux      │  │ tmux      │  │           │
             │ └ gemini  │  │ └ claude  │  │ (idle)    │
             └───────────┘  └───────────┘  └───────────┘
```

The MCP server is a thin stateless bridge — it translates MCP tool calls into Kubernetes API calls and pod exec commands. The user's OAuth token provides authentication and namespace scoping.

### Terminology

- **Agent workspace** — the DevWorkspace where the personal AI agent (ZeroClaw, etc.) and che-mcp-server run
- **Target workspace** — a DevWorkspace where a coding agent (Gemini CLI, Claude Code, etc.) is launched
- **Personal agent** — the AI agent that orchestrates everything, running in the agent workspace
- **Coding agent** — a CLI-based agent (Gemini, Claude Code, etc.) running inside a target workspace

### Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Language | TypeScript | Most mature MCP SDK, aligns with Che Dashboard codebase |
| Transport | stdio | Standard MCP pattern, no ports/networking, inherits env |
| Auth | User's OAuth token via Che-injected kubeconfig | Namespace-scoped, no privilege escalation |
| K8s access | `@kubernetes/client-node` | Native API, no kubectl binary dependency |
| Agent sessions | tmux via pod exec WebSocket | Simple, proven, all ops are one-shot exec calls |
| State | Stateless | All state in Kubernetes (DW CRs, tmux sessions) |
| Agent status reporting | DW annotations | Coding agents write status to annotations; personal agent reads via `list_workspaces` |

### Namespace Resolution

The namespace is read from the current kubeconfig context (`KubeConfig.loadFromDefault()` → `kc.getContextObject(kc.getCurrentContext()).namespace`). In Eclipse Che, the injected kubeconfig always has the user's namespace as the current context. Falls back to the `CHE_MCP_NAMESPACE` environment variable if the kubeconfig context has no namespace.

### Container Targeting

All exec operations target the **first container** in the pod's container list that is NOT named `che-gateway`. This is the primary dev container in Che workspaces. An optional `container` parameter on all agent session tools allows explicit override when needed.

### Why tmux?

The personal agent needs to monitor coding agents that may block waiting for user input. This requires a persistent interactive terminal session, not one-shot exec. tmux provides:

- **Start:** `tmux new-session -d -s agent 'gemini'`
- **Read output:** `tmux capture-pane -t agent -p`
- **Send input:** `tmux send-keys -t agent -l 'response'` + `tmux send-keys -t agent Enter`
- **Check state:** `tmux list-panes -t agent -F '#{pane_pid} #{pane_dead} #{pane_dead_status}'`
- **Stop:** `tmux kill-session -t agent`

All operations are one-shot exec calls through the Kubernetes WebSocket exec API — each tool call creates a new exec connection, runs a single tmux command, and closes. The tmux session persists inside the pod independently.

**Session configuration:** `start_agent_session` creates the tmux session with `remain-on-exit on` and scrollback set to 5000 lines. This ensures output is preserved after the coding agent exits, and sufficient history is available for `read_agent_output`.

**Minimum tmux version:** 3.1+ (required for `pane_dead_status` format). Most current workspace images (Ubuntu 22.04+, UBI 9+) include tmux 3.2+.

## v1 Tool Specifications

### `list_workspaces`

Lists all DevWorkspaces in the user's namespace.

**Input:** none (namespace from kubeconfig context)

**Output:** Array of objects:
```json
[
  {
    "name": "my-project",
    "phase": "Running",
    "url": "https://che-host/user/my-project/3100/",
    "annotations": {
      "agent-status": "PR #123 created"
    }
  }
]
```

- `url` is read from `.status.mainUrl`. Empty string if workspace is not Running.
- `annotations` are filtered to keys prefixed with `che.eclipse.org/agent-`. Coding agents report status by annotating their DevWorkspace CR with keys like `che.eclipse.org/agent-status`, `che.eclipse.org/agent-progress`.

**Implementation:** `@kubernetes/client-node` CustomObjectsApi: `listNamespacedCustomObject('workspace.devfile.io', 'v1alpha2', namespace, 'devworkspaces')`.

### `start_agent_session`

Starts a tmux session with a coding agent inside a running target workspace.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspace` | string | yes | — | Target DevWorkspace name |
| `command` | string | yes | — | Command to run (e.g., `gemini`, `claude -p "task"`) |
| `session_name` | string | no | `agent` | tmux session name |
| `container` | string | no | auto-detect | Container name for exec |

**Output:** `{ success: true, session_name: "agent" }` or error.

**Implementation:** Resolves workspace → pod via label selector `controller.devfile.io/devworkspace_name={workspace}`. Executes via pod exec API:
```bash
tmux new-session -d -s {session_name} \
  -x 200 -y 50 \
  "set -o pipefail; {command}; exec bash"
```
Followed by:
```bash
tmux set-option -t {session_name} remain-on-exit on
tmux set-option -t {session_name} history-limit 5000
```

The `command` string is passed as a single argument to tmux — tmux handles shell execution internally. The `;exec bash` suffix keeps the session alive after the command finishes, allowing output inspection.

**Errors:**
- Workspace not in Running phase
- tmux session name already exists
- tmux not installed in target workspace image
- Container not found

### `read_agent_output`

Captures recent terminal output from a coding agent's tmux session.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspace` | string | yes | — | Target DevWorkspace name |
| `session_name` | string | no | `agent` | tmux session name |
| `lines` | number | no | `50` | Number of lines to capture |
| `container` | string | no | auto-detect | Container name for exec |

**Output:** `{ output: "...", lines_returned: 42 }` — plain text, last N lines. `lines_returned` is the actual number of lines in the output (may be less than requested if the session has less output).

**Implementation:**
```bash
tmux capture-pane -t {session_name} -p -S -{lines}
```

**Scrollback limit:** The session is configured with a 5000-line scrollback buffer. Requests beyond this return only the available history.

### `send_agent_input`

Sends text to a coding agent's tmux session.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspace` | string | yes | — | Target DevWorkspace name |
| `text` | string | yes | — | Text to send |
| `session_name` | string | no | `agent` | tmux session name |
| `enter` | boolean | no | `true` | Press Enter after text |
| `container` | string | no | auto-detect | Container name for exec |

**Output:** `{ success: true }` or error.

**Implementation:** Uses tmux literal mode (`-l`) to avoid key name interpretation, preventing injection of tmux control sequences:
```bash
tmux send-keys -t {session_name} -l {text}
```
If `enter` is true, a separate send-keys call follows:
```bash
tmux send-keys -t {session_name} Enter
```

The `text` value is passed to the exec API as a command argument array (not interpolated into a shell string), avoiding shell injection.

### `get_agent_state`

Checks whether the tmux session and coding agent process are alive.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspace` | string | yes | — | Target DevWorkspace name |
| `session_name` | string | no | `agent` | tmux session name |
| `container` | string | no | auto-detect | Container name for exec |

**Output:**
```json
{
  "session_alive": true,
  "process_running": true,
  "exit_code": null
}
```

`exit_code` is `number | null` — set only when `process_running` is false.

**Implementation:**
```bash
tmux list-panes -t {session_name} -F '#{pane_pid} #{pane_dead} #{pane_dead_status}'
```

When `pane_dead` is `1`, `process_running` is `false` and `exit_code` is parsed from `pane_dead_status`. When the session does not exist, `session_alive` is `false`.

### `stop_agent_session`

Kills a tmux session and its coding agent process.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `workspace` | string | yes | — | Target DevWorkspace name |
| `session_name` | string | no | `agent` | tmux session name |
| `container` | string | no | auto-detect | Container name for exec |

**Output:** `{ success: true }` or error.

**Implementation:**
```bash
tmux kill-session -t {session_name}
```

Returns success even if the session was already dead (idempotent).

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Workspace not Running | Return error: "Workspace {name} is in {phase} state" |
| tmux session already exists | Return error: "Session {name} already exists in workspace {workspace}" |
| tmux session not found | `get_agent_state` returns `session_alive: false`; `read_agent_output` and `send_agent_input` return error |
| tmux session died (remain-on-exit) | `get_agent_state` returns `process_running: false` with `exit_code`; `read_agent_output` returns last captured output |
| Pod exec timeout | 10-second timeout; return error: "Exec timed out for workspace {name}" |
| Token expired | Kubernetes client returns 401; surface as: "Authentication expired, please restart the agent workspace" |
| tmux not installed | `start_agent_session` returns: "tmux not found in workspace {name}. The workspace image must include tmux." |
| Container not found | Return error: "Container {name} not found in workspace {workspace}" |
| Exec status channel errors | Parse WebSocket stream 3 (status channel) for error messages; surface as tool errors |

## Security Considerations

**Shell injection prevention:** All exec operations pass commands as argument arrays to the Kubernetes exec API, not as interpolated shell strings. The `send_agent_input` tool uses tmux's `-l` (literal) flag to prevent interpretation of text as tmux key names.

**Namespace isolation:** The server only accesses the namespace from the user's kubeconfig context. No cross-namespace operations are possible.

**Token scope:** The user's OAuth token limits operations to what the user can do in the Che Dashboard — no privilege escalation.

## Project Structure

```
che-mcp-server/
├── src/
│   ├── index.ts              # MCP server entry point (stdio transport)
│   ├── tools/
│   │   ├── list-workspaces.ts
│   │   ├── start-agent-session.ts
│   │   ├── read-agent-output.ts
│   │   ├── send-agent-input.ts
│   │   ├── get-agent-state.ts
│   │   └── stop-agent-session.ts
│   ├── kube/
│   │   ├── client.ts         # K8s client setup (loads kubeconfig from env)
│   │   └── exec.ts           # Pod exec wrapper (WebSocket-based, one-shot)
│   └── types.ts              # Shared types
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `@kubernetes/client-node` — Kubernetes API client

No other runtime dependencies.

## Prerequisites

- Target workspaces must have `tmux` 3.1+ installed
- The agent workspace must have the user's kubeconfig injected (standard in Eclipse Che)
- Node.js 18+ runtime in the agent workspace image

## Deployment

The MCP server runs as a stdio subprocess of the AI agent inside the agent workspace. It is not a service, has no ports, and requires no Kubernetes resources of its own. Installation options:

1. **npm global install** — `npm install -g che-mcp-server`, then configure the AI agent to spawn `che-mcp-server` as an MCP server
2. **Baked into the agent workspace image** — add to the Dockerfile
3. **npx** — `npx che-mcp-server` for one-off use

## Future Work (out of v1 scope)

- **Workspace lifecycle tools:** `create_workspace`, `start_workspace`, `stop_workspace`, `delete_workspace`
- **Log streaming:** `get_workspace_logs` for container logs
- **Route discovery:** `get_workspace_routes` for exposed URLs
- **Annotation management:** `set_workspace_annotation` for coding agents to report status
- **Multiple coding agents:** Support for different CLI agents (Claude Code, OpenCode, KiloCode)
- **Session listing:** `list_agent_sessions` across all target workspaces
- **Restricted shell mode:** Lock down agent workspace terminal to allowed commands only
