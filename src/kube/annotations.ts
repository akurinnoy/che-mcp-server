import { getCustomObjectsApi, getNamespace } from './client.js';
import { ANN_SESSION, ANN_TYPE, ANN_TASK, ANN_LAUNCHED } from '../types.js';

export interface AgentAnnotationValues {
  session: string | null;
  agent_type: string | null;
  task: string | null;
  launched_at: string | null;
}

const DW_GROUP   = 'workspace.devfile.io';
const DW_VERSION = 'v1alpha2';
const DW_PLURAL  = 'devworkspaces';

export async function readAgentAnnotations(workspace: string): Promise<AgentAnnotationValues> {
  const api = getCustomObjectsApi();
  const ns  = getNamespace();

  const dw = await api.getNamespacedCustomObject({
    group: DW_GROUP, version: DW_VERSION, namespace: ns, plural: DW_PLURAL, name: workspace,
  }) as any;

  const ann: Record<string, string> = dw.metadata?.annotations ?? {};

  return {
    session:     ann[ANN_SESSION]  ?? null,
    agent_type:  ann[ANN_TYPE]     ?? null,
    task:        ann[ANN_TASK]     ?? null,
    launched_at: ann[ANN_LAUNCHED] ?? null,
  };
}

export async function writeAgentAnnotations(
  workspace: string,
  values: AgentAnnotationValues,
): Promise<void> {
  const api = getCustomObjectsApi();
  const ns  = getNamespace();

  const annotations: Record<string, string | null> = {
    [ANN_SESSION]:  values.session,
    [ANN_TYPE]:     values.agent_type,
    [ANN_TASK]:     values.task,
    [ANN_LAUNCHED]: values.launched_at,
  };

  await api.patchNamespacedCustomObject({
    group: DW_GROUP, version: DW_VERSION, namespace: ns, plural: DW_PLURAL, name: workspace,
    body: { metadata: { annotations } },
  });
}

export async function clearAgentAnnotations(workspace: string): Promise<void> {
  await writeAgentAnnotations(workspace, {
    session: null, agent_type: null, task: null, launched_at: null,
  });
}
