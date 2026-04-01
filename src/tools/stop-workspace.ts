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
