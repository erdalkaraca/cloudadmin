import { getConnectionSecrets } from 'extension-cloud/api';
import { CompanionClient } from 'extension-companion/api';

const K8S_REQUESTER = 'extension-k8s';

export type K8sAuthMode = 'companion' | 'bearer';

let companionInitPromise: Promise<void> | undefined;

async function fetchStableKubectlVersion(): Promise<string> {
  const res = await fetch('https://dl.k8s.io/release/stable.txt');
  if (!res.ok) throw new Error(`stable kubectl lookup failed: ${res.status}`);
  const version = (await res.text()).trim();
  if (!version) throw new Error('stable kubectl lookup returned empty version');
  return version;
}

async function ensureCompanionK8sSetup(): Promise<void> {
  if (!companionInitPromise) {
    companionInitPromise = (async () => {
      const companion = new CompanionClient();
      const stableVersion = await fetchStableKubectlVersion();
      await companion.installTool({
        requester: K8S_REQUESTER,
        tool: 'kubectl',
        version: stableVersion,
      });
    })().catch((error) => {
      companionInitPromise = undefined;
      throw error;
    });
  }
  await companionInitPromise;
}

export interface K8sPersistData {
  serverUrl: string;
  authMode?: K8sAuthMode;
  /** @deprecated Prefer {@link contexts}. */
  context?: string;
  /** Kubeconfig-style context names shown as scope nodes under the connection. */
  contexts?: string[];
  /** Manually added namespaces keyed by kube context. */
  manualNamespacesByContext?: Record<string, string[]>;
}

export interface KubeconfigServerEntry {
  name: string;
  serverUrl: string;
}

export interface KubeconfigContextEntry {
  name: string;
  serverUrl?: string;
  namespace?: string;
}

interface KubeconfigView {
  ['current-context']?: string;
  contexts?: Array<{
    name?: string;
    context?: {
      cluster?: string;
      namespace?: string;
    };
  }>;
  clusters?: Array<{ name?: string; cluster?: { server?: string } }>;
}

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

async function fetchViaCompanion(
  persist: K8sPersistData,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? {});
  const body = typeof init?.body === 'string' ? init.body : undefined;
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const proxied = await companion.proxyKubernetes({
    requester: K8S_REQUESTER,
    context: persist.context,
    method,
    path,
    headers: Object.fromEntries(headers.entries()),
    body,
  });
  const responseHeaders = new Headers();
  if (proxied.contentType) {
    responseHeaders.set('Content-Type', proxied.contentType);
  }
  return new Response(proxied.body, { status: proxied.status, headers: responseHeaders });
}

export async function listKubeconfigContexts(
  kubeconfigPath?: string,
): Promise<{ contexts: string[]; currentContext?: string }> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const contextsResult = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'get-contexts', '-o', 'name'],
    env,
  });
  if (contextsResult.exitCode !== 0) {
    return inferContextsFromKubeconfig(companion, env);
  }

  const currentResult = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'current-context'],
    env,
  });
  if (currentResult.exitCode !== 0) {
    return inferContextsFromKubeconfig(companion, env);
  }

  const contexts = contextsResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const currentContext = currentResult.stdout.trim() || undefined;
  return { contexts: [...new Set(contexts)], currentContext };
}

async function inferContextsFromKubeconfig(
  companion: CompanionClient,
  env?: Record<string, string>,
): Promise<{ contexts: string[]; currentContext?: string }> {
  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const contexts = (parsed.contexts ?? [])
    .map((entry) => entry.name?.trim())
    .filter((value): value is string => Boolean(value));
  const currentContext = parsed['current-context']?.trim() || undefined;
  return { contexts: [...new Set(contexts)], currentContext };
}

export async function listKubeconfigServers(
  kubeconfigPath?: string,
): Promise<KubeconfigServerEntry[]> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const seen = new Set<string>();
  const entries: KubeconfigServerEntry[] = [];
  for (const entry of parsed.clusters ?? []) {
    const serverUrl = entry.cluster?.server?.trim();
    if (!serverUrl) continue;
    const name = entry.name?.trim() || serverUrl;
    const dedupeKey = `${name}::${serverUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push({ name, serverUrl });
  }
  return entries;
}

export async function listKubeconfigContextEntries(
  kubeconfigPath?: string,
): Promise<KubeconfigContextEntry[]> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const clusterByName = new Map<string, string>();
  for (const cluster of parsed.clusters ?? []) {
    const name = cluster.name?.trim();
    const serverUrl = cluster.cluster?.server?.trim();
    if (!name || !serverUrl) continue;
    clusterByName.set(name, serverUrl);
  }

  const entries: KubeconfigContextEntry[] = [];
  for (const context of parsed.contexts ?? []) {
    const name = context.name?.trim();
    if (!name) continue;
    const clusterName = context.context?.cluster?.trim();
    entries.push({
      name,
      namespace: context.context?.namespace?.trim() || undefined,
      serverUrl: clusterName ? clusterByName.get(clusterName) : undefined,
    });
  }

  return entries;
}

export function getK8sAuth(connectionId: string): { serverUrl: string; token: string } | undefined {
  const secrets = getConnectionSecrets(connectionId);
  const token = secrets?.token;
  if (!token) return undefined;
  return { serverUrl: '', token };
}

function usesBearerAuth(connectionId: string, persist: K8sPersistData): boolean {
  if (persist.authMode === 'bearer') return true;
  if (persist.authMode === 'companion') return false;
  const token = getConnectionSecrets(connectionId)?.token?.trim();
  return Boolean(token && normalizeServerUrl(persist.serverUrl));
}

function fetchViaBearerToken(
  connectionId: string,
  persist: K8sPersistData,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = normalizeServerUrl(persist.serverUrl);
  if (!base) throw new Error('API server URL is required for bearer-token connections.');
  const auth = getK8sAuth(connectionId);
  if (!auth?.token) throw new Error('Missing bearer token for Kubernetes connection.');
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${auth.token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const target = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  return fetch(target, {
    ...init,
    headers,
  });
}

export async function k8sFetch(
  connectionId: string,
  persist: K8sPersistData,
  path: string,
): Promise<Response> {
  if (usesBearerAuth(connectionId, persist)) {
    return fetchViaBearerToken(connectionId, persist, path);
  }
  return fetchViaCompanion(persist, path);
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
  const res = await k8sFetch(connectionId, persist, '/version');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kubernetes API error ${res.status}: ${body.slice(0, 200)}`);
  }
}

interface K8sList<T> {
  items: T[];
}

interface K8sApiVersionsResponse {
  versions?: string[];
}

interface K8sApiGroupsResponse {
  groups?: Array<{
    versions?: Array<{ groupVersion?: string }>;
    preferredVersion?: { groupVersion?: string };
  }>;
}

interface K8sApiResourceList {
  groupVersion?: string;
  resources?: Array<{
    name?: string;
    kind?: string;
    namespaced?: boolean;
    verbs?: string[];
    version?: string;
  }>;
}

interface K8sObjectMeta {
  name: string;
  namespace?: string;
  uid: string;
}

export interface NamespacedResourceType {
  groupVersion: string;
  resourceName: string;
  kind: string;
}

export interface ClusterResourceType {
  groupVersion: string;
  resourceName: string;
  kind: string;
}

export interface NamespacedObjectEntry {
  name: string;
  uid: string;
  kind: string;
}

export interface ClusterObjectEntry {
  name: string;
  uid: string;
  kind: string;
}

const resourceTypeDiscoveryCache = new Map<string, Promise<Array<NamespacedResourceType | ClusterResourceType>>>();

function apiPrefixForGroupVersion(groupVersion: string): string {
  return groupVersion.includes('/') ? `/apis/${groupVersion}` : `/api/${groupVersion}`;
}

function isSuccessful(res: Response): boolean {
  return res.status >= 200 && res.status < 300;
}

function resourceDiscoveryCacheKey(
  connectionId: string,
  persist: K8sPersistData,
  namespaced: boolean,
): string {
  return [
    usesBearerAuth(connectionId, persist) ? 'bearer' : 'companion',
    persist.serverUrl.trim(),
    persist.context?.trim() ?? '',
    namespaced ? 'namespaced' : 'cluster',
  ].join('::');
}

async function listResourceTypesViaCompanion(
  persist: K8sPersistData,
  namespaced: boolean,
): Promise<Array<NamespacedResourceType | ClusterResourceType>> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const args = [
    'api-resources',
    '--verbs=list',
    '--cached=false',
    `--namespaced=${namespaced ? 'true' : 'false'}`,
    '-o',
    'json',
  ];
  const context = persist.context?.trim();
  if (context) {
    args.push('--context', context);
  }

  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl api-resources failed: ${result.stderr || result.exitCode}`);
  }

  const payload = JSON.parse(result.stdout) as K8sApiResourceList;
  const discovered = new Map<string, NamespacedResourceType | ClusterResourceType>();
  for (const resource of payload.resources ?? []) {
    const resourceName = resource.name?.trim();
    const kind = resource.kind?.trim();
    const version = resource.version?.trim();
    if (!resourceName || !kind || !version) continue;
    if (resourceName.includes('/')) continue;

    const groupVersion = payload.groupVersion?.trim()
      ? payload.groupVersion.trim()
      : version;
    const key = `${groupVersion}::${resourceName}`;
    discovered.set(key, { groupVersion, resourceName, kind });
  }

  return [...discovered.values()].sort((a, b) => {
    if (a.groupVersion !== b.groupVersion) return a.groupVersion.localeCompare(b.groupVersion);
    return a.resourceName.localeCompare(b.resourceName);
  });
}

async function listResourceTypesViaDiscovery(
  connectionId: string,
  persist: K8sPersistData,
  namespaced: boolean,
): Promise<Array<NamespacedResourceType | ClusterResourceType>> {
  const groupVersions = new Set<string>();

  const coreVersionsRes = await k8sFetch(connectionId, persist, '/api');
  if (isSuccessful(coreVersionsRes)) {
    const payload = (await coreVersionsRes.json()) as K8sApiVersionsResponse;
    for (const version of payload.versions ?? []) {
      const trimmed = String(version).trim();
      if (trimmed) groupVersions.add(trimmed);
    }
  }

  const apiGroupsRes = await k8sFetch(connectionId, persist, '/apis');
  if (isSuccessful(apiGroupsRes)) {
    const payload = (await apiGroupsRes.json()) as K8sApiGroupsResponse;
    for (const group of payload.groups ?? []) {
      const preferred = group.preferredVersion?.groupVersion?.trim();
      if (preferred) {
        groupVersions.add(preferred);
        continue;
      }
      for (const version of group.versions ?? []) {
        const groupVersion = version.groupVersion?.trim();
        if (groupVersion) groupVersions.add(groupVersion);
      }
    }
  }

  const discovered = new Map<string, NamespacedResourceType | ClusterResourceType>();
  for (const groupVersion of groupVersions) {
    const res = await k8sFetch(connectionId, persist, `${apiPrefixForGroupVersion(groupVersion)}`);
    if (!isSuccessful(res)) {
      continue;
    }

    const payload = (await res.json()) as K8sApiResourceList;
    for (const resource of payload.resources ?? []) {
      const resourceName = resource.name?.trim();
      const kind = resource.kind?.trim();
      const resourceNamespaced = resource.namespaced === true;
      const supportsList = (resource.verbs ?? []).includes('list');
      if (!resourceName || !kind || resourceNamespaced !== namespaced || !supportsList) continue;
      if (resourceName.includes('/')) continue;

      const key = `${groupVersion}::${resourceName}`;
      discovered.set(key, { groupVersion, resourceName, kind });
    }
  }

  return [...discovered.values()].sort((a, b) => {
    if (a.groupVersion !== b.groupVersion) return a.groupVersion.localeCompare(b.groupVersion);
    return a.resourceName.localeCompare(b.resourceName);
  });
}

async function listResourceTypes(
  connectionId: string,
  persist: K8sPersistData,
  namespaced: boolean,
): Promise<Array<NamespacedResourceType | ClusterResourceType>> {
  const cacheKey = resourceDiscoveryCacheKey(connectionId, persist, namespaced);
  const cached = resourceTypeDiscoveryCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    if (!usesBearerAuth(connectionId, persist)) {
      try {
        return await listResourceTypesViaCompanion(persist, namespaced);
      } catch {
        // Fall back to API discovery when kubectl-based discovery is unavailable.
      }
    }
    return listResourceTypesViaDiscovery(connectionId, persist, namespaced);
  })();

  resourceTypeDiscoveryCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    resourceTypeDiscoveryCache.delete(cacheKey);
    throw error;
  }
}

export async function listNamespacedResourceTypes(
  connectionId: string,
  persist: K8sPersistData,
): Promise<NamespacedResourceType[]> {
  return (await listResourceTypes(connectionId, persist, true)) as NamespacedResourceType[];
}

export async function listClusterResourceTypes(
  connectionId: string,
  persist: K8sPersistData,
): Promise<ClusterResourceType[]> {
  return (await listResourceTypes(connectionId, persist, false)) as ClusterResourceType[];
}

export async function listNamespacedObjects(
  connectionId: string,
  persist: K8sPersistData,
  namespace: string,
  resourceType: NamespacedResourceType,
): Promise<NamespacedObjectEntry[]> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(resourceType.resourceName)}`;
  const res = await k8sFetch(connectionId, persist, path);
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
  connectionId: string,
  persist: K8sPersistData,
  namespace: string,
  resourceType: NamespacedResourceType,
  objectName: string,
): Promise<unknown> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(resourceType.resourceName)}/${encodeURIComponent(objectName)}`;
  const res = await k8sFetch(connectionId, persist, path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`get ${resourceType.resourceName}/${objectName}: ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listClusterObjects(
  connectionId: string,
  persist: K8sPersistData,
  resourceType: ClusterResourceType,
): Promise<ClusterObjectEntry[]> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/${encodeURIComponent(resourceType.resourceName)}`;
  const res = await k8sFetch(connectionId, persist, path);
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
  connectionId: string,
  persist: K8sPersistData,
  resourceType: ClusterResourceType,
  objectName: string,
): Promise<unknown> {
  const prefix = apiPrefixForGroupVersion(resourceType.groupVersion);
  const path = `${prefix}/${encodeURIComponent(resourceType.resourceName)}/${encodeURIComponent(objectName)}`;
  const res = await k8sFetch(connectionId, persist, path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`get ${resourceType.resourceName}/${objectName}: ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listNamespaces(
  connectionId: string,
  persist: K8sPersistData,
): Promise<Array<{ name: string; uid: string }>> {
  const res = await k8sFetch(connectionId, persist, '/api/v1/namespaces');
  if (res.status === 403 && !usesBearerAuth(connectionId, persist)) {
    return await inferNamespacesFromKubeconfig(persist);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`list namespaces: ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as K8sList<{ metadata: K8sObjectMeta }>;
  return data.items.map((i) => ({ name: i.metadata.name, uid: i.metadata.uid }));
}

async function inferNamespacesFromKubeconfig(
  persist: K8sPersistData,
): Promise<Array<{ name: string; uid: string }>> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
  });
  if (result.exitCode !== 0) {
    return [];
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const wantedContext = persist.context?.trim();
  const currentContext = parsed['current-context']?.trim();
  const selected = wantedContext || currentContext;

  const fromSelected = (parsed.contexts ?? [])
    .filter((entry) => (selected ? entry.name?.trim() === selected : false))
    .map((entry) => entry.context?.namespace?.trim())
    .filter((value): value is string => Boolean(value));

  const fromAll = (parsed.contexts ?? [])
    .map((entry) => entry.context?.namespace?.trim())
    .filter((value): value is string => Boolean(value));

  const namespaces = [...new Set([...(fromSelected.length > 0 ? fromSelected : fromAll), 'default'])];
  return namespaces.map((name) => ({ name, uid: `inferred:${name}` }));
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
