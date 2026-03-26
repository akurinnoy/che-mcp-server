# che-mcp-server

A Model Context Protocol (MCP) server for Eclipse Che workspace management and coding agent orchestration. It exposes DevWorkspace operations and tmux-based agent session control as tools, allowing any MCP-compatible AI agent to list workspaces, launch coding agents inside them, monitor their output, and relay user input when the agent is blocked.

## Prerequisites

- **Target workspaces:** tmux 3.1+ installed in the workspace image (most Ubuntu 22.04+ and UBI 9+ images include tmux 3.2+)
- **Agent workspace:** User's kubeconfig injected (standard in Eclipse Che)
- **Runtime:** Node.js 18+

## Installation

### Global install
```bash
npm install -g che-mcp-server
```

### One-off use with npx
```bash
npx che-mcp-server
```

### Baked into workspace image
Add to your Dockerfile:
```dockerfile
RUN npm install -g che-mcp-server
```

## Configuration

The server reads the namespace from the current kubeconfig context (automatically set in Eclipse Che). Falls back to the `CHE_MCP_NAMESPACE` environment variable if the kubeconfig context has no namespace.

No additional configuration is required.

## Container Deployment

The server supports containerized deployment for HTTP transport mode.

### Building the container image

```bash
make build && make image
```

### Pushing to a container registry

```bash
make image-push
```

### Deploying to Kubernetes

```bash
kubectl apply -k deploy/ -n <namespace>
```

### Custom image and tag

Override the image name and tag:

```bash
IMAGE=myrepo/myimage TAG=v1 make image
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHE_MCP_TRANSPORT` | Transport mode: `stdio` or `http` | `stdio` |
| `CHE_MCP_PORT` | Port for HTTP transport | `8080` |
| `CHE_MCP_NAMESPACE` | Override namespace detection | (from kubeconfig) |

CLI flags override environment variables:
- `--transport <stdio|http>` — override `CHE_MCP_TRANSPORT`
- `--port <number>` — override `CHE_MCP_PORT`

## Client Configuration

### ZeroClaw

Add to your `zeroclaw.toml`:

```toml
[[mcp.servers]]
name = "che"
transport = "http"
url = "http://che-mcp-server:8080/mcp"
```

### Claude Code

Add via CLI:

```bash
claude mcp add --transport sse che http://che-mcp-server:8080/mcp
```

## Tool Reference

| Tool | Description | Parameters | Output |
|------|-------------|------------|--------|
| `list_workspaces` | Lists all DevWorkspaces in the user's namespace | None | Array of `{ name, phase, url, annotations }` |
| `start_agent_session` | Starts a tmux session with a coding agent in a target workspace | `workspace` (required), `command` (required), `session_name` (default: `agent`), `container` (auto-detect) | `{ success: true, session_name: "agent" }` |
| `read_agent_output` | Captures recent terminal output from a tmux session | `workspace` (required), `session_name` (default: `agent`), `lines` (default: 50), `container` (auto-detect) | `{ output: "...", lines_returned: 42 }` |
| `send_agent_input` | Sends text to a tmux session | `workspace` (required), `text` (required), `session_name` (default: `agent`), `enter` (default: true), `container` (auto-detect) | `{ success: true }` |
| `get_agent_state` | Checks if tmux session and process are alive | `workspace` (required), `session_name` (default: `agent`), `container` (auto-detect) | `{ session_alive: true, process_running: true, exit_code: null }` |
| `stop_agent_session` | Kills a tmux session | `workspace` (required), `session_name` (default: `agent`), `container` (auto-detect) | `{ success: true }` |

### Output Formats

#### `list_workspaces`
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
- `url` is the workspace's main URL (from `.status.mainUrl`). Empty string if workspace is not Running.
- `annotations` are filtered to keys prefixed with `che.eclipse.org/agent-`. Coding agents can report status by annotating their DevWorkspace CR with keys like `che.eclipse.org/agent-status`, `che.eclipse.org/agent-progress`.

#### `get_agent_state`
```json
{
  "session_alive": true,
  "process_running": true,
  "exit_code": null
}
```
- `exit_code` is `number | null` — set only when `process_running` is false.

## Usage Example

Configure as an MCP server in Claude Code:

```bash
claude mcp add che-mcp-server -- npx che-mcp-server
```

Or if installed globally:

```bash
claude mcp add che-mcp-server -- che-mcp-server
```

Once configured, the AI agent can use the tools directly. Example workflow:

1. **List workspaces:** `list_workspaces` → find `my-project` in Running state
2. **Start coding agent:** `start_agent_session` with `workspace: "my-project"`, `command: "gemini -p 'Add tests for auth module'"`
3. **Monitor output:** `read_agent_output` → capture terminal output
4. **Relay input when blocked:** `send_agent_input` with `text: "Yes, proceed"`
5. **Check completion:** `get_agent_state` → process exited with code 0
6. **Cleanup:** `stop_agent_session`

## How It Works

The server is a stateless bridge between MCP clients and the Kubernetes API. It translates MCP tool calls into Kubernetes API calls and pod exec commands.

### Agent Sessions

Coding agent sessions are implemented using tmux inside target workspaces. Each tool call creates a one-shot exec connection to the target pod, runs a single tmux command, and closes. The tmux session persists independently inside the pod.

Session lifecycle:
- **Start:** `tmux new-session -d -s agent 'gemini'` — creates a detached session
- **Read output:** `tmux capture-pane -t agent -p` — captures scrollback buffer
- **Send input:** `tmux send-keys -t agent -l 'response'` — uses literal mode to prevent injection
- **Check state:** `tmux list-panes -t agent -F '#{pane_pid} #{pane_dead} #{pane_dead_status}'`
- **Stop:** `tmux kill-session -t agent`

Sessions are configured with `remain-on-exit on` and 5000-line scrollback, ensuring output is preserved after the coding agent exits.

### Namespace Isolation

The server only accesses the namespace from the user's kubeconfig context. No cross-namespace operations are possible. The user's OAuth token limits operations to what the user can do in the Che Dashboard — no privilege escalation.

### Container Targeting

All exec operations target the first container in the pod's container list that is NOT named `che-gateway`. This is the primary dev container in Che workspaces. An optional `container` parameter on all agent session tools allows explicit override when needed.

## License

Apache-2.0
