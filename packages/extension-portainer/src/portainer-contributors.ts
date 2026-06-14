import { formDialogRequired } from '@eclipse-docks/core';
import { terminalService } from '@eclipse-docks/extension-terminal/api';
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
import { PORTAINER_EXEC_PROFILE_ID } from './portainer-terminal-profile';

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

function connectFormFields(connection?: CloudConnection) {
  const persist = connection ? persistOf(connection) : undefined;
  return [
    { name: 'name', label: 'Connection name', value: connection?.name ?? 'Portainer' },
    {
      name: 'serverUrl',
      label: 'Portainer URL',
      value: persist?.serverUrl ?? 'https://localhost:9443',
      type: 'url' as const,
    },
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password' as const,
      placeholder: connection ? 'Leave blank to keep current API key' : undefined,
      required: connection ? false : undefined,
    },
  ];
}

function resultFromForm(
  values: Record<string, string>,
): CloudConnectResult {
  const apiKey = values.apiKey?.trim();
  return {
    name: values.name,
    persistData: { serverUrl: values.serverUrl } satisfies PortainerPersistData,
    secrets: apiKey ? { apiKey } : undefined,
  };
}

async function promptConnect(): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: 'Connect Portainer',
    fields: connectFormFields(),
  });
  const result = resultFromForm(values);
  if (!result.secrets?.apiKey) {
    throw new Error('API key is required.');
  }
  return result;
}

async function promptEditConnection(connection: CloudConnection): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: `Edit Portainer — ${connection.name}`,
    fields: connectFormFields(connection),
  });
  return resultFromForm(values);
}

function parseCommandArgs(raw: string): string[] {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : ['/bin/sh'];
}

function containerLabel(node: CloudTreeNodeRef): string {
  return node.label.match(/^(.+?)\s+\(/)?.[1] ?? node.label;
}

function isRunningContainer(node: CloudTreeNodeRef): boolean {
  const state = String(node.meta?.state ?? '').toLowerCase();
  return !state || state === 'running';
}

async function openTerminalForNode(connection: CloudConnection, node: CloudTreeNodeRef): Promise<void> {
  const endpointId = Number(node.meta?.endpointId ?? 0);
  const containerId = node.resourceId?.trim();
  if (!endpointId || !containerId) {
    throw new Error('Console requires endpoint and container identifiers.');
  }
  if (!isRunningContainer(node)) {
    throw new Error('Console is only available for running containers.');
  }

  const persist = persistOf(connection);
  const label = containerLabel(node);
  await ensureApiKey(connection);

  const shellDialog = await formDialogRequired({
    label: `Open console — ${label}`,
    fields: [
      {
        name: 'command',
        label: 'Shell command',
        value: '/bin/sh',
        placeholder: '/bin/sh',
        required: false,
      },
    ],
  });
  const command = parseCommandArgs(String(shellDialog.command ?? '/bin/sh'));

  const terminal = await terminalService.createTerminal({
    profileId: PORTAINER_EXEC_PROFILE_ID,
    name: label,
    env: {
      PORTAINER_CONNECTION_ID: connection.id,
      PORTAINER_SERVER_URL: persist.serverUrl,
      PORTAINER_ENDPOINT_ID: String(endpointId),
      PORTAINER_CONTAINER_ID: containerId,
      PORTAINER_COMMAND: JSON.stringify(command),
    },
  });

  if (!terminal) {
    throw new Error('Failed to open Portainer console terminal.');
  }
}

const connectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID,
  label: PROVIDER_DISPLAY_NAME,
  icon: 'cubes',
  getActions(node): CloudTreeAction[] {
    if (node.kind !== CloudTreeNodeKind.Workload) return [];
    const actions: CloudTreeAction[] = [
      {
        id: 'portainer.workload.open',
        label: 'Open',
        icon: 'up-right-from-square',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node),
      },
      {
        id: 'portainer.workload.logs',
        label: 'View logs',
        icon: 'scroll',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node),
      },
    ];
    if (isRunningContainer(node)) {
      actions.push({
        id: 'portainer.workload.console',
        label: 'Open console',
        icon: 'terminal',
        run: (ctx) => openTerminalForNode(ctx.connection, ctx.node),
      });
    }
    return actions;
  },
  connect: promptConnect,
  editConnection: promptEditConnection,
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
