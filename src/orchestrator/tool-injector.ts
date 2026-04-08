import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { getCustomObjectsApi, getNamespace } from '../kube/client.js';

// ─── Registry types ───────────────────────────────────────────────────────────

interface JsonPatchOp {
  op: string;
  path: string;
  value?: unknown;
}

interface ToolEntry {
  description: string;
  pattern: string;
  binary: string;
  patch: JsonPatchOp[];
  editor: {
    volumeMounts: { name: string; path: string }[];
    env: { name: string; value: string }[];
    memoryLimit?: string;
  };
}

interface RegistryData {
  registry: string;
  tag: string;
  infrastructure: { patch: JsonPatchOp[] };
  tools: Record<string, ToolEntry>;
}

// ─── Load registry ────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRegistry(): RegistryData {
  const path = process.env.INJECT_TOOL_REGISTRY_FILE
    ?? join(__dirname, '../tools/registry.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as RegistryData;
}

const REGISTRY = loadRegistry();

function toolImage(tool: string): string {
  const registry = process.env.INJECT_TOOL_REGISTRY ?? REGISTRY.registry;
  const tag = process.env.INJECT_TOOL_TAG ?? REGISTRY.tag;
  return `${registry}/tools-injector/${tool}:${tag}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAvailableTools(): string[] {
  return Object.keys(REGISTRY.tools);
}

export function validateTool(tool: string): void {
  if (!REGISTRY.tools[tool]) {
    const available = Object.keys(REGISTRY.tools).sort().join(', ');
    throw new Error(`Unknown tool "${tool}". Available: ${available}`);
  }
}

export async function injectToolIntoWorkspace(
  workspaceName: string,
  tool: string,
): Promise<void> {
  validateTool(tool);

  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  const dw = await api.getNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: workspaceName,
  }) as any;

  const ops = buildInjectOps(tool, dw);
  if (ops.length === 0) return;

  await api.patchNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: workspaceName,
    body: ops,
  });
}

// ─── Patch builder ────────────────────────────────────────────────────────────

function buildInjectOps(tool: string, dw: any): JsonPatchOp[] {
  const regTool = REGISTRY.tools[tool];
  const components: any[] = dw?.spec?.template?.components ?? [];
  const ops: JsonPatchOp[] = [];

  // 1. Add shared injected-tools volume if not already present
  const hasVolume = components.some(c => c.name === 'injected-tools');
  if (!hasVolume) {
    for (const op of REGISTRY.infrastructure.patch) {
      ops.push(JSON.parse(JSON.stringify(op)));
    }
  }

  // 2. Add injector init container (with correct image tag)
  for (const op of regTool.patch) {
    const cloned: any = JSON.parse(JSON.stringify(op));
    if (cloned.op === 'add' && cloned.value?.container?.image) {
      cloned.value.container.image = toolImage(tool);
    }
    ops.push(cloned);
  }

  // 3. Find editor — first container component that is not an injector or volume
  const editorIdx = components.findIndex(
    c => c.container && !c.name.endsWith('-injector') && c.name !== 'injected-tools',
  );

  if (editorIdx === -1) return ops;

  const editorContainer = components[editorIdx].container;

  // 3a. Volume mount on editor container
  const existingMounts: any[] = editorContainer.volumeMounts ?? [];
  const hasMount = existingMounts.some(m => m.name === 'injected-tools');
  if (!hasMount) {
    for (const vm of regTool.editor.volumeMounts) {
      if (existingMounts.length > 0) {
        ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/volumeMounts/-`, value: vm });
      } else {
        ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/volumeMounts`, value: [vm] });
        existingMounts.push(vm);
      }
    }
  }

  // 3b. PATH env var so /injected-tools/bin is on $PATH
  const existingEnv: any[] = editorContainer.env ?? [];
  const hasPath = existingEnv.some(
    e => e.name === 'PATH' && (e.value as string)?.includes('/injected-tools/bin'),
  );
  const pathVar = {
    name: 'PATH',
    value: '/injected-tools/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  };
  if (!hasPath) {
    if (existingEnv.length > 0) {
      ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/env/-`, value: pathVar });
    } else {
      ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/env`, value: [pathVar] });
      existingEnv.push(pathVar);
    }
  }

  // 3c. Tool-specific env vars
  for (const envVar of regTool.editor.env) {
    if (existingEnv.length > 0) {
      ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/env/-`, value: envVar });
    } else {
      ops.push({ op: 'add', path: `/spec/template/components/${editorIdx}/container/env`, value: [envVar] });
      existingEnv.push(envVar);
    }
  }

  return ops;
}
