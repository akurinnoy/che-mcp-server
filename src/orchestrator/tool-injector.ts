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

  // Deep-copy current components, mutate in memory, patch back as merge patch.
  // Avoids JSON Patch content-type issues — merge patch replaces the array.
  const components: any[] = JSON.parse(
    JSON.stringify(dw?.spec?.template?.components ?? []),
  );

  applyToolToComponents(tool, components);

  await api.patchNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: workspaceName,
    body: { spec: { template: { components } } },
  });
}

// ─── In-memory mutation ───────────────────────────────────────────────────────

export function applyToolToComponents(tool: string, components: any[]): void {
  const regTool = REGISTRY.tools[tool];

  // 1. Add shared injected-tools volume if not already present
  const hasVolume = components.some(c => c.name === 'injected-tools');
  if (!hasVolume) {
    for (const op of REGISTRY.infrastructure.patch) {
      if (op.op === 'add') components.push(JSON.parse(JSON.stringify(op.value)));
    }
  }

  // 2. Add injector init container (with correct image tag)
  for (const op of regTool.patch) {
    if (op.op === 'add') {
      const value: any = JSON.parse(JSON.stringify(op.value));
      if (value?.container?.image) value.container.image = toolImage(tool);
      components.push(value);
    }
  }

  // 3. Find editor — first container component that is not an injector or volume
  const editor = components.find(
    c => c.container && !c.name.endsWith('-injector') && c.name !== 'injected-tools',
  );
  if (!editor) return;

  const container = editor.container;

  // 3a. Volume mount
  if (!container.volumeMounts) container.volumeMounts = [];
  const hasMount = container.volumeMounts.some((m: any) => m.name === 'injected-tools');
  if (!hasMount) {
    for (const vm of regTool.editor.volumeMounts) {
      container.volumeMounts.push(vm);
    }
  }

  // 3b. PATH env var so /injected-tools/bin is discoverable
  if (!container.env) container.env = [];
  const hasPath = container.env.some(
    (e: any) => e.name === 'PATH' && (e.value as string)?.includes('/injected-tools/bin'),
  );
  if (!hasPath) {
    container.env.push({
      name: 'PATH',
      value: '/injected-tools/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    });
  }

  // 3c. Tool-specific env vars
  for (const envVar of regTool.editor.env) {
    container.env.push(envVar);
  }
}
