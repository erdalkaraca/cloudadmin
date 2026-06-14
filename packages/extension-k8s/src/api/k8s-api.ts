import type { K8sBackend } from './k8s-backend';
import type {
  ClusterObjectEntry,
  ClusterResourceType,
  ListedPod,
  NamespacedObjectEntry,
  NamespacedResourceType,
  K8sPersistData,
} from './k8s-types';

interface K8sList<T> {
  items: T[];
}

interface K8sObjectMeta {
  name: string;
  namespace?: string;
  uid: string;
}

function apiPrefixForGroupVersion(groupVersion: string): string {
  return groupVersion.includes('/') ? `/apis/${groupVersion}` : `/api/${groupVersion}`;
}

export async function listNamespacedResourceTypes(
  backend: K8sBackend,
  persist: K8sPersistData,
): Promise<NamespacedResourceType[]> {
  return (await backend.listResourceTypes(persist, true)) as NamespacedResourceType[];
}

export async function listClusterResourceTypes(
  backend: K8sBackend,
  persist: K8sPersistData,
): Promise<ClusterResourceType[]> {
  return (await backend.listResourceTypes(persist, false)) as ClusterResourceType[];
}

export async function listNamespaces(
  backend: K8sBackend,
  persist: K8sPersistData,
): Promise<Array<{ name: string; uid: string }>> {
  return backend.listNamespaces(persist);
}

export async function listNamespacedObjects(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespace: string,
  resourceType: NamespacedResourceType,
): Promise<NamespacedObjectEntry[]> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(resourceType.resourceName)}`;
  const res = await backend.fetch(persist, path);
  if (res.status === 403 || res.status === 404) return [];
  if (!res.ok) throw new Error(`list ${resourceType.resourceName}: ${res.status}`);

  const payload = (await res.json()) as K8sList<{ metadata?: K8sObjectMeta }>;
  return (payload.items ?? [])
    .map((item) => ({
      name: String(item.metadata?.name ?? '').trim(),
      uid: String(item.metadata?.uid ?? '').trim(),
      kind: resourceType.kind,
    }))
    .filter((item) => Boolean(item.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getNamespacedObject(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespace: string,
  resourceType: NamespacedResourceType,
  objectName: string,
): Promise<unknown> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(resourceType.resourceName)}/${encodeURIComponent(objectName)}`;
  const res = await backend.fetch(persist, path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`get ${resourceType.resourceName}/${objectName}: ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listClusterObjects(
  backend: K8sBackend,
  persist: K8sPersistData,
  resourceType: ClusterResourceType,
): Promise<ClusterObjectEntry[]> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/${encodeURIComponent(resourceType.resourceName)}`;
  const res = await backend.fetch(persist, path);
  if (res.status === 403 || res.status === 404) return [];
  if (!res.ok) throw new Error(`list ${resourceType.resourceName}: ${res.status}`);

  const payload = (await res.json()) as K8sList<{ metadata?: K8sObjectMeta }>;
  return (payload.items ?? [])
    .map((item) => ({
      name: String(item.metadata?.name ?? '').trim(),
      uid: String(item.metadata?.uid ?? '').trim(),
      kind: resourceType.kind,
    }))
    .filter((item) => Boolean(item.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClusterObject(
  backend: K8sBackend,
  persist: K8sPersistData,
  resourceType: ClusterResourceType,
  objectName: string,
): Promise<unknown> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/${encodeURIComponent(resourceType.resourceName)}/${encodeURIComponent(objectName)}`;
  const res = await backend.fetch(persist, path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`get ${resourceType.resourceName}/${objectName}: ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listPods(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespace: string,
): Promise<ListedPod[]> {
  const res = await backend.fetch(
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
  return data.items.map((item) => {
    const fromSpec = [
      ...(item.spec?.initContainers?.map((container) => container.name) ?? []),
      ...(item.spec?.containers?.map((container) => container.name) ?? []),
    ];
    const fromStatus = [
      ...(item.status?.initContainerStatuses?.map((status) => status.name) ?? []),
      ...(item.status?.containerStatuses?.map((status) => status.name) ?? []),
    ];
    const containers = [...new Set([...fromSpec, ...fromStatus].filter(Boolean))];
    return {
      name: item.metadata.name,
      uid: item.metadata.uid,
      phase: item.status?.phase,
      containers,
    };
  });
}

export async function getPod(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespace: string,
  podName: string,
): Promise<unknown> {
  const res = await backend.fetch(
    persist,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}`,
  );
  if (!res.ok) throw new Error(`get pod: ${res.status}`);
  return res.json();
}

export async function getPodLogs(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespace: string,
  podName: string,
  options?: { tailLines?: number; container?: string },
): Promise<string> {
  const tailLines = options?.tailLines ?? 500;
  const query = new URLSearchParams({ tailLines: String(tailLines) });
  if (options?.container) query.set('container', options.container);
  const res = await backend.fetch(
    persist,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?${query}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`pod logs: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.text();
}
