import * as k8s from '@kubernetes/client-node';

let kubeConfig: k8s.KubeConfig;
let namespace: string;
let customObjectsApi: k8s.CustomObjectsApi;
let coreV1Api: k8s.CoreV1Api;

export function initKubeClient(): void {
  kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromDefault();

  const context = kubeConfig.getContextObject(kubeConfig.getCurrentContext());
  namespace = context?.namespace
    || process.env.CHE_MCP_NAMESPACE
    || '';

  if (!namespace) {
    throw new Error(
      'Cannot determine namespace. Set namespace in kubeconfig context or CHE_MCP_NAMESPACE env var.'
    );
  }

  customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
  coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
}

export function getNamespace(): string {
  return namespace;
}

export function getCustomObjectsApi(): k8s.CustomObjectsApi {
  return customObjectsApi;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  return coreV1Api;
}

export function getKubeConfig(): k8s.KubeConfig {
  return kubeConfig;
}
