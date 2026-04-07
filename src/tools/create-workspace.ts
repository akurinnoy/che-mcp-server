import { getCustomObjectsApi, getNamespace } from '../kube/client.js';
import { AGENT_BASE_IMAGE } from '../types.js';

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
      template: {
        components: [
          {
            name: 'dev',
            container: {
              image: AGENT_BASE_IMAGE,
              endpoints: [
                {
                  name: 'ttyd-terminal',
                  targetPort: 7681,
                  exposure: 'public',
                  protocol: 'https',
                  attributes: {
                    type: 'main',
                    cookiesAuthEnabled: true,
                    discoverable: false,
                    urlRewriteSupported: true,
                  },
                },
              ],
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
