import { getConnectionSecrets } from 'extension-cloud/api';

export interface K8sPersistData {
  serverUrl: string;
  /** @deprecated Prefer {@link contexts}. */
  context?: string;
  /** Kubeconfig-style context names shown as scope nodes under the connection. */
  contexts?: string[];
}

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getK8sAuth(connectionId: string): { serverUrl: string; token: string } | undefined {
  const secrets = getConnectionSecrets(connectionId);
  const token = secrets?.token;
  if (!token) return undefined;
  return { serverUrl: '', token };
}

export async function k8sFetch(
  connectionId: string,
  persist: K8sPersistData,
  path: string,
): Promise<Response> {
  const secrets = getConnectionSecrets(connectionId);
  const token = secrets?.token;
  if (!token) throw new Error('Kubernetes credentials not in session. Reconnect the cluster.');
  const base = normalizeServerUrl(persist.serverUrl);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

export async function validateK8sCredentials(
  persist: K8sPersistData,
  token: string,
): Promise<void> {
  const base = normalizeServerUrl(persist.serverUrl);
  const res = await fetch(`${base}/api/v1/namespaces?limit=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kubernetes API error ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function testK8sConnection(
  connectionId: string,
  persist: K8sPersistData,
): Promise<void> {
  const res = await k8sFetch(connectionId, persist, '/api/v1/namespaces?limit=1');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kubernetes API error ${res.status}: ${body.slice(0, 200)}`);
  }
}

interface K8sList<T> {
  items: T[];
}

interface K8sObjectMeta {
  name: string;
  namespace?: string;
  uid: string;
}

export async function listNamespaces(
  connectionId: string,
  persist: K8sPersistData,
): Promise<Array<{ name: string; uid: string }>> {
  const res = await k8sFetch(connectionId, persist, '/api/v1/namespaces');
  if (!res.ok) throw new Error(`list namespaces: ${res.status}`);
  const data = (await res.json()) as K8sList<{ metadata: K8sObjectMeta }>;
  return data.items.map((i) => ({ name: i.metadata.name, uid: i.metadata.uid }));
}

export interface ListedPod {
  name: string;
  uid: string;
  phase?: string;
  containers: string[];
}

export async function listPods(
  connectionId: string,
  persist: K8sPersistData,
  namespace: string,
): Promise<ListedPod[]> {
  const res = await k8sFetch(
    connectionId,
    persist,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`,
  );
  if (!res.ok) throw new Error(`list pods: ${res.status}`);
  const data = (await res.json()) as K8sList<{
    metadata: K8sObjectMeta;
    spec?: {
      containers?: Array<{ name: string }>;
      initContainers?: Array<{ name: string }>;
    };
    status?: {
      phase?: string;
      containerStatuses?: Array<{ name: string }>;
      initContainerStatuses?: Array<{ name: string }>;
    };
  }>;
  return data.items.map((i) => {
    const fromSpec = [
      ...(i.spec?.initContainers?.map((c) => c.name) ?? []),
      ...(i.spec?.containers?.map((c) => c.name) ?? []),
    ];
    const fromStatus = [
      ...(i.status?.initContainerStatuses?.map((s) => s.name) ?? []),
      ...(i.status?.containerStatuses?.map((s) => s.name) ?? []),
    ];
    const containers = [...new Set([...fromSpec, ...fromStatus].filter(Boolean))];
    return {
      name: i.metadata.name,
      uid: i.metadata.uid,
      phase: i.status?.phase,
      containers,
    };
  });
}

export async function getPod(
  connectionId: string,
  persist: K8sPersistData,
  namespace: string,
  podName: string,
): Promise<unknown> {
  const res = await k8sFetch(
    connectionId,
    persist,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}`,
  );
  if (!res.ok) throw new Error(`get pod: ${res.status}`);
  return res.json();
}

export async function getPodLogs(
  connectionId: string,
  persist: K8sPersistData,
  namespace: string,
  podName: string,
  options?: { tailLines?: number; container?: string },
): Promise<string> {
  const tailLines = options?.tailLines ?? 500;
  const query = new URLSearchParams({ tailLines: String(tailLines) });
  if (options?.container) query.set('container', options.container);
  const res = await k8sFetch(
    connectionId,
    persist,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?${query}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`pod logs: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.text();
}
