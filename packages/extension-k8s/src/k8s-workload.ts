import type {
  CloudTreeActionContext,
  CloudWorkloadHandler,
  WorkloadCapabilities,
  WorkloadConfigContent,
  WorkloadStatus,
} from 'extension-cloud/api';
import { PROVIDER_ID } from './provider';
import { getPod, getPodLogs, type K8sPersistData } from './api/k8s-client';

function persistOf(connection: CloudTreeActionContext['connection']): K8sPersistData {
  const d = connection.persistData;
  return {
    serverUrl: String(d.serverUrl ?? ''),
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

export const k8sWorkloadHandler: CloudWorkloadHandler = {
  providerId: PROVIDER_ID,

  getCapabilities(): WorkloadCapabilities {
    return { logs: true, config: true, inspect: true };
  },

  async getStatus(context): Promise<WorkloadStatus> {
    const persist = persistOf(context.connection);
    const pod = (await getPod(
      context.connection.id,
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
    const persist = persistOf(context.connection);
    return getPodLogs(
      context.connection.id,
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
    const persist = persistOf(context.connection);
    const pod = (await getPod(
      context.connection.id,
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
    const persist = persistOf(context.connection);
    return getPod(
      context.connection.id,
      persist,
      namespaceOf(context),
      podNameOf(context),
    );
  },
};
