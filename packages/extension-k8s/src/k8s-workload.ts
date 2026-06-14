import type {
  CloudTreeActionContext,
  CloudWorkloadHandler,
  WorkloadCapabilities,
  WorkloadConfigContent,
  WorkloadStatus,
} from 'extension-cloud/api';
import {
  getClusterObject,
  getNamespacedObject,
  getPod,
  getPodLogs,
} from './api/k8s-api';
import { createK8sBackend } from './api/k8s-backend';
import type { K8sPersistData } from './api/k8s-types';
import { persistOf } from './k8s-contributors-common';

function contextOf(context: CloudTreeActionContext): string | undefined {
  const ctx = context.node.meta?.kubeContext;
  if (typeof ctx === 'string' && ctx.trim()) return ctx.trim();
  return undefined;
}

function scopedPersist(context: CloudTreeActionContext): K8sPersistData {
  const persist = persistOf(context.connection);
  const ctx = contextOf(context);
  return {
    ...persist,
    context: ctx ?? persist.context,
  };
}

function namespaceOf(context: CloudTreeActionContext): string {
  const ns = context.node.meta?.namespace;
  if (typeof ns === 'string' && ns) return ns;
  throw new Error('Namespace missing on tree node.');
}

function podNameOf(context: CloudTreeActionContext): string {
  const name = context.node.meta?.podName;
  if (typeof name === 'string' && name) return name;
  throw new Error('Pod name missing on tree node.');
}

function containerNameOf(context: CloudTreeActionContext): string {
  const name = context.node.meta?.containerName;
  if (typeof name === 'string' && name) return name;
  throw new Error('Container name missing on tree node.');
}

function objectTypeNameOf(context: CloudTreeActionContext): string {
  const value = context.node.meta?.resourceTypeName;
  if (typeof value === 'string' && value) return value;
  throw new Error('Object resource type name missing on tree node.');
}

function objectTypeGroupVersionOf(context: CloudTreeActionContext): string {
  const value = context.node.meta?.resourceTypeGroupVersion;
  if (typeof value === 'string' && value) return value;
  throw new Error('Object resource type groupVersion missing on tree node.');
}

function objectKindOf(context: CloudTreeActionContext): string {
  const value = context.node.meta?.objectKind;
  if (typeof value === 'string' && value) return value;
  return 'Object';
}

function objectNameOf(context: CloudTreeActionContext): string {
  const value = context.node.meta?.objectName;
  if (typeof value === 'string' && value) return value;
  throw new Error('Object name missing on tree node.');
}

function isInventoryObjectNode(context: CloudTreeActionContext): boolean {
  return Boolean(
    context.node.meta?.resourceTypeName &&
      context.node.meta?.resourceTypeGroupVersion &&
      context.node.meta?.objectName,
  );
}

function isClusterScopedNode(context: CloudTreeActionContext): boolean {
  return context.node.meta?.clusterScoped === true || context.node.meta?.clusterScoped === 'true';
}

function yamlEscape(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function scalarToYaml(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    if (value === '') return '""';
    const simple = /^[A-Za-z0-9._\/-]+$/.test(value);
    return simple ? value : yamlEscape(value);
  }
  return yamlEscape(String(value));
}

function jsonToYaml(value: unknown, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const nested = jsonToYaml(item, indentLevel + 1);
          return `${indent}-\n${nested}`;
        }
        return `${indent}- ${scalarToYaml(item)}`;
      })
      .join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, item]) => {
        if (item && typeof item === 'object') {
          const nested = jsonToYaml(item, indentLevel + 1);
          return `${indent}${key}:\n${nested}`;
        }
        return `${indent}${key}: ${scalarToYaml(item)}`;
      })
      .join('\n');
  }

  return `${indent}${scalarToYaml(value)}`;
}

function scopedContext(context: CloudTreeActionContext) {
  return {
    backend: createK8sBackend(context.connection),
    persist: scopedPersist(context),
  };
}

async function getInventoryObject(context: CloudTreeActionContext): Promise<unknown> {
  const { backend, persist } = scopedContext(context);
  if (isClusterScopedNode(context)) {
    return getClusterObject(
      backend,
      persist,
      {
        groupVersion: objectTypeGroupVersionOf(context),
        resourceName: objectTypeNameOf(context),
        kind: objectKindOf(context),
      },
      objectNameOf(context),
    );
  }
  return getNamespacedObject(
    backend,
    persist,
    namespaceOf(context),
    {
      groupVersion: objectTypeGroupVersionOf(context),
      resourceName: objectTypeNameOf(context),
      kind: objectKindOf(context),
    },
    objectNameOf(context),
  );
}

type PodJson = {
  metadata?: { name?: string; namespace?: string };
  spec?: {
    containers?: Array<{ name: string; image?: string }>;
    initContainers?: Array<{ name: string; image?: string }>;
  };
  status?: {
    phase?: string;
    containerStatuses?: Array<{
      name: string;
      ready?: boolean;
      restartCount?: number;
      state?: unknown;
    }>;
    initContainerStatuses?: Array<{
      name: string;
      ready?: boolean;
      restartCount?: number;
      state?: unknown;
    }>;
  };
};

function findContainerStatus(pod: PodJson, containerName: string) {
  return (
    pod.status?.containerStatuses?.find((s) => s.name === containerName) ??
    pod.status?.initContainerStatuses?.find((s) => s.name === containerName)
  );
}

export function createK8sWorkloadHandler(providerId: string): CloudWorkloadHandler {
  return {
    providerId,

    getCapabilities(context): WorkloadCapabilities {
      if (isInventoryObjectNode(context)) {
        return { config: true, inspect: true };
      }
      return { logs: true, config: true, inspect: true };
    },

    async getStatus(context): Promise<WorkloadStatus> {
      if (isInventoryObjectNode(context)) {
        return {
          label: objectKindOf(context),
          detail: isClusterScopedNode(context)
            ? `${objectTypeNameOf(context)} · cluster-scoped`
            : `${objectTypeNameOf(context)} · ${namespaceOf(context)}`,
        };
      }

      const { backend, persist } = scopedContext(context);
      const pod = (await getPod(
        backend,
        persist,
        namespaceOf(context),
        podNameOf(context),
      )) as PodJson;
      const containerName = containerNameOf(context);
      const cs = findContainerStatus(pod, containerName);
      const ready = cs?.ready ? 'Ready' : 'Not ready';
      const restarts = cs?.restartCount ?? 0;
      return {
        label: ready,
        detail: `Pod ${pod.status?.phase ?? 'Unknown'} · ${restarts} restarts`,
      };
    },

    async fetchLogs(context, options) {
      const { backend, persist } = scopedContext(context);
      return getPodLogs(
        backend,
        persist,
        namespaceOf(context),
        podNameOf(context),
        {
          tailLines: options?.tail ?? 500,
          container: containerNameOf(context),
        },
      );
    },

    async fetchConfig(context): Promise<WorkloadConfigContent> {
      if (isInventoryObjectNode(context)) {
        const objectData = await getInventoryObject(context);
        return {
          language: 'yaml',
          text: jsonToYaml(objectData),
        };
      }

      const { backend, persist } = scopedContext(context);
      const pod = (await getPod(
        backend,
        persist,
        namespaceOf(context),
        podNameOf(context),
      )) as { metadata?: unknown; spec?: unknown };
      const containerName = containerNameOf(context);
      const spec = pod.spec as {
        containers?: Array<{ name: string }>;
        initContainers?: Array<{ name: string }>;
      } | undefined;
      const main = spec?.containers?.find((c) => c.name === containerName);
      const init = spec?.initContainers?.find((c) => c.name === containerName);
      const containerSpec = main ?? init;

      return {
        language: 'json',
        text: JSON.stringify(
          {
            metadata: pod.metadata,
            spec: pod.spec,
            selectedContainer: containerName,
            container: containerSpec,
          },
          null,
          2,
        ),
      };
    },

    async fetchInspect(context) {
      if (isInventoryObjectNode(context)) {
        return getInventoryObject(context);
      }

      const { backend, persist } = scopedContext(context);
      return getPod(
        backend,
        persist,
        namespaceOf(context),
        podNameOf(context),
      );
    },
  };
}
