import {
  CloudTreeNodeKind,
  cloudConnectionService,
  openWorkloadEditor,
  type CloudConnection,
  type CloudTreeAction,
  type CloudTreeContributor,
  type CloudTreeNodeRef,
} from 'extension-cloud/api';
import { formDialogRequired } from '@eclipse-docks/core';
import { listNamespaces, listPods, type K8sPersistData } from './api/k8s-client';

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

export type PersistResolver = (connection: CloudConnection) => K8sPersistData;

export function commonNodeActions(
  node: CloudTreeNodeRef,
  connection: CloudConnection,
  persistOf: PersistResolver,
): CloudTreeAction[] {
  if (node.kind === CloudTreeNodeKind.Scope) {
    return [
      {
        id: 'k8s.namespace.add-manual',
        label: 'Add namespace',
        icon: 'plus',
        run: async (ctx) => {
          const contextName = String(node.meta?.kubeContext ?? node.label).trim() || 'default';
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
      },
    ];
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
      return [];
    }

    return [
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
  }

  if (node.kind !== CloudTreeNodeKind.Workload) return [];
  return [
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
      const persist = persistOf(connection);
      if (isUnderConnection(parent)) {
        const contexts = await resolveRootContexts(persist);
        return contexts.map((ctxName) => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Scope, ctxName),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Scope,
          label: ctxName,
          hasChildren: true,
          meta: { kubeContext: ctxName },
        }));
      }
      if (!parent) return [];
      if (parent.kind === CloudTreeNodeKind.Scope) {
        const contextName = String(parent.meta?.kubeContext ?? parent.label).trim();
        const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
        const discovered = await listNamespaces(connection.id, scopedPersist);
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
        return [...namespaceMap.values()].map((ns) => ({
          nodeId: nodeId(connection.id, CloudTreeNodeKind.Group, ns.name),
          connectionId: connection.id,
          providerId,
          kind: CloudTreeNodeKind.Group,
          label: ns.name,
          hasChildren: true,
          resourceId: ns.uid,
          meta: { namespace: ns.name, kubeContext: contextName },
        }));
      }
      if (parent.kind === CloudTreeNodeKind.Group) {
        const namespace = String(parent.meta?.namespace ?? parent.label);
        const contextName = String(parent.meta?.kubeContext ?? persist.context ?? '').trim();
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
          }));
        }
        const scopedPersist: K8sPersistData = { ...persist, context: contextName || persist.context };
        const pods = await listPods(connection.id, scopedPersist, namespace);
        return pods.map((pod) => ({
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
      }
      return [];
    },
  };
}
