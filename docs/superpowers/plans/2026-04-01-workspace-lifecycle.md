# Workspace Lifecycle Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four MCP tools (create, start, stop, delete) for DevWorkspace lifecycle management.

**Architecture:** Each tool is a single function in its own file under `src/tools/`, registered in `src/tools.ts`. All use the existing `customObjectsApi` from `src/kube/client.ts` with group `workspace.devfile.io`, version `v1alpha2`, plural `devworkspaces`. TDD with Vitest, mocking the kube client.

**Tech Stack:** TypeScript, `@kubernetes/client-node`, Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-workspace-lifecycle-design.md`

---

### Task 1: `create_workspace` tool

**Files:**
- Create: `src/tools/create-workspace.ts`
- Test: `tests/tools/create-workspace.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/tools/create-workspace.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('createWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates a workspace with explicit name', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      createNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { name: 'my-workspace' },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { createWorkspace } = await import('../../src/tools/create-workspace.js');
    const result = await createWorkspace({ name: 'my-workspace' });

    expect(result).toEqual({ name: 'my-workspace', started: true });
    expect(mockApi.createNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      body: {
        apiVersion: 'workspace.devfile.io/v1alpha2',
        kind: 'DevWorkspace',
        metadata: { name: 'my-workspace' },
        spec: {
          started: true,
          template: { schemaVersion: '2.2.0' },
        },
      },
    });
  });

  it('creates a workspace with generateName when name is omitted', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      createNamespacedCustomObject: vi.fn().mockResolvedValue({
        metadata: { name: 'empty-abc12' },
      }),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { createWorkspace } = await import('../../src/tools/create-workspace.js');
    const result = await createWorkspace({});

    expect(result).toEqual({ name: 'empty-abc12', started: true });
    expect(mockApi.createNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      body: {
        apiVersion: 'workspace.devfile.io/v1alpha2',
        kind: 'DevWorkspace',
        metadata: { generateName: 'empty-' },
        spec: {
          started: true,
          template: { schemaVersion: '2.2.0' },
        },
      },
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/create-workspace.test.ts`
Expected: FAIL — module `../../src/tools/create-workspace.js` not found

- [x] **Step 3: Write the implementation**

Create `src/tools/create-workspace.ts`:

```typescript
import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

interface CreateWorkspaceParams {
  name?: string;
}

export async function createWorkspace(params: CreateWorkspaceParams): Promise<{ name: string; started: boolean }> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  const metadata: Record<string, string> = params.name
    ? { name: params.name }
    : { generateName: 'empty-' };

  const body = {
    apiVersion: 'workspace.devfile.io/v1alpha2',
    kind: 'DevWorkspace',
    metadata,
    spec: {
      started: true,
      template: { schemaVersion: '2.2.0' },
    },
  };

  const result = await api.createNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    body,
  });

  return { name: (result as any).metadata.name, started: true };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/create-workspace.test.ts`
Expected: PASS (2 tests)

- [x] **Step 5: Commit**

```bash
git add src/tools/create-workspace.ts tests/tools/create-workspace.test.ts
git commit -s -m "feat: add create_workspace tool"
```

---

### Task 2: `start_workspace` tool

**Files:**
- Create: `src/tools/start-workspace.ts`
- Test: `tests/tools/start-workspace.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/tools/start-workspace.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('startWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('patches workspace to started: true', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      patchNamespacedCustomObject: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { startWorkspace } = await import('../../src/tools/start-workspace.js');
    const result = await startWorkspace({ workspace: 'my-workspace' });

    expect(result).toEqual({ name: 'my-workspace', started: true });
    expect(mockApi.patchNamespacedCustomObject).toHaveBeenCalledWith(
      {
        group: 'workspace.devfile.io',
        version: 'v1alpha2',
        namespace: 'test-namespace',
        plural: 'devworkspaces',
        name: 'my-workspace',
        body: { spec: { started: true } },
      },
      { headers: { 'Content-Type': 'application/merge-patch+json' } },
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/start-workspace.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Write the implementation**

Create `src/tools/start-workspace.ts`:

```typescript
import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

interface StartWorkspaceParams {
  workspace: string;
}

export async function startWorkspace(params: StartWorkspaceParams): Promise<{ name: string; started: boolean }> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  await api.patchNamespacedCustomObject(
    {
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace,
      plural: 'devworkspaces',
      name: params.workspace,
      body: { spec: { started: true } },
    },
    { headers: { 'Content-Type': 'application/merge-patch+json' } },
  );

  return { name: params.workspace, started: true };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/start-workspace.test.ts`
Expected: PASS (1 test)

- [x] **Step 5: Commit**

```bash
git add src/tools/start-workspace.ts tests/tools/start-workspace.test.ts
git commit -s -m "feat: add start_workspace tool"
```

---

### Task 3: `stop_workspace` tool

**Files:**
- Create: `src/tools/stop-workspace.ts`
- Test: `tests/tools/stop-workspace.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/tools/stop-workspace.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('stopWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('patches workspace to started: false', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      patchNamespacedCustomObject: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { stopWorkspace } = await import('../../src/tools/stop-workspace.js');
    const result = await stopWorkspace({ workspace: 'my-workspace' });

    expect(result).toEqual({ name: 'my-workspace', started: false });
    expect(mockApi.patchNamespacedCustomObject).toHaveBeenCalledWith(
      {
        group: 'workspace.devfile.io',
        version: 'v1alpha2',
        namespace: 'test-namespace',
        plural: 'devworkspaces',
        name: 'my-workspace',
        body: { spec: { started: false } },
      },
      { headers: { 'Content-Type': 'application/merge-patch+json' } },
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/stop-workspace.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Write the implementation**

Create `src/tools/stop-workspace.ts`:

```typescript
import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

interface StopWorkspaceParams {
  workspace: string;
}

export async function stopWorkspace(params: StopWorkspaceParams): Promise<{ name: string; started: boolean }> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  await api.patchNamespacedCustomObject(
    {
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace,
      plural: 'devworkspaces',
      name: params.workspace,
      body: { spec: { started: false } },
    },
    { headers: { 'Content-Type': 'application/merge-patch+json' } },
  );

  return { name: params.workspace, started: false };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/stop-workspace.test.ts`
Expected: PASS (1 test)

- [x] **Step 5: Commit**

```bash
git add src/tools/stop-workspace.ts tests/tools/stop-workspace.test.ts
git commit -s -m "feat: add stop_workspace tool"
```

---

### Task 4: `delete_workspace` tool

**Files:**
- Create: `src/tools/delete-workspace.ts`
- Test: `tests/tools/delete-workspace.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/tools/delete-workspace.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/kube/client.js');

describe('deleteWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('deletes the DevWorkspace custom resource', async () => {
    const { getCustomObjectsApi, getNamespace } = await import('../../src/kube/client.js');
    const mockApi = {
      deleteNamespacedCustomObject: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getCustomObjectsApi).mockReturnValue(mockApi as any);
    vi.mocked(getNamespace).mockReturnValue('test-namespace');

    const { deleteWorkspace } = await import('../../src/tools/delete-workspace.js');
    const result = await deleteWorkspace({ workspace: 'my-workspace' });

    expect(result).toEqual({ name: 'my-workspace', deleted: true });
    expect(mockApi.deleteNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'workspace.devfile.io',
      version: 'v1alpha2',
      namespace: 'test-namespace',
      plural: 'devworkspaces',
      name: 'my-workspace',
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/delete-workspace.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Write the implementation**

Create `src/tools/delete-workspace.ts`:

```typescript
import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

interface DeleteWorkspaceParams {
  workspace: string;
}

export async function deleteWorkspace(params: DeleteWorkspaceParams): Promise<{ name: string; deleted: boolean }> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  await api.deleteNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: params.workspace,
  });

  return { name: params.workspace, deleted: true };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/delete-workspace.test.ts`
Expected: PASS (1 test)

- [x] **Step 5: Commit**

```bash
git add src/tools/delete-workspace.ts tests/tools/delete-workspace.test.ts
git commit -s -m "feat: add delete_workspace tool"
```

---

### Task 5: Register tools in `src/tools.ts`

**Files:**
- Modify: `src/tools.ts`

- [x] **Step 1: Add imports and register all four tools**

Add to `src/tools.ts` after the existing imports:

```typescript
import { createWorkspace } from './tools/create-workspace.js';
import { startWorkspace } from './tools/start-workspace.js';
import { stopWorkspace } from './tools/stop-workspace.js';
import { deleteWorkspace } from './tools/delete-workspace.js';
```

Add these registrations inside `createMcpServer()`, after the existing `stop_agent_session` block:

```typescript
  server.tool(
    'create_workspace',
    'Create a new DevWorkspace from the default empty template and start it',
    {
      name: z.string().optional().describe('Workspace name (auto-generated if omitted)'),
    },
    async ({ name }) => {
      try {
        const result = await createWorkspace({ name });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'start_workspace',
    'Start a stopped DevWorkspace (sets spec.started to true)',
    {
      workspace: z.string().describe('DevWorkspace name to start'),
    },
    async ({ workspace }) => {
      try {
        const result = await startWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'stop_workspace',
    'Stop a running DevWorkspace (sets spec.started to false)',
    {
      workspace: z.string().describe('DevWorkspace name to stop'),
    },
    async ({ workspace }) => {
      try {
        const result = await stopWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    'delete_workspace',
    'Delete a DevWorkspace (regardless of current state)',
    {
      workspace: z.string().describe('DevWorkspace name to delete'),
    },
    async ({ workspace }) => {
      try {
        const result = await deleteWorkspace({ workspace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );
```

- [x] **Step 2: Run all tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All tests pass (existing + 5 new tests)

- [x] **Step 3: Build to verify TypeScript compiles**

Run: `npm run build`
Expected: Clean compilation, no errors

- [x] **Step 4: Commit**

```bash
git add src/tools.ts
git commit -s -m "feat: register workspace lifecycle tools in MCP server"
```
