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

interface KubeconfigView {
  ['current-context']?: string;
  contexts?: Array<{
    name?: string;
    context?: {
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

export function getK8sAuth(connectionId: string): { serverUrl: string; token: string } | undefined {
  const secrets = getConnectionSecrets(connectionId);
  const token = secrets?.token;
  if (!token) return undefined;
  return { serverUrl: '', token };
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
  if (persist.authMode === 'bearer') {
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
  if (res.status === 403 && persist.authMode !== 'bearer') {
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
