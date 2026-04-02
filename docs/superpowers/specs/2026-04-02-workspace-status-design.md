# Workspace Status Tools — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Overview

Add two new MCP tools to inspect DevWorkspace state: `get_workspace_status` (CR details) and `get_workspace_pod` (pod info). These complement the existing lifecycle tools.

## Tool Interfaces

### `get_workspace_status`

- **Params:** `workspace` (string, required)
- Fetches the DevWorkspace CR via `getNamespacedCustomObject`
- **Returns:**
```json
{
  "name": "my-workspace",
  "phase": "Running",
  "devworkspaceId": "workspace-abc123",
  "mainUrl": "https://...",
  "started": true,
  "createdAt": "2026-04-01T12:00:00Z",
  "conditions": [
    { "type": "Ready", "status": "True", "reason": "...", "message": "..." }
  ],
  "annotations": { "...": "..." },
  "labels": { "...": "..." }
}
```

### `get_workspace_pod`

- **Params:** `workspace` (string, required)
- Finds the running pod, then reads full pod status
- **Returns:**
```json
{
  "workspace": "my-workspace",
  "podName": "workspace-abc123-pod",
  "phase": "Running",
  "containers": [
    { "name": "dev-container", "ready": true, "restartCount": 0 },
    { "name": "che-gateway", "ready": true, "restartCount": 1 }
  ]
}
```

## Kubernetes API Operations

### `get_workspace_status`

Single call: `customObjectsApi.getNamespacedCustomObject({ group, version, namespace, plural, name })`

Extracts from response:
- `metadata.name`, `metadata.creationTimestamp`, `metadata.annotations`, `metadata.labels`
- `spec.started`
- `status.phase`, `status.devworkspaceId`, `status.mainUrl`, `status.conditions`

### `get_workspace_pod`

Two calls:
1. `findPodForWorkspace(workspace)` — existing function in `src/kube/exec.ts`, returns `podName`
2. `coreV1Api.readNamespacedPod({ name: podName, namespace })` — full pod status

Container info mapped from `status.containerStatuses[]`:
- `name` → `containerStatus.name`
- `ready` → `containerStatus.ready`
- `restartCount` → `containerStatus.restartCount`

## File Structure

### New files

- `src/tools/get-workspace-status.ts`
- `src/tools/get-workspace-pod.ts`
- `tests/tools/get-workspace-status.test.ts`
- `tests/tools/get-workspace-pod.test.ts`

### Modified files

- `src/tools.ts` — import and register both new tools
