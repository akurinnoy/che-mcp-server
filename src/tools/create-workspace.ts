import { getCustomObjectsApi, getNamespace } from '../kube/client.js';
import { TTYD_EDITOR_TEMPLATE } from '../types.js';

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
      contributions: [
        {
          name: 'editor',
          kubernetes: { name: TTYD_EDITOR_TEMPLATE },
        },
      ],
      started: true,
      template: {
        components: [
          {
            name: 'dev',
            container: {
              image: 'quay.io/devfile/universal-developer-image:ubi8-latest',
            },
          },
        ],
      },
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
