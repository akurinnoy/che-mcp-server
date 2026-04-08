import { getCustomObjectsApi, getNamespace } from '../kube/client.js';
import { AGENT_BASE_IMAGE } from '../types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface CreateWorkspaceParams {
  name?: string;
  tools?: string[];
}

export async function createWorkspace(params: CreateWorkspaceParams): Promise<{
  name: string;
  started: boolean;
  tools_injected: string[];
}> {
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
      started: false,
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

  const workspaceName: string = (result as any).metadata.name;
  const toolsToInject = params.tools ?? [];
  const injected: string[] = [];

  for (const tool of toolsToInject) {
    try {
      await execFileAsync('inject-tool', [tool, workspaceName], { timeout: 30_000 });
      injected.push(tool);
    } catch (err: any) {
      throw new Error(`Failed to inject tool "${tool}" into workspace "${workspaceName}": ${err.message}`);
    }
  }

  // Start workspace after all patches applied
  await api.patchNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: workspaceName,
    body: { spec: { started: true } },
  });

  return { name: workspaceName, started: true, tools_injected: injected };
}
