# Workspace Lifecycle Tools — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Overview

Add four new MCP tools to manage DevWorkspace lifecycle: create, start, stop, delete. These complement the existing six agent session tools.

## Tool Interfaces

### `create_workspace`

- **Params:** `name` (string, optional)
- Builds a DevWorkspace CR from an embedded empty devfile template
- If `name` provided → `metadata.name = name`, no `generateName`
- If omitted → `metadata.generateName = "empty"`
- Sets `spec.started = true` (auto-start after creation)
- **Returns:** `{ name, started: true }` (name is the actual created name, including generated suffix)

### `start_workspace`

- **Params:** `workspace` (string, required)
- Patches `spec.started = true` via JSON merge patch
- **Returns:** `{ name, started: true }`

### `stop_workspace`

- **Params:** `workspace` (string, required)
- Patches `spec.started = false` via JSON merge patch
- **Returns:** `{ name, started: false }`

### `delete_workspace`

- **Params:** `workspace` (string, required)
- Deletes the DevWorkspace CR
- **Returns:** `{ name, deleted: true }`

## Kubernetes API Operations

All operations use `customObjectsApi` with:
- Group: `workspace.devfile.io`
- Version: `v1alpha2`
- Plural: `devworkspaces`

### Create

`createNamespacedCustomObject` with this DevWorkspace CR:

```yaml
apiVersion: workspace.devfile.io/v1alpha2
kind: DevWorkspace
metadata:
  name: <name>           # or generateName: "empty"
  namespace: <namespace>
spec:
  started: true
  template:
    schemaVersion: "2.2.0"
```

### Start / Stop

`patchNamespacedCustomObject` with JSON merge patch (`application/merge-patch+json`):

```json
{ "spec": { "started": true/false } }
```

### Delete

`deleteNamespacedCustomObject`

All four use `getNamespace()` and `getCustomObjectsApi()` from `src/kube/client.ts` — no new kube infrastructure needed.

## File Structure

### New files

- `src/tools/create-workspace.ts`
- `src/tools/start-workspace.ts`
- `src/tools/stop-workspace.ts`
- `src/tools/delete-workspace.ts`
- `tests/tools/create-workspace.test.ts`
- `tests/tools/start-workspace.test.ts`
- `tests/tools/stop-workspace.test.ts`
- `tests/tools/delete-workspace.test.ts`

### Modified files

- `src/tools.ts` — import and register the four new tools

Each tool file exports a single async function following the existing pattern. Registration in `tools.ts` uses the same try/catch + `isError` pattern.

### Testing

Each test mocks `getCustomObjectsApi()` and `getNamespace()` from `src/kube/client.ts`.

## Backlog (deferred)

- **Force stop** — delete resources blocked by finalizers
- **Git repo support** — optional `repos` parameter on `create_workspace` to inject `projects` into the devfile
- **Raw YAML support** — accept full DevWorkspace YAML for advanced cases
- **Workspace status/details** — get detailed status, events, logs
- **File operations** — read/write files in workspace pods
- **Git operations** — clone, status, diff in workspaces
- **Resource monitoring** — CPU/memory usage of workspaces
