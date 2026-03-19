# che-mcp-server — Definition of Done

**Date:** 2026-03-19
**Spec:** [che-mcp-server-design.md](2026-03-19-che-mcp-server-design.md)

## Binary Gates

Each gate is pass/fail. All must pass before v1 is considered done.

### G1: Project Setup

- [ ] TypeScript project builds with `npm run build` — zero errors
- [ ] MCP server starts via `npx che-mcp-server` and responds to `tools/list` over stdio
- [ ] `package.json` declares `bin` entry for the `che-mcp-server` command

### G2: Kubernetes Connectivity

- [ ] Server loads kubeconfig from default location (`$KUBECONFIG` or `~/.kube/config`)
- [ ] Server resolves namespace from the current kubeconfig context
- [ ] Server returns a clear error when kubeconfig is missing or token is expired

### G3: `list_workspaces`

- [ ] Returns all DevWorkspaces in the user's namespace
- [ ] Each entry includes `name`, `phase`, `url`, and `annotations`
- [ ] `url` is populated from `.status.mainUrl` when workspace is Running, empty string otherwise
- [ ] `annotations` are filtered to `che.eclipse.org/agent-*` keys only
- [ ] Returns empty array (not error) when no workspaces exist

### G4: `start_agent_session`

- [ ] Creates a tmux session inside a Running target workspace via pod exec
- [ ] Execs into the correct container (auto-detect or explicit `container` parameter)
- [ ] Session is created with `remain-on-exit on` and `history-limit 5000`
- [ ] Returns error when workspace is not Running
- [ ] Returns error when session name already exists
- [ ] Returns error when tmux is not installed in the target workspace

### G5: `read_agent_output`

- [ ] Returns last N lines of the tmux session output as plain text
- [ ] `lines_returned` reflects actual line count (not the requested count)
- [ ] Works on a dead session (returns last captured output due to `remain-on-exit`)
- [ ] Returns error when session does not exist

### G6: `send_agent_input`

- [ ] Sends text to the tmux session using literal mode (`-l`)
- [ ] Sends Enter key when `enter: true` (default)
- [ ] Does not send Enter when `enter: false`
- [ ] Text containing quotes, newlines, and shell metacharacters is delivered verbatim (no injection)
- [ ] Returns error when session does not exist

### G7: `get_agent_state`

- [ ] Returns `session_alive: true, process_running: true` for a running session
- [ ] Returns `session_alive: true, process_running: false, exit_code: N` when the agent process has exited
- [ ] Returns `session_alive: false` when the session does not exist
- [ ] `exit_code` is `null` when process is still running

### G8: `stop_agent_session`

- [ ] Kills the tmux session and its child processes
- [ ] Returns success when the session was already dead (idempotent)
- [ ] Returns error when workspace is not Running

### G9: End-to-End Scenario

- [ ] From an MCP client, the following sequence completes without manual intervention:
  1. `list_workspaces` — returns at least one Running workspace
  2. `start_agent_session` — starts `gemini` (or any CLI agent) in a target workspace
  3. `read_agent_output` — returns the agent's initial output
  4. `send_agent_input` — sends a response when the agent prompts for input
  5. `get_agent_state` — confirms the agent is still running
  6. `stop_agent_session` — terminates the session
  7. `get_agent_state` — confirms `session_alive: false`

### G10: Documentation

- [ ] README includes: what the server does, how to install, how to configure, usage example with an MCP client
- [ ] All tools are documented with input/output schemas in the README
- [ ] Prerequisites (tmux, kubeconfig, Node.js) are listed
