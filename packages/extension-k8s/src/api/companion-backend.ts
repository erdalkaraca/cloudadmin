import { CompanionClient } from 'extension-companion/api';
import {
  ensureCompanionK8sSetup,
  inferNamespacesFromKubeconfig,
  K8S_REQUESTER,
} from './companion-kubectl';
import { discoverResourceTypes } from './k8s-discovery';
import type { K8sBackend } from './k8s-backend';
import type {
  K8sAuthMode,
  K8sNamespaceEntry,
  K8sPersistData,
  K8sResourceType,
} from './k8s-types';

interface K8sApiResourceList {
  groupVersion?: string;
  resources?: Array<{
    name?: string;
    kind?: string;
    version?: string;
  }>;
}

const resourceTypeDiscoveryCache = new Map<string, Promise<K8sResourceType[]>>();

function resourceDiscoveryCacheKey(persist: K8sPersistData, namespaced: boolean): string {
  return [
    'companion',
    persist.serverUrl.trim(),
    persist.context?.trim() ?? '',
    namespaced ? 'namespaced' : 'cluster',
  ].join('::');
}

async function listResourceTypesViaKubectl(
  persist: K8sPersistData,
  namespaced: boolean,
): Promise<K8sResourceType[]> {
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
  const discovered = new Map<string, K8sResourceType>();
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

export class CompanionK8sBackend implements K8sBackend {
  readonly mode: K8sAuthMode = 'companion';

  async fetch(persist: K8sPersistData, path: string, init?: RequestInit): Promise<Response> {
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

  async testConnection(persist: K8sPersistData): Promise<void> {
    const res = await this.fetch(persist, '/version');
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Kubernetes API error ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  async listNamespaces(persist: K8sPersistData): Promise<K8sNamespaceEntry[]> {
    const res = await this.fetch(persist, '/api/v1/namespaces');
    if (res.status === 403) {
      return inferNamespacesFromKubeconfig(persist.context);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`list namespaces: ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { items: Array<{ metadata: { name: string; uid: string } }> };
    return data.items.map((item) => ({ name: item.metadata.name, uid: item.metadata.uid }));
  }

  async listResourceTypes(persist: K8sPersistData, namespaced: boolean): Promise<K8sResourceType[]> {
    const cacheKey = resourceDiscoveryCacheKey(persist, namespaced);
    const cached = resourceTypeDiscoveryCache.get(cacheKey);
    if (cached) return cached;

    const pending = (async () => {
      try {
        return await listResourceTypesViaKubectl(persist, namespaced);
      } catch {
        return discoverResourceTypes(this, persist, namespaced);
      }
    })();

    resourceTypeDiscoveryCache.set(cacheKey, pending);
    try {
      return await pending;
    } catch (error) {
      resourceTypeDiscoveryCache.delete(cacheKey);
      throw error;
    }
  }

  supportsConsole(): boolean {
    return true;
  }
}
