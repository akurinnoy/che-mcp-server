# Workspace Status Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two MCP tools (`get_workspace_status`, `get_workspace_pod`) for inspecting DevWorkspace state and pod details.

**Architecture:** Each tool is a single function in its own file under `src/tools/`, registered in `src/tools.ts`. `get_workspace_status` reads the DevWorkspace CR via `customObjectsApi`. `get_workspace_pod` reuses `findPodForWorkspace` from `src/kube/exec.ts` to locate the pod, then reads full pod status via `coreV1Api`. TDD with Vitest, mocking the kube client.

**Tech Stack:** TypeScript, `@kubernetes/client-node`, Vitest

**Spec:** `docs/superpowers/specs/2026-04-02-workspace-status-design.md`

---

### Task 1: `get_workspace_status` tool

**Files:**
- Create: `src/tools/get-workspace-status.ts`
- Test: `tests/tools/get-workspace-status.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/tools/get-workspace-status.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('getWorkspaceStatus', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns workspace status details from the DevWorkspace CR', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      getNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: {
          name: 'my-workspace',
          creationTimestamp: '2026-04-01T12:00:00Z',
          annotations: { 'che.eclipse.org/agent-session': 'active' },
          labels: { 'app': 'che' },
        },
        spec: {
          started: true,
        },
        status: {
          phase: 'Running',
          devworkspaceId: 'workspace-abc123',
          mainUrl: 'https://my-workspace.example.com',
          conditions: [
            { type: 'Ready', status: 'True', reason: 'AllGood', message: 'Workspace is ready' },
          ],
        },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { getWorkspaceStatus } = await import('../../src/tools/get-workspace-status.js');
    const result = await getWorkspaceStatus({ workspace: 'my-workspace' });

    expect(result).toEqual({
      name: 'my-workspace',
      phase: 'Running',
      devworkspaceId: 'workspace-abc123',
      mainUrl: 'https://my-workspace.example.com',
      started: true,
      createdAt: '2026-04-01T12:00:00Z',
      conditions: [
        { type: 'Ready', status: 'True', reason: 'AllGood', message: 'Workspace is ready' },
      ],
      annotations: { 'che.eclipse.org/agent-session': 'active' },
      labels: { 'app': 'che' },
    });
    expect(mockApi.getNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      name: 'my-workspace',
    });
  });

  it('returns defaults for missing optional fields', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      getNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: {
          name: 'minimal-workspace',
        },
        spec: {},
        status: {
          phase: 'Starting',
        },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { getWorkspaceStatus } = await import('../../src/tools/get-workspace-status.js');
    const result = await getWorkspaceStatus({ workspace: 'minimal-workspace' });

    expect(result).toEqual({
      name: 'minimal-workspace',
      phase: 'Starting',
      devworkspaceId: '',
      mainUrl: '',
      started: false,
      createdAt: '',
      conditions: [],
      annotations: {},
      labels: {},
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/get-workspace-status.test.ts`
Expected: FAIL — module `../../src/tools/get-workspace-status.js` not found

- [x] **Step 3: Write the implementation**

Create `src/tools/get-workspace-status.ts`:

```typescript
import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

interface GetWorkspaceStatusParams {
  workspace: string;
}

interface WorkspaceCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
}

interface WorkspaceStatus {
  name: string;
  phase: string;
  devworkspaceId: string;
  mainUrl: string;
  started: boolean;
  createdAt: string;
  conditions: WorkspaceCondition[];
  annotations: Record<string, string>;
  labels: Record<string, string>;
}

export async function getWorkspaceStatus(params: GetWorkspaceStatusParams): Promise<WorkspaceStatus> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  const dw = await api.getNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: params.workspace,
  }) as any;

  return {
    name: dw.metadata?.name || '',
    phase: dw.status?.phase || 'Unknown',
    devworkspaceId: dw.status?.devworkspaceId || '',
    mainUrl: dw.status?.mainUrl || '',
    started: dw.spec?.started || false,
    createdAt: dw.metadata?.creationTimestamp || '',
    conditions: (dw.status?.conditions || []).map((c: any) => ({
      type: c.type || '',
      status: c.status || '',
      reason: c.reason || '',
      message: c.message || '',
    })),
    annotations: dw.metadata?.annotations || {},
    labels: dw.metadata?.labels || {},
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/get-workspace-status.test.ts`
Expected: PASS (2 tests)

- [x] **Step 5: Commit**

```bash
git add src/tools/get-workspace-status.ts tests/tools/get-workspace-status.test.ts
git commit -s -m "feat: add get_workspace_status tool"
```

---

### Task 2: `get_workspace_pod` tool

**Files:**
- Create: `src/tools/get-workspace-pod.ts`
- Test: `tests/tools/get-workspace-pod.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/tools/get-workspace-pod.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');
vi.mock('../../src/kube/exec.js');

describe('getWorkspacePod', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns pod details with container statuses', async () => {
    const { getCoreV1Api, getNamespace } = await import('../../src/kube/client.js');
    const { findPodForWorkspace } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-abc123-pod',
      containers: ['dev-container', 'che-gateway'],
    });

    const mockCoreApi = {
      readNamespacedPod: vi.fn().mockResolvedValue({
        status: {
          phase: 'Running',
          containerStatuses: [
            { name: 'dev-container', ready: true, restartCount: 0 },
            { name: 'che-gateway', ready: true, restartCount: 1 },
          ],
        },
      }),
    };
    vi.mocked(getCoreV1Api).mockReturnValue(mockCoreApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { getWorkspacePod } = await import('../../src/tools/get-workspace-pod.js');
    const result = await getWorkspacePod({ workspace: 'my-workspace' });

    expect(result).toEqual({
      workspace: 'my-workspace',
      podName: 'workspace-abc123-pod',
      phase: 'Running',
      containers: [
        { name: 'dev-container', ready: true, restartCount: 0 },
        { name: 'che-gateway', ready: true, restartCount: 1 },
      ],
    });
    expect(findPodForWorkspace).toHaveBeenCalledWith('my-workspace');
    expect(mockCoreApi.readNamespacedPod).toHaveBeenCalledWith({
      name: 'workspace-abc123-pod',
      namespace: 'test-namespace',
    });
  });

  it('returns empty containers when containerStatuses is missing', async () => {
    const { getCoreV1Api, getNamespace } = await import('../../src/kube/client.js');
    const { findPodForWorkspace } = await import('../../src/kube/exec.js');

    vi.mocked(findPodForWorkspace).mockResolvedValue({
      podName: 'workspace-xyz-pod',
      containers: ['dev-container'],
    });

    const mockCoreApi = {
      readNamespacedPod: vi.fn().mockResolvedValue({
        status: {
          phase: 'Pending',
        },
      }),
    };
    vi.mocked(getCoreV1Api).mockReturnValue(mockCoreApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { getWorkspacePod } = await import('../../src/tools/get-workspace-pod.js');
    const result = await getWorkspacePod({ workspace: 'my-workspace' });

    expect(result).toEqual({
      workspace: 'my-workspace',
      podName: 'workspace-xyz-pod',
      phase: 'Pending',
      containers: [],
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/get-workspace-pod.test.ts`
Expected: FAIL — module `../../src/tools/get-workspace-pod.js` not found

- [x] **Step 3: Write the implementation**

Create `src/tools/get-workspace-pod.ts`:

```typescript
import { getCoreV1Api, getNamespace } from '../kube/client.js';
import { findPodForWorkspace } from '../kube/exec.js';

interface GetWorkspacePodParams {
  workspace: string;
}

interface ContainerInfo {
  name: string;
  ready: boolean;
  restartCount: number;
}

interface WorkspacePodInfo {
  workspace: string;
  podName: string;
  phase: string;
  containers: ContainerInfo[];
}

export async function getWorkspacePod(params: GetWorkspacePodParams): Promise<WorkspacePodInfo> {
  const { podName } = await findPodForWorkspace(params.workspace);
  const coreApi = getCoreV1Api();
  const namespace = getNamespace();

  const pod = await coreApi.readNamespacedPod({
    name: podName,
    namespace,
  });

  const containers = (pod.status?.containerStatuses || []).map((cs) => ({
    name: cs.name,
    ready: cs.ready,
    restartCount: cs.restartCount,
  }));

  return {
    workspace: params.workspace,
    podName,
    phase: pod.status?.phase || 'Unknown',
    containers,
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/get-workspace-pod.test.ts`
Expected: PASS (2 tests)

- [x] **Step 5: Commit**

```bash
git add src/tools/get-workspace-pod.ts tests/tools/get-workspace-pod.test.ts
git commit -s -m "feat: add get_workspace_pod tool"
```

---

### Task 3: Register tools in `src/tools.ts`

**Files:**
- Modify: `src/tools.ts`

- [x] **Step 1: Add imports and register both tools**

Add to `src/tools.ts` after the existing imports (after line 12):

```typescript
import { getWorkspaceStatus } from './tools/get-workspace-status.js';
import { getWorkspacePod } from './tools/get-workspace-pod.js';
```

Add these registrations inside `createMcpServer()`, before `return server;`:

```typescript
  server.tool(
    'get_workspace_status',
    'Get detailed status of a DevWorkspace (phase, conditions, URL, timestamps)',
    {
      workspace: z.string().describe('DevWorkspace name'),
    },
    async ({ workspace }) => {
      try {
        const result = await getWorkspaceStatus({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_workspace_pod',
    'Get pod details for a running DevWorkspace (pod name, phase, container status)',
    {
      workspace: z.string().describe('DevWorkspace name'),
    },
    async ({ workspace }) => {
      try {
        const result = await getWorkspacePod({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );
```

- [x] **Step 2: Run all tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All tool tests pass

- [x] **Step 3: Build to verify TypeScript compiles**

Run: `npm run build`
Expected: Clean compilation, no errors

- [x] **Step 4: Commit**

```bash
git add src/tools.ts
git commit -s -m "feat: register workspace status tools in MCP server"
```
