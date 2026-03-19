import { getCustomObjectsApi, getNamespace } from '../kube/client.js';
import { AGENT_ANNOTATION_PREFIX } from '../types.js';
import type { WorkspaceInfo } from '../types.js';

export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  const response = await api.listNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
  });

  const items = (response as any).items || [];

  return items.map((dw: any) => {
    const allAnnotations: Record<string, string> = dw.metadata?.annotations || {};
    const agentAnnotations: Record<string, string> = {};
    for (const [key, value] of Object.entries(allAnnotations)) {
      if (key.startsWith(AGENT_ANNOTATION_PREFIX)) {
        agentAnnotations[key] = value;
      }
    }

    return {
      name: dw.metadata?.name || '',
      phase: dw.status?.phase || 'Unknown',
      url: dw.status?.mainUrl || '',
      annotations: agentAnnotations,
    };
  });
}
