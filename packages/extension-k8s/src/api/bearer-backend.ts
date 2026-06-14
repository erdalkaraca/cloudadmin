import { getConnectionSecrets } from 'extension-cloud/api';
import { discoverResourceTypes } from './k8s-discovery';
import type { K8sBackend } from './k8s-backend';
import type {
  K8sAuthMode,
  K8sNamespaceEntry,
  K8sPersistData,
  K8sResourceType,
} from './k8s-types';

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
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

export class BearerK8sBackend implements K8sBackend {
  readonly mode: K8sAuthMode = 'bearer';

  constructor(private readonly connectionId: string) {}

  fetch(persist: K8sPersistData, path: string, init?: RequestInit): Promise<Response> {
    const base = normalizeServerUrl(persist.serverUrl);
    if (!base) throw new Error('API server URL is required for bearer-token connections.');

    const token = getConnectionSecrets(this.connectionId)?.token?.trim();
    if (!token) throw new Error('Missing bearer token for Kubernetes connection.');

    const headers = new Headers(init?.headers ?? {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
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

  async testConnection(persist: K8sPersistData): Promise<void> {
    const res = await this.fetch(persist, '/version');
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Kubernetes API error ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  async listNamespaces(persist: K8sPersistData): Promise<K8sNamespaceEntry[]> {
    const res = await this.fetch(persist, '/api/v1/namespaces');
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`list namespaces: ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { items: Array<{ metadata: { name: string; uid: string } }> };
    return data.items.map((item) => ({ name: item.metadata.name, uid: item.metadata.uid }));
  }

  async listResourceTypes(persist: K8sPersistData, namespaced: boolean): Promise<K8sResourceType[]> {
    return discoverResourceTypes(this, persist, namespaced);
  }

  supportsConsole(): boolean {
    return false;
  }
}
