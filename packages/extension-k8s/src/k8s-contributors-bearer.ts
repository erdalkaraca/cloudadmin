import {
  getConnectionSecrets,
  type CloudConnection,
  type CloudConnectionContributor,
  type CloudConnectResult,
  type CloudTreeAction,
} from 'extension-cloud/api';
import {
  PROVIDER_DISPLAY_NAME_BEARER,
  PROVIDER_ID_BEARER,
} from './provider';
import { k8sConnectionDialogRequired } from './k8s-connection-dialog';
import {
  type K8sPersistData,
  validateK8sCredentials,
} from './api/k8s-client';
import { createK8sBackend } from './api/k8s-backend';
import {
  commonNodeActions,
  contextsOf,
  createTreeContributor,
  parseContextsField,
  persistBearerOf,
} from './k8s-contributors-common';

async function connectBearer(connection?: CloudConnection): Promise<CloudConnectResult> {
  const persist = connection ? persistBearerOf(connection) : undefined;
  const values = await k8sConnectionDialogRequired({
    label: connection
      ? `Edit Kubernetes — ${connection.name}`
      : 'Connect Kubernetes (JS API + Bearer Token)',
    initialValues: {
      name: connection?.name ?? 'Kubernetes API',
      serverUrl: persist?.serverUrl?.trim() ?? '',
      contexts: (persist?.contexts ?? (connection ? contextsOf(connection.persistData) : ['default'])).join(', '),
      token: connection ? String(getConnectionSecrets(connection.id)?.token ?? '') : '',
    },
    availableServers: [],
    includeToken: true,
    tokenLabel: 'Bearer token',
  });

  const token = String(values.token ?? '').trim();
  const contexts = parseContextsField(values.contexts, persist?.contexts);
  const persistData: K8sPersistData = {
    authMode: 'bearer',
    serverUrl: values.serverUrl,
    contexts,
    context: contexts[0],
  };
  await validateK8sCredentials(persistData, token);

  return {
    name: values.name,
    persistData: { ...persistData },
    secrets: { token },
  };
}

export const bearerConnectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID_BEARER,
  label: PROVIDER_DISPLAY_NAME_BEARER,
  icon: 'key',
  getActions(node, connection): CloudTreeAction[] {
    return commonNodeActions(node, connection, persistBearerOf);
  },
  connect: () => connectBearer(),
  editConnection: (connection) => connectBearer(connection),
  async restore(connection) {
    const persist = persistBearerOf(connection);
    try {
      await createK8sBackend(connection).testConnection(persist);
      return {
        ...connection,
        persistData: {
          ...connection.persistData,
          authMode: 'bearer',
        },
        status: 'connected' as const,
        errorMessage: undefined,
      };
    } catch (error) {
      return {
        ...connection,
        persistData: {
          ...connection.persistData,
          authMode: 'bearer',
        },
        status: 'error' as const,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  },
  async disconnect(_connectionId) {},
};

export const bearerTreeContributor = createTreeContributor(
  PROVIDER_ID_BEARER,
  persistBearerOf,
  async (persist) => persist.contexts ?? ['default'],
);
