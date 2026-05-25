import { formDialogRequired } from '@eclipse-docks/core';
import {
  CloudTreeNodeKind,
  getConnectionSecrets,
  openWorkloadEditor,
  registerCloudProvider,
  setConnectionSecrets,
  type CloudConnection,
  type CloudConnectionContributor,
  type CloudConnectResult,
  type CloudTreeAction,
  type CloudTreeContributor,
  type CloudTreeNodeRef,
} from 'extension-cloud/api';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
import { portainerWorkloadHandler } from './portainer-workload';
import {
  listContainers,
  listEndpoints,
  testPortainerConnection,
  validatePortainerCredentials,
  type PortainerPersistData,
} from './api/portainer-client';

function persistOf(connection: CloudConnection): PortainerPersistData {
  return { serverUrl: String(connection.persistData.serverUrl ?? '') };
}

function nodeId(connectionId: string, ...parts: string[]): string {
  return [connectionId, ...parts].join('/');
}

async function ensureApiKey(connection: CloudConnection): Promise<void> {
  if (getConnectionSecrets(connection.id)?.apiKey) return;
  const { apiKey } = await formDialogRequired({
    label: `Portainer credentials — ${connection.name}`,
    fields: [
      {
        name: 'apiKey',
        label: 'API key',
        type: 'password',
        placeholder: 'Saved in workspace app settings',
      },
    ],
  });
  const persist = persistOf(connection);
  await validatePortainerCredentials(persist, apiKey);
  await setConnectionSecrets(connection.id, { apiKey });
}

async function promptConnect(): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: 'Connect Portainer',
    fields: [
      { name: 'name', label: 'Connection name', value: 'Portainer' },
      { name: 'serverUrl', label: 'Portainer URL', value: 'https://localhost:9443', type: 'url' },
      { name: 'apiKey', label: 'API key', type: 'password' },
    ],
  });
  const persistData: PortainerPersistData = { serverUrl: values.serverUrl };
  await validatePortainerCredentials(persistData, values.apiKey);
  return {
    name: values.name,
    persistData: { serverUrl: persistData.serverUrl },
    secrets: { apiKey: values.apiKey },
  };
}

const connectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID,
  label: PROVIDER_DISPLAY_NAME,
  icon: 'cubes',
  getActions(node): CloudTreeAction[] {
    if (node.kind !== CloudTreeNodeKind.Workload) return [];
    return [
      {
        id: 'portainer.workload.open',
        label: 'Open',
        icon: 'up-right-from-square',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node, 'overview'),
      },
      {
        id: 'portainer.workload.logs',
        label: 'View logs',
        icon: 'scroll',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node, 'logs'),
      },
    ];
  },
  connect: promptConnect,
  async restore(connection) {
    if (!getConnectionSecrets(connection.id)?.apiKey) {
      return {
        ...connection,
        status: 'disconnected',
        errorMessage: 'Expand connection to enter API key.',
      };
    }
    await testPortainerConnection(connection.id, persistOf(connection));
    return { ...connection, status: 'connected', errorMessage: undefined };
  },
  async disconnect(_connectionId) {},
};

function isUnderConnection(parent: CloudTreeNodeRef | null): boolean {
  return !parent || parent.kind === CloudTreeNodeKind.Connection;
}

const treeContributor: CloudTreeContributor = {
  providerId: PROVIDER_ID,
  async getChildren(parent, connection) {
    await ensureApiKey(connection);
    const persist = persistOf(connection);
    if (isUnderConnection(parent)) {
      const endpoints = await listEndpoints(connection.id, persist);
      return endpoints.map(
        (ep): CloudTreeNodeRef => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Scope, String(ep.id)),
          connectionId: connection.id,
          providerId: PROVIDER_ID,
          kind: CloudTreeNodeKind.Scope,
          label: ep.name,
          hasChildren: true,
          resourceId: String(ep.id),
          meta: { endpointId: ep.id, endpointType: ep.type },
        }),
      );
    }
    if (!parent) return [];
    if (parent.kind === CloudTreeNodeKind.Scope) {
      const endpointId = Number(parent.meta?.endpointId ?? parent.resourceId);
      const containers = await listContainers(connection.id, persist, endpointId);
      return containers.map((c) => {
        const shortName = (c.Names[0] ?? c.Id).replace(/^\//, '');
        return {
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Workload, String(endpointId), c.Id),
          connectionId: connection.id,
          providerId: PROVIDER_ID,
          kind: CloudTreeNodeKind.Workload,
          label: `${shortName} (${c.State})`,
          hasChildren: false,
          resourceId: c.Id,
          meta: { endpointId, state: c.State, status: c.Status },
        };
      });
    }
    return [];
  },
};

export function registerPortainerProvider(): void {
  registerCloudProvider(connectionContributor, treeContributor, portainerWorkloadHandler);
}
