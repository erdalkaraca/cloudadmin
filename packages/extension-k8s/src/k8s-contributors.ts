import { formDialogRequired } from '@eclipse-docks/core';
import {
  getConnectionSecrets,
  registerCloudProvider,
  setConnectionSecrets,
  type CloudConnection,
  type CloudConnectionContributor,
  type CloudConnectResult,
  type CloudTreeContributor,
  CloudTreeNodeKind,
  type CloudTreeNodeRef,
} from 'extension-cloud/api';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
import {
  listNamespaces,
  listPods,
  testK8sConnection,
  validateK8sCredentials,
  type K8sPersistData,
} from './api/k8s-client';

function persistOf(connection: CloudConnection): K8sPersistData {
  const d = connection.persistData;
  return {
    serverUrl: String(d.serverUrl ?? ''),
    context: d.context != null ? String(d.context) : undefined,
    insecureSkipTlsVerify: Boolean(d.insecureSkipTlsVerify),
  };
}

function nodeId(connectionId: string, ...parts: string[]): string {
  return [connectionId, ...parts].join('/');
}

async function ensureToken(connection: CloudConnection): Promise<void> {
  if (getConnectionSecrets(connection.id)?.token) return;
  const { token } = await formDialogRequired({
    label: `Kubernetes credentials — ${connection.name}`,
    fields: [
      {
        name: 'token',
        label: 'Bearer token',
        type: 'password',
        placeholder: 'Saved in workspace app settings',
      },
    ],
  });
  const persist = persistOf(connection);
  await validateK8sCredentials(persist, token.trim());
  await setConnectionSecrets(connection.id, { token: token.trim() });
}

async function promptConnect(): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: 'Connect Kubernetes',
    fields: [
      { name: 'name', label: 'Connection name', value: 'Kubernetes cluster' },
      { name: 'serverUrl', label: 'API server URL', value: 'https://127.0.0.1:6443', type: 'url' },
      { name: 'token', label: 'Bearer token', type: 'password' },
    ],
  });
  const persistData: K8sPersistData = { serverUrl: values.serverUrl, context: 'default' };
  await validateK8sCredentials(persistData, values.token);
  return {
    name: values.name,
    persistData: { ...persistData },
    secrets: { token: values.token },
  };
}

const connectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID,
  label: PROVIDER_DISPLAY_NAME,
  icon: 'diagram-project',
  getActions: () => [],
  connect: promptConnect,
  async restore(connection) {
    if (!getConnectionSecrets(connection.id)?.token) {
      return {
        ...connection,
        status: 'disconnected',
        errorMessage: 'Expand connection to enter credentials.',
      };
    }
    await testK8sConnection(connection.id, persistOf(connection));
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
    await ensureToken(connection);
    const persist = persistOf(connection);
    if (isUnderConnection(parent)) {
      const ctx: CloudTreeNodeRef = {
        nodeId: nodeId(connection.id, CloudTreeNodeKind.Scope, persist.context ?? 'default'),
        connectionId: connection.id,
        providerId: PROVIDER_ID,
        kind: CloudTreeNodeKind.Scope,
        label: persist.context ?? 'default',
        hasChildren: true,
      };
      return [ctx];
    }
    if (!parent) return [];
    if (parent.kind === CloudTreeNodeKind.Scope) {
      const namespaces = await listNamespaces(connection.id, persist);
      return namespaces.map((ns) => ({
        nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, ns.name),
        connectionId: connection.id,
        providerId: PROVIDER_ID,
        kind: CloudTreeNodeKind.Group,
        label: ns.name,
        hasChildren: true,
        resourceId: ns.uid,
        meta: { namespace: ns.name },
      }));
    }
    if (parent.kind === CloudTreeNodeKind.Group) {
      const namespace = String(parent.meta?.namespace ?? parent.label);
      const pods = await listPods(connection.id, persist, namespace);
      return pods.map((pod) => ({
        nodeId: nodeId(connection.id, CloudTreeNodeKind.Workload, namespace, pod.name),
        connectionId: connection.id,
        providerId: PROVIDER_ID,
        kind: CloudTreeNodeKind.Workload,
        label: pod.phase ? `${pod.name} (${pod.phase})` : pod.name,
        hasChildren: false,
        resourceId: pod.uid,
        meta: { namespace, phase: pod.phase },
      }));
    }
    return [];
  },
};

export function registerK8sProvider(): void {
  registerCloudProvider(connectionContributor, treeContributor);
}
