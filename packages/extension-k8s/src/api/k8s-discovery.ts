import type { K8sBackend } from './k8s-backend';
import type { K8sPersistData, K8sResourceType } from './k8s-types';

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

function apiPrefixForGroupVersion(groupVersion: string): string {
  return groupVersion.includes('/') ? `/apis/${groupVersion}` : `/api/${groupVersion}`;
}

function isSuccessful(res: Response): boolean {
  return res.status >= 200 && res.status < 300;
}

export async function discoverResourceTypes(
  backend: K8sBackend,
  persist: K8sPersistData,
  namespaced: boolean,
): Promise<K8sResourceType[]> {
  const groupVersions = new Set<string>();

  const coreVersionsRes = await backend.fetch(persist, '/api');
  if (isSuccessful(coreVersionsRes)) {
    const payload = (await coreVersionsRes.json()) as K8sApiVersionsResponse;
    for (const version of payload.versions ?? []) {
      const trimmed = String(version).trim();
      if (trimmed) groupVersions.add(trimmed);
    }
  }

  const apiGroupsRes = await backend.fetch(persist, '/apis');
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

  const discovered = new Map<string, K8sResourceType>();
  for (const groupVersion of groupVersions) {
    const res = await backend.fetch(persist, `${apiPrefixForGroupVersion(groupVersion)}`);
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
