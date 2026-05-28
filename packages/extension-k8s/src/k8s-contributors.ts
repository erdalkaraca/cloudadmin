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
import { k8sWorkloadHandler } from './k8s-workload';
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
    contexts: contextsOf(d),
  };
}

function contextsOf(persistData: Record<string, unknown>): string[] {
  const raw = persistData.contexts;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
  }
  const single = persistData.context != null ? String(persistData.context).trim() : 'default';
  return [single || 'default'];
}

function parseContextsField(value: string | undefined, previous?: string[]): string[] {
  const parsed = (value ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (parsed.length > 0) return [...new Set(parsed)];
  return previous?.length ? previous : ['default'];
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

function connectFormFields(connection?: CloudConnection) {
  const persist = connection ? persistOf(connection) : undefined;
  return [
    { name: 'name', label: 'Connection name', value: connection?.name ?? 'Kubernetes cluster' },
    {
      name: 'serverUrl',
      label: 'API server URL',
      value: persist?.serverUrl ?? '',
      type: 'url' as const,
      placeholder: 'https://your-cluster:6443',
    },
    {
      name: 'contexts',
      label: 'Contexts',
      value: (
        persist?.contexts ??
        (connection ? contextsOf(connection.persistData) : ['default', 'lab'])
      ).join(', '),
      placeholder: 'Comma-separated, e.g. default, lab',
      required: false,
    },
    {
      name: 'token',
      label: 'Bearer token',
      type: 'password' as const,
      placeholder: connection ? 'Leave blank to keep current token' : undefined,
      required: connection ? false : undefined,
    },
  ];
}

function resultFromForm(
  values: Record<string, string>,
  connection?: CloudConnection,
): CloudConnectResult {
  const persist = connection ? persistOf(connection) : undefined;
  const contexts = parseContextsField(values.contexts, persist?.contexts);
  const persistData: K8sPersistData = {
    serverUrl: values.serverUrl,
    contexts,
    context: contexts[0],
  };
  const token = values.token?.trim();
  return {
    name: values.name,
    persistData: { ...persistData },
    secrets: token ? { token } : undefined,
  };
}

async function promptConnect(): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: 'Connect Kubernetes',
    fields: connectFormFields(),
  });
  const result = resultFromForm(values);
  if (!result.secrets?.token) {
    throw new Error('Bearer token is required.');
  }
  return result;
}

async function promptEditConnection(connection: CloudConnection): Promise<CloudConnectResult> {
  const values = await formDialogRequired({
    label: `Edit Kubernetes — ${connection.name}`,
    fields: connectFormFields(connection),
  });
  return resultFromForm(values, connection);
}

const connectionContributor: CloudConnectionContributor = {
  providerId: PROVIDER_ID,
  label: PROVIDER_DISPLAY_NAME,
  icon: 'diagram-project',
  getActions(node): CloudTreeAction[] {
    if (node.kind !== CloudTreeNodeKind.Workload) return [];
    return [
      {
        id: 'k8s.workload.open',
        label: 'Open',
        icon: 'up-right-from-square',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node, 'overview'),
      },
      {
        id: 'k8s.workload.logs',
        label: 'View logs',
        icon: 'scroll',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node, 'logs'),
      },
    ];
  },
  connect: promptConnect,
  editConnection: promptEditConnection,
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
      return (persist.contexts ?? ['default']).map((ctxName) => ({
        nodeId: nodeId(connection.id, CloudTreeNodeKind.Scope, ctxName),
        connectionId: connection.id,
        providerId: PROVIDER_ID,
        kind: CloudTreeNodeKind.Scope,
        label: ctxName,
        hasChildren: true,
        meta: { kubeContext: ctxName },
      }));
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
      const podName = parent.meta?.podName;
      if (typeof podName === 'string' && podName) {
        const containers = Array.isArray(parent.meta?.containers)
          ? (parent.meta.containers as unknown[]).map(String).filter(Boolean)
          : [];
        return containers.map((containerName) => ({
          nodeId: nodeId(
            connection.id,
            CloudTreeNodeKind.Workload,
            namespace,
            podName,
            containerName,
          ),
          connectionId: connection.id,
          providerId: PROVIDER_ID,
          kind: CloudTreeNodeKind.Workload,
          label: containerName,
          icon: 'cube',
          hasChildren: false,
          meta: {
            namespace,
            podName,
            containerName,
            phase: parent.meta?.phase,
          },
        }));
      }
      const pods = await listPods(connection.id, persist, namespace);
      return pods.map((pod) => ({
        nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, namespace, 'pod', pod.name),
        connectionId: connection.id,
        providerId: PROVIDER_ID,
        kind: CloudTreeNodeKind.Group,
        label: pod.phase ? `${pod.name} (${pod.phase})` : pod.name,
        icon: 'box',
        hasChildren: pod.containers.length > 0,
        resourceId: pod.uid,
        meta: {
          namespace,
          podName: pod.name,
          phase: pod.phase,
          containers: pod.containers,
        },
      }));
    }
    return [];
  },
};

export function registerK8sProvider(): void {
  registerCloudProvider(connectionContributor, treeContributor, k8sWorkloadHandler);
}
