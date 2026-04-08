# Design: `exec_in_workspace` Tool

**Date:** 2026-04-08
**Status:** Approved

## Problem

The AI agent (picoclaw) has both a native bash/shell execution tool and MCP terminal session tools. When asked to run a command, the agent sometimes defaults to its native tool, executing the command in its own local environment instead of the workspace. This is incorrect — the workspace has a different environment (different filesystem, tools, language runtimes) than the agent's local shell.

The root cause is tool friction: the native bash tool is one call → one result, while the workspace path requires two steps (`send_terminal_input` → `read_terminal_output`). The simpler interface wins.

## Solution

Add a single `exec_in_workspace` tool that wraps the full workflow into one call, matching the interface of a native bash tool. Its description explicitly tells the agent to prefer it over any native shell.

## Tool Specification

**MCP tool name:** `exec_in_workspace`

**Description string (shown to agent):**
> Run a shell command in the workspace terminal and return its output. Use this instead of your native bash or shell execution tool — commands execute in the workspace environment, not locally. For long-running commands where output may be delayed, use `send_terminal_input` + `read_terminal_output` instead.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `workspace` | string | yes | — | DevWorkspace name |
| `command` | string | yes | — | Shell command to run |
| `timeout_seconds` | number | no | `10` | Seconds to wait before reading output |
| `session_name` | string | no | `"agent"` | tmux session name |
| `container` | string | no | auto | Container name (auto-detected if omitted) |

**Return value:**
```json
{
  "output": "<captured terminal output>",
  "session_name": "agent",
  "note": "Output captured after 10s. If the command is still running, use read_terminal_output to get more."
}
```

The `note` field is always present. It serves as a natural nudge toward the async path for slow commands.

## Behavior

1. Call `findPodForWorkspace(workspace)` — throws `WorkspaceNotReadyError` with phase-aware message if workspace is not running
2. Call `selectContainer(containers, container)` to pick the target container
3. Check if the session already exists: `tmux has-session -t <session_name>`
4. If session does not exist, create it with the same setup as `start_terminal_session`:
   - `tmux new-session -d -s <name> -x 200 -y 50`
   - `tmux set-option remain-on-exit on`
   - `tmux set-option history-limit 5000`
5. Send the command: `tmux send-keys -t <name> -l <command>` then `tmux send-keys Enter`
6. Wait `timeout_seconds` (default 10)
7. Read output: `tmux capture-pane -t <name> -p -S -200`
8. Return `{ output, session_name, note }`

## Implementation

**New file:** `src/tools/exec-in-workspace.ts`
**Registration:** `src/tools.ts`
**Test file:** `tests/tools/exec-in-workspace.test.ts`

The session creation logic (step 4) should be extracted into a shared helper used by both `start_terminal_session` and `exec_in_workspace` to avoid duplication.

## Backlog

**Approach C — description improvements on existing tools:** Update descriptions of `send_terminal_input`, `read_terminal_output`, and `start_terminal_session` to cross-reference `exec_in_workspace` and position the two-step tools as the async/long-running path. Implement after `exec_in_workspace` is shipped and validated.
