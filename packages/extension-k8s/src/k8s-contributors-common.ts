import {
  CloudTreeNodeKind,
  cloudConnectionService,
  openWorkloadEditor,
  type CloudConnection,
  type CloudTreeAction,
  type CloudTreeContributor,
  type CloudTreeNodeRef,
} from 'extension-cloud/api';
import { terminalService } from '@eclipse-docks/extension-terminal/api';
import { formDialogRequired } from '@eclipse-docks/core';
import {
  listClusterObjects,
  listClusterResourceTypes,
  listNamespacedObjects,
  listNamespacedResourceTypes,
  listNamespaces,
  listPods,
} from './api/k8s-api';
import { createK8sBackend } from './api/k8s-backend';
import type { K8sPersistData } from './api/k8s-types';
import { probeBearerExecAccess } from './api/k8s-exec-ws';
import { K8S_EXEC_PROFILE_ID } from './k8s-terminal-profile';
import { PROVIDER_ID_BEARER } from './provider';

export function manualNamespacesByContextOf(
  persistData: Record<string, unknown>,
): Record<string, string[]> {
  const raw = persistData.manualNamespacesByContext;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const output: Record<string, string[]> = {};
  for (const [ctx, namespaces] of Object.entries(raw as Record<string, unknown>)) {
    const contextName = String(ctx).trim();
    if (!contextName || !Array.isArray(namespaces)) continue;
    const unique = [...new Set(namespaces.map((ns) => String(ns).trim()).filter(Boolean))];
    if (unique.length > 0) {
      output[contextName] = unique;
    }
  }
  return output;
}

export function namespacesForContext(persist: K8sPersistData, contextName: string): string[] {
  return persist.manualNamespacesByContext?.[contextName]?.map((ns) => ns.trim()).filter(Boolean) ?? [];
}

export function contextsOf(persistData: Record<string, unknown>): string[] {
  const raw = persistData.contexts;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
  }
  const single = persistData.context != null ? String(persistData.context).trim() : 'default';
  return [single || 'default'];
}

export function parseContextsField(value: string | undefined, previous?: string[]): string[] {
  const parsed = (value ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (parsed.length > 0) return [...new Set(parsed)];
  return previous?.length ? previous : ['default'];
}

export function nodeId(connectionId: string, ...parts: string[]): string {
  return [connectionId, ...parts].join('/');
}

function sortNodesByLabel(nodes: CloudTreeNodeRef[]): CloudTreeNodeRef[] {
  return [...nodes].sort((a, b) => {
    const al = a.label.toLocaleLowerCase();
    const bl = b.label.toLocaleLowerCase();
    if (al !== bl) return al.localeCompare(bl);
    return a.label.localeCompare(b.label);
  });
}

export async function ensureToken(connection: CloudConnection): Promise<void> {
  void connection;
}

export function persistCompanionOf(connection: CloudConnection): K8sPersistData {
  const d = connection.persistData;
  return {
    authMode: 'companion',
    serverUrl: String(d.serverUrl ?? ''),
    context: d.context != null ? String(d.context) : undefined,
    contexts: contextsOf(d),
    manualNamespacesByContext: manualNamespacesByContextOf(d),
  };
}

export function persistBearerOf(connection: CloudConnection): K8sPersistData {
  const d = connection.persistData;
  return {
    authMode: 'bearer',
    serverUrl: String(d.serverUrl ?? ''),
    context: d.context != null ? String(d.context) : undefined,
    contexts: contextsOf(d),
    manualNamespacesByContext: manualNamespacesByContextOf(d),
  };
}

export function persistOf(connection: CloudConnection): K8sPersistData {
  return connection.providerId === PROVIDER_ID_BEARER
    ? persistBearerOf(connection)
    : persistCompanionOf(connection);
}

export type PersistResolver = (connection: CloudConnection) => K8sPersistData;

function shouldShowPodConsoleAction(connection: CloudConnection): boolean {
  return createK8sBackend(connection).supportsPodConsole();
}

function shouldShowClusterConsoleAction(connection: CloudConnection): boolean {
  return createK8sBackend(connection).supportsClusterConsole();
}

function terminalEnvForConnection(
  connection: CloudConnection,
  persist: K8sPersistData,
): Record<string, string> {
  const backend = createK8sBackend(connection);
  const env: Record<string, string> = {
    K8S_AUTH_MODE: backend.mode,
  };
  if (backend.mode === 'bearer') {
    env.K8S_CONNECTION_ID = connection.id;
    env.K8S_SERVER_URL = persist.serverUrl;
  }
  return env;
}

function parseCommandArgs(raw: string): string[] {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : ['/bin/sh'];
}

async function openTerminalForNode(
  connection: CloudConnection,
  node: CloudTreeNodeRef,
  persistOf: PersistResolver,
): Promise<void> {
  const persist = persistOf(connection);
  if (!shouldShowPodConsoleAction(connection)) {
    throw new Error('Console is not available for this connection.');
  }

  const kubeContext = String(node.meta?.kubeContext ?? persist.context ?? '').trim();
  const namespace = String(node.meta?.namespace ?? '').trim();
  const pod = String(node.meta?.podName ?? '').trim();

  let container = String(node.meta?.containerName ?? '').trim();
  if (!container) {
    const containers = Array.isArray(node.meta?.containers)
      ? (node.meta.containers as unknown[]).map((item) => String(item).trim()).filter(Boolean)
      : [];
    container = containers[0] ?? '';
  }

  if (!kubeContext || !namespace || !pod || !container) {
    throw new Error('Console requires kubeContext, namespace, pod, and container.');
  }

  const shellDialog = await formDialogRequired({
    label: `Open console — ${pod}/${container}`,
    fields: [
      {
        name: 'command',
        label: 'Shell command',
        value: '/bin/sh',
        placeholder: '/bin/sh',
        required: false
      },
    ],
  });
  const command = parseCommandArgs(String(shellDialog.command ?? '/bin/sh'));

  if (persist.authMode === 'bearer') {
    await probeBearerExecAccess({
      connectionId: connection.id,
      serverUrl: persist.serverUrl,
      namespace,
      pod,
      container,
      command,
    });
  }

  const terminal = await terminalService.createTerminal({
    profileId: K8S_EXEC_PROFILE_ID,
    name: `${pod}/${container}`,
    env: {
      ...terminalEnvForConnection(connection, persist),
      K8S_CONTEXT: kubeContext,
      K8S_NAMESPACE: namespace,
      K8S_POD: pod,
      K8S_CONTAINER: container,
      K8S_COMMAND: JSON.stringify(command),
    },
  });

  if (!terminal) {
    throw new Error('Failed to open Kubernetes console terminal.');
  }
}

async function openClusterTerminal(
  connection: CloudConnection,
  node: CloudTreeNodeRef,
  persistOf: PersistResolver,
): Promise<void> {
  const persist = persistOf(connection);
  if (!shouldShowClusterConsoleAction(connection)) {
    throw new Error('Cluster console is only available for companion-backed connections.');
  }

  const contexts = persist.contexts?.map((value) => value.trim()).filter(Boolean) ?? [];
  const kubeContext = String(node.meta?.kubeContext ?? persist.context ?? contexts[0] ?? '').trim();
  if (!kubeContext) {
    throw new Error('Cluster console requires a kube context. Open it from a context node.');
  }

  const namespace = String(node.meta?.namespace ?? '').trim();
  const name = namespace ? `kubectl ${kubeContext}/${namespace}` : `kubectl ${kubeContext}`;

  const env: Record<string, string> = {
    ...terminalEnvForConnection(connection, persist),
    K8S_TARGET: 'cluster',
    K8S_CONTEXT: kubeContext,
  };
  if (namespace) {
    env.K8S_NAMESPACE = namespace;
  }

  const terminal = await terminalService.createTerminal({
    profileId: K8S_EXEC_PROFILE_ID,
    name,
    env,
  });

  if (!terminal) {
    throw new Error('Failed to open Kubernetes cluster console terminal.');
  }
}

function addManualNamespaceAction(
  connection: CloudConnection,
  persistOf: PersistResolver,
  contextName: string,
): CloudTreeAction {
  return {
    id: 'k8s.namespace.add-manual',
    label: 'Add namespace',
    icon: 'plus',
    run: async (ctx) => {
      const values = await formDialogRequired({
        label: `Add namespace — ${connection.name}`,
        fields: [
          {
            name: 'namespace',
            label: `Namespace for context ${contextName}`,
            placeholder: 'team-a',
          },
        ],
      });
      const namespace = String(values.namespace ?? '').trim();
      if (!namespace) throw new Error('Namespace is required.');

      const target = cloudConnectionService.getConnection(ctx.connection.id);
      if (!target) return;

      const current = persistOf(target);
      const existing = namespacesForContext(current, contextName);
      const updated = [...new Set([...existing, namespace])];
      target.persistData = {
        ...target.persistData,
        manualNamespacesByContext: {
          ...(current.manualNamespacesByContext ?? {}),
          [contextName]: updated,
        },
      };
      await cloudConnectionService.refreshConnection(target.id);
    },
  };
}

export function commonNodeActions(
  node: CloudTreeNodeRef,
  connection: CloudConnection,
  persistOf: PersistResolver,
): CloudTreeAction[] {
  if (node.kind === CloudTreeNodeKind.Connection) {
    const persist = persistOf(connection);
    const contexts = persist.contexts?.map((c) => c.trim()).filter(Boolean) ?? [];
    if (contexts.length === 1) {
      const actions: CloudTreeAction[] = [addManualNamespaceAction(connection, persistOf, contexts[0])];
      if (shouldShowClusterConsoleAction(connection)) {
        actions.push({
          id: 'k8s.cluster.console',
          label: 'Open cluster console',
          icon: 'terminal',
          run: (ctx) => openClusterTerminal(ctx.connection, ctx.node, persistOf),
        });
      }
      return actions;
    }
    return [];
  }

  if (node.kind === CloudTreeNodeKind.Scope) {
    const contextName = String(node.meta?.kubeContext ?? node.label).trim() || 'default';
    const actions: CloudTreeAction[] = [addManualNamespaceAction(connection, persistOf, contextName)];
    if (shouldShowClusterConsoleAction(connection)) {
      actions.push({
        id: 'k8s.scope.console',
        label: 'Open cluster console',
        icon: 'terminal',
        run: (ctx) => openClusterTerminal(ctx.connection, ctx.node, persistOf),
      });
    }
    return actions;
  }

  if (
    node.kind === CloudTreeNodeKind.Group &&
    typeof node.meta?.namespace === 'string' &&
    !(typeof node.meta?.podName === 'string' && node.meta.podName)
  ) {
    const oldName = String(node.meta?.namespace ?? node.label).trim();
    const contextName = String(node.meta?.kubeContext ?? connection.persistData.context ?? '').trim();
    const persist = persistOf(connection);
    const manual = contextName ? namespacesForContext(persist, contextName) : [];
    if (!oldName || !contextName || !manual.includes(oldName)) {
      if (shouldShowClusterConsoleAction(connection)) {
        return [
          {
            id: 'k8s.namespace.console',
            label: 'Open cluster console',
            icon: 'terminal',
            run: (ctx) => openClusterTerminal(ctx.connection, ctx.node, persistOf),
          },
        ];
      }
      return [];
    }

    const actions: CloudTreeAction[] = [
      {
        id: 'k8s.tree.rename',
        label: 'Rename',
        icon: 'pen-to-square',
        run: async (ctx) => {
          const values = await formDialogRequired({
            label: `Rename — ${connection.name}`,
            fields: [
              {
                name: 'name',
                label: `New name (current: ${oldName})`,
                placeholder: oldName,
              },
            ],
          });

          const renamed = String(values.name ?? '').trim();
          if (!renamed) throw new Error('Name is required.');
          if (renamed === oldName) return;

          const target = cloudConnectionService.getConnection(ctx.connection.id);
          if (!target) return;

          const current = persistOf(target);
          const manualCurrent = namespacesForContext(current, contextName);
          if (!manualCurrent.includes(oldName)) return;

          const updated = [...new Set(manualCurrent.map((ns) => (ns === oldName ? renamed : ns)).filter(Boolean))];
          target.persistData = {
            ...target.persistData,
            manualNamespacesByContext: {
              ...(current.manualNamespacesByContext ?? {}),
              [contextName]: updated,
            },
          };
          await cloudConnectionService.refreshConnection(target.id);
        },
      },
    ];
    if (shouldShowClusterConsoleAction(connection)) {
      actions.push({
        id: 'k8s.namespace.console',
        label: 'Open cluster console',
        icon: 'terminal',
        run: (ctx) => openClusterTerminal(ctx.connection, ctx.node, persistOf),
      });
    }
    return actions;
  }

  if (
    shouldShowPodConsoleAction(connection) &&
    node.kind === CloudTreeNodeKind.Group &&
    typeof node.meta?.namespace === 'string' &&
    typeof node.meta?.podName === 'string' &&
    node.meta.podName
  ) {
    return [
      {
        id: 'k8s.pod.console',
        label: 'Open console',
        icon: 'terminal',
        run: (ctx) => openTerminalForNode(ctx.connection, ctx.node, persistOf),
      },
    ];
  }

  if (
    node.kind === CloudTreeNodeKind.Group &&
    typeof node.meta?.resourceTypeName === 'string' &&
    typeof node.meta?.resourceTypeGroupVersion === 'string' &&
    typeof node.meta?.objectName === 'string' &&
    node.meta.resourceTypeName &&
    node.meta.resourceTypeGroupVersion &&
    node.meta.objectName
  ) {
    return [
      {
        id: 'k8s.object.open',
        label: 'Open',
        icon: 'up-right-from-square',
        run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node),
      },
    ];
  }

  if (node.kind !== CloudTreeNodeKind.Workload) return [];
  const actions: CloudTreeAction[] = [
    {
      id: 'k8s.workload.open',
      label: 'Open',
      icon: 'up-right-from-square',
      run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node),
    },
    {
      id: 'k8s.workload.logs',
      label: 'View logs',
      icon: 'scroll',
      run: (ctx) => openWorkloadEditor(ctx.connection, ctx.node),
    },
  ];

  if (shouldShowPodConsoleAction(connection)) {
    actions.push({
      id: 'k8s.workload.console',
      label: 'Open console',
      icon: 'terminal',
      run: (ctx) => openTerminalForNode(ctx.connection, ctx.node, persistOf),
    });
  }

  return actions;
}

export function isUnderConnection(parent: CloudTreeNodeRef | null): boolean {
  return !parent || parent.kind === CloudTreeNodeKind.Connection;
}

type RootContextsResolver = (persist: K8sPersistData) => Promise<string[]>;

export function createTreeContributor(
  providerId: string,
  persistOf: PersistResolver,
  resolveRootContexts: RootContextsResolver,
): CloudTreeContributor {
  return {
    providerId,
    async getChildren(parent, connection) {
      await ensureToken(connection);
      const backend = createK8sBackend(connection);
      const persist = persistOf(connection);
      const childrenForContext = async (contextNameRaw: string): Promise<CloudTreeNodeRef[]> => {
        const contextName = String(contextNameRaw).trim();
        const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
        const discovered = await listNamespaces(backend, scopedPersist);
        const manual = namespacesForContext(persist, contextName);
        const namespaceMap = new Map<string, { name: string; uid: string }>();
        for (const ns of discovered) {
          namespaceMap.set(ns.name, ns);
        }
        for (const name of manual) {
          if (!namespaceMap.has(name)) {
            namespaceMap.set(name, { name, uid: `manual:${contextName}:${name}` });
          }
        }
        const namespaceNodes: CloudTreeNodeRef[] = [...namespaceMap.values()].map((ns) => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, ns.name),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Group,
          label: ns.name,
          hasChildren: true,
          resourceId: ns.uid,
          meta: { namespace: ns.name, kubeContext: contextName },
        }));
        const clusterInventoryNode: CloudTreeNodeRef = {
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, 'cluster-inventory', contextName),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Group,
          label: 'Cluster Inventory',
          icon: 'sitemap',
          hasChildren: true,
          meta: {
            kubeContext: contextName,
            clusterObjectsRoot: 'true',
          },
        };
        return sortNodesByLabel([...namespaceNodes, clusterInventoryNode]);
      };

      if (isUnderConnection(parent)) {
        const contexts = await resolveRootContexts(persist);
        if (contexts.length === 1) {
          return childrenForContext(contexts[0]);
        }
        return sortNodesByLabel(contexts.map((ctxName) => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Scope, ctxName),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Scope,
          label: ctxName,
          hasChildren: true,
          meta: { kubeContext: ctxName },
        })));
      }
      if (!parent) return [];
      if (parent.kind === CloudTreeNodeKind.Scope) {
        const contextName = String(parent.meta?.kubeContext ?? parent.label).trim();
        return childrenForContext(contextName);
      }
      if (parent.kind === CloudTreeNodeKind.Group) {
        const clusterRoot = String(parent.meta?.clusterObjectsRoot ?? '').trim();
        if (clusterRoot === 'true') {
          const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
          const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
          const types = await listClusterResourceTypes(backend, scopedPersist);
          return sortNodesByLabel(types.map((resourceType) => ({
            nodeId: nodeId(
              connection.id,
              CloudTreeNodeKind.Group,
              'cluster-objects',
              resourceType.groupVersion,
              resourceType.resourceName,
            ),
            connectionId: connection.id,
            providerId,
            kind: CloudTreeNodeKind.Group,
            label: `${resourceType.resourceName}.${resourceType.groupVersion}`,
            icon: 'shapes',
            hasChildren: true,
            meta: {
              kubeContext: contextName,
              resourceTypeGroupVersion: resourceType.groupVersion,
              resourceTypeName: resourceType.resourceName,
              resourceTypeKind: resourceType.kind,
              clusterScoped: true,
            },
          })));
        }

        const clusterScoped = parent.meta?.clusterScoped === true || parent.meta?.clusterScoped === 'true';
        const clusterTypeName = String(parent.meta?.resourceTypeName ?? '').trim();
        const clusterTypeGroupVersion = String(parent.meta?.resourceTypeGroupVersion ?? '').trim();
        const clusterTypeKind = String(parent.meta?.resourceTypeKind ?? '').trim();
        if (clusterScoped && clusterTypeName && clusterTypeGroupVersion && clusterTypeKind) {
          const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
          const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
          const objects = await listClusterObjects(backend, scopedPersist, {
            groupVersion: clusterTypeGroupVersion,
            resourceName: clusterTypeName,
            kind: clusterTypeKind,
          });
          return sortNodesByLabel(objects.map((obj) => ({
            nodeId: nodeId(
              connection.id,
              CloudTreeNodeKind.Group,
              'cluster-object',
              clusterTypeGroupVersion,
              clusterTypeName,
              obj.name,
            ),
            connectionId: connection.id,
            providerId,
            kind: CloudTreeNodeKind.Group,
            label: obj.name,
            icon: 'cube',
            hasChildren: false,
            resourceId: obj.uid,
            meta: {
              kubeContext: contextName,
              objectKind: obj.kind,
              objectName: obj.name,
              resourceTypeGroupVersion: clusterTypeGroupVersion,
              resourceTypeName: clusterTypeName,
              clusterScoped: true,
              openInEditor: true,
            },
          })));
        }

        const objectRoot = String(parent.meta?.resourceObjectsRoot ?? '').trim();
        if (objectRoot === 'true') {
          const namespace = String(parent.meta?.namespace ?? '').trim();
          const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
          if (!namespace) return [];
          const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
          const types = await listNamespacedResourceTypes(backend, scopedPersist);
          return sortNodesByLabel(types.map((resourceType) => ({
            nodeId: nodeId(
              connection.id,
              CloudTreeNodeKind.Group,
              namespace,
              'objects',
              resourceType.groupVersion,
              resourceType.resourceName,
            ),
            connectionId: connection.id,
            providerId,
            kind: CloudTreeNodeKind.Group,
            label: `${resourceType.resourceName}.${resourceType.groupVersion}`,
            icon: 'shapes',
            hasChildren: true,
            meta: {
              namespace,
              kubeContext: contextName,
              resourceTypeGroupVersion: resourceType.groupVersion,
              resourceTypeName: resourceType.resourceName,
              resourceTypeKind: resourceType.kind,
            },
          })));
        }

        const resourceTypeName = String(parent.meta?.resourceTypeName ?? '').trim();
        const resourceTypeGroupVersion = String(parent.meta?.resourceTypeGroupVersion ?? '').trim();
        const resourceTypeKind = String(parent.meta?.resourceTypeKind ?? '').trim();
        if (resourceTypeName && resourceTypeGroupVersion && resourceTypeKind) {
          const namespace = String(parent.meta?.namespace ?? '').trim();
          const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
          if (!namespace) return [];
          const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
          const objects = await listNamespacedObjects(backend, scopedPersist, namespace, {
            groupVersion: resourceTypeGroupVersion,
            resourceName: resourceTypeName,
            kind: resourceTypeKind,
          });
          return sortNodesByLabel(objects.map((obj) => ({
            nodeId: nodeId(
              connection.id,
              CloudTreeNodeKind.Group,
              namespace,
              'object',
              resourceTypeGroupVersion,
              resourceTypeName,
              obj.name,
            ),
            connectionId: connection.id,
            providerId,
            kind: CloudTreeNodeKind.Group,
            label: obj.name,
            icon: 'cube',
            hasChildren: false,
            resourceId: obj.uid,
            meta: {
              namespace,
              kubeContext: contextName,
              objectKind: obj.kind,
              objectName: obj.name,
              resourceTypeGroupVersion,
              resourceTypeName,
              openInEditor: true,
            },
          })));
        }

        const namespace = String(parent.meta?.namespace ?? parent.label);
        const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
        const podName = parent.meta?.podName;
        if (typeof podName === 'string' && podName) {
          const containers = Array.isArray(parent.meta?.containers)
            ? (parent.meta.containers as unknown[]).map(String).filter(Boolean)
            : [];
          return sortNodesByLabel(containers.map((containerName) => ({
            nodeId: nodeId(
              connection.id,
              CloudTreeNodeKind.Workload,
              namespace,
              podName,
              containerName,
            ),
            connectionId: connection.id,
            providerId,
            kind: CloudTreeNodeKind.Workload,
            label: containerName,
            icon: 'cube',
            hasChildren: false,
            meta: {
              namespace,
              kubeContext: contextName,
              podName,
              containerName,
              phase: parent.meta?.phase,
            },
          })));
        }
        const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
        const pods = await listPods(backend, scopedPersist, namespace);
        const podNodes: CloudTreeNodeRef[] = pods.map((pod) => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, namespace, 'pod', pod.name),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Group,
          label: pod.phase ? `${pod.name} (${pod.phase})` : pod.name,
          icon: 'box',
          hasChildren: pod.containers.length > 0,
          resourceId: pod.uid,
          meta: {
            namespace,
            kubeContext: contextName,
            podName: pod.name,
            phase: pod.phase,
            containers: pod.containers,
          },
        }));

        const objectsRootNode: CloudTreeNodeRef = {
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, namespace, 'objects-root'),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Group,
          label: 'Inventory',
          icon: 'sitemap',
          hasChildren: true,
          meta: {
            namespace,
            kubeContext: contextName,
            resourceObjectsRoot: 'true',
          },
        };

        return sortNodesByLabel([...podNodes, objectsRootNode]);
      }
      return [];
    },
  };
}
