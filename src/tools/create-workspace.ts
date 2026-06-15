import { getCustomObjectsApi, getNamespace } from '../kube/client.js';
import { AGENT_BASE_IMAGE } from '../types.js';
import { injectTool } from './inject-tool.js';

interface CreateWorkspaceParams {
  name?: string;
  image?: string;
  tools?: string[];
  node_name?: string;
  project?: {
    repo_url: string;
    ref?: string;
    commit_sha?: string;
    checkout_path?: string;
  };
  labels?: Record<string, string>;
}

function deriveProjectName(repoUrl: string): string {
  const pathname = new URL(repoUrl).pathname;
  const basename = pathname.split('/').pop() || 'project';
  return basename.replace(/\.git$/, '');
}

function buildStarterProject(project: NonNullable<CreateWorkspaceParams['project']>): Record<string, unknown> {
  const name = deriveProjectName(project.repo_url);
  const entry: Record<string, unknown> = {
    name,
    git: {
      remotes: { origin: project.repo_url },
      ...(project.ref ? { checkoutFrom: { revision: project.ref } } : {}),
    },
  };
  if (project.checkout_path) {
    entry.clonePath = project.checkout_path.replace(/^\/projects\//, '');
  }
  return entry;
}

export async function createWorkspace(params: CreateWorkspaceParams): Promise<{
  name: string;
  started: boolean;
  tools_injected: string[];
}> {
  const api = getCustomObjectsApi();
  const namespace = getNamespace();

  const metadata: Record<string, unknown> = {
    ...(params.name ? { name: params.name } : { generateName: 'empty-' }),
    annotations: {
      'controller.devfile.io/storage-type': 'ephemeral',
    },
    ...(params.labels ? { labels: params.labels } : {}),
  };

  const devComponent: Record<string, unknown> = {
    name: 'dev',
    container: {
      image: params.image || AGENT_BASE_IMAGE,
      memoryLimit: '8Gi',
      memoryRequest: '1Gi',
      cpuRequest: '500m',
      cpuLimit: '2000m',
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
  };

  if (params.node_name) {
    devComponent.attributes = {
      ...(devComponent.attributes as Record<string, unknown> || {}),
      'pod-overrides': {
        spec: {
          nodeSelector: {
            'kubernetes.io/hostname': params.node_name,
          },
        },
      },
    };
  }

  if (params.project?.commit_sha) {
    const checkoutPath = params.project.checkout_path || `/projects/${deriveProjectName(params.project.repo_url)}`;
    devComponent.attributes = {
      ...(devComponent.attributes as Record<string, unknown> || {}),
      'container-overrides': {
        lifecycle: {
          postStart: {
            exec: {
              command: ['sh', '-c', `cd ${checkoutPath} && git checkout ${params.project.commit_sha}`],
            },
          },
        },
      },
    };
  }

  const starterProjects = params.project
    ? [buildStarterProject(params.project)]
    : undefined;

  const body = {
    apiVersion: 'workspace.devfile.io/v1alpha2',
    kind: 'DevWorkspace',
    metadata,
    spec: {
      started: false,
      template: {
        ...(starterProjects ? { starterProjects } : {}),
        components: [devComponent],
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
    await injectTool({ workspace: workspaceName, tool });
    injected.push(tool);
  }

  // Start workspace after all patches applied.
  // Must use JSON patch array — @kubernetes/client-node sends application/json-patch+json,
  // which requires an array body (not a merge-patch object).
  await api.patchNamespacedCustomObject({
    group: 'workspace.devfile.io',
    version: 'v1alpha2',
    namespace,
    plural: 'devworkspaces',
    name: workspaceName,
    body: [{ op: 'replace', path: '/spec/started', value: true }],
  });

  return { name: workspaceName, started: true, tools_injected: injected };
}
