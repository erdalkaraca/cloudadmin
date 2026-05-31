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
  listKubeconfigContexts,
  listKubeconfigServers,
} from './api/k8s-client';
import {
  commonNodeActions,
  contextsOf,
  createTreeContributor,
  parseContextsField,
  persistCompanionOf,
} from './k8s-contributors-common';

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
      const discovered = await listKubeconfigContexts();
      if (discovered.contexts.length > 0) {
        contexts = discovered.contexts;
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
      const discovered = await listKubeconfigContexts();
      const contexts = discovered.contexts.length > 0 ? discovered.contexts : (persist.contexts ?? ['default']);
      const context = discovered.currentContext ?? contexts[0];
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
  async (persist) => {
    try {
      const discovered = await listKubeconfigContexts();
      if (discovered.contexts.length > 0) return discovered.contexts;
    } catch {
      // Fall through to persisted contexts.
    }
    return persist.contexts ?? ['default'];
  },
);
