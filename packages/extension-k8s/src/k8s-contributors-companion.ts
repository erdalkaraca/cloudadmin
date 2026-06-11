import type {
  CloudConnection,
  CloudConnectionContributor,
  CloudConnectResult,
  CloudTreeAction,
} from 'extension-cloud/api';
import {
  PROVIDER_DISPLAY_NAME_COMPANION,
  PROVIDER_ID_COMPANION,
} from './provider';
import { k8sConnectionDialogRequired } from './k8s-connection-dialog';
import {
  listKubeconfigContextEntries,
  listKubeconfigContexts,
  listKubeconfigServers,
  type K8sPersistData,
} from './api/k8s-client';
import {
  commonNodeActions,
  contextsOf,
  createTreeContributor,
  parseContextsField,
  persistCompanionOf,
} from './k8s-contributors-common';

function normalizeServerUrl(url: string | undefined): string {
  return String(url ?? '').trim().replace(/\/$/, '');
}

function contextNamesForServer(
  persist: Pick<K8sPersistData, 'serverUrl'>,
  entries: Array<{ name: string; serverUrl?: string }>,
): string[] {
  const selectedServer = normalizeServerUrl(persist.serverUrl);
  if (!selectedServer) {
    return [...new Set(entries.map((entry) => entry.name.trim()).filter(Boolean))];
  }
  const matches = entries
    .filter((entry) => normalizeServerUrl(entry.serverUrl) === selectedServer)
    .map((entry) => entry.name.trim())
    .filter(Boolean);
  return [...new Set(matches)];
}

async function resolveContextsForPersist(persist: K8sPersistData): Promise<string[]> {
  try {
    const entries = await listKubeconfigContextEntries();
    const scoped = contextNamesForServer(persist, entries);
    if (scoped.length > 0) return scoped;
  } catch {
    // Fall back to persisted/manual values when companion context discovery fails.
  }
  return persist.contexts ?? ['default'];
}

async function connectCompanion(connection?: CloudConnection): Promise<CloudConnectResult> {
  const persist = connection ? persistCompanionOf(connection) : undefined;
  let discoveredServers: Awaited<ReturnType<typeof listKubeconfigServers>> = [];
  try {
    discoveredServers = await listKubeconfigServers();
  } catch {
    // Companion may not be running; keep form usable with manual input.
  }

  const values = await k8sConnectionDialogRequired({
    label: connection ? `Edit Kubernetes — ${connection.name}` : 'Connect Kubernetes (Companion + kubectl)',
    initialValues: {
      name: connection?.name ?? 'Kubernetes cluster',
      serverUrl: persist?.serverUrl?.trim() || discoveredServers[0]?.serverUrl || '',
      contexts: (persist?.contexts ?? (connection ? contextsOf(connection.persistData) : ['default'])).join(', '),
      token: '',
    },
    availableServers: discoveredServers,
    includeToken: false,
  });

  let contexts = parseContextsField(values.contexts, persist?.contexts);
  if (!(values.contexts ?? '').trim()) {
    try {
      const discoveredEntries = await listKubeconfigContextEntries();
      const scoped = contextNamesForServer({ serverUrl: values.serverUrl }, discoveredEntries);
      if (scoped.length > 0) {
        contexts = scoped;
      } else {
        const discovered = await listKubeconfigContexts();
        if (discovered.contexts.length > 0) {
          contexts = discovered.contexts;
        }
      }
    } catch {
      // Keep fallback contexts when discovery fails.
    }
  }

  return {
    name: values.name,
    persistData: {
      authMode: 'companion',
      serverUrl: values.serverUrl,
      contexts,
      context: contexts[0],
    },
  };
}

export const companionConnectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID_COMPANION,
  label: PROVIDER_DISPLAY_NAME_COMPANION,
  icon: 'terminal',
  getActions(node, connection): CloudTreeAction[] {
    return commonNodeActions(node, connection, persistCompanionOf);
  },
  connect: () => connectCompanion(),
  editConnection: (connection) => connectCompanion(connection),
  async restore(connection) {
    const persist = persistCompanionOf(connection);
    try {
      const contexts = await resolveContextsForPersist(persist);
      const preferred = persist.context?.trim();
      const context = preferred && contexts.includes(preferred) ? preferred : contexts[0];
      return {
        ...connection,
        persistData: {
          ...connection.persistData,
          authMode: 'companion',
          contexts,
          context,
        },
        status: 'connected' as const,
        errorMessage: undefined,
      };
    } catch {
      return {
        ...connection,
        persistData: {
          ...connection.persistData,
          authMode: 'companion',
        },
        status: 'connected' as const,
        errorMessage: 'Unable to refresh contexts from companion. Check companion/kubectl availability.',
      };
    }
  },
  async disconnect(_connectionId) {},
};

export const companionTreeContributor = createTreeContributor(
  PROVIDER_ID_COMPANION,
  persistCompanionOf,
  async (persist) => resolveContextsForPersist(persist),
);
