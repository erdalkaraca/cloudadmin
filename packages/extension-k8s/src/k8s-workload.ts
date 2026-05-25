import type {
  CloudTreeActionContext,
  CloudWorkloadHandler,
  WorkloadCapabilities,
  WorkloadStatus,
} from 'extension-cloud/api';
import { PROVIDER_ID } from './provider';
import { getPod, getPodLogs, type K8sPersistData } from './api/k8s-client';

function persistOf(connection: CloudTreeActionContext['connection']): K8sPersistData {
  const d = connection.persistData;
  return {
    serverUrl: String(d.serverUrl ?? ''),
    context: d.context != null ? String(d.context) : undefined,
    insecureSkipTlsVerify: Boolean(d.insecureSkipTlsVerify),
  };
}

function namespaceOf(context: CloudTreeActionContext): string {
  const ns = context.node.meta?.namespace;
  if (typeof ns === 'string' && ns) return ns;
  throw new Error('Namespace missing on pod tree node.');
}

function podNameOf(context: CloudTreeActionContext): string {
  const name = context.node.meta?.podName;
  if (typeof name === 'string' && name) return name;
  const label = context.node.label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (label) return label;
  throw new Error('Pod name missing on tree node.');
}

export const k8sWorkloadHandler: CloudWorkloadHandler = {
  providerId: PROVIDER_ID,

  getCapabilities(): WorkloadCapabilities {
    return { logs: true, inspect: true };
  },

  async getStatus(context): Promise<WorkloadStatus> {
    const phase = String(context.node.meta?.phase ?? 'Unknown');
    return { label: phase };
  },

  async fetchLogs(context, options) {
    const persist = persistOf(context.connection);
    return getPodLogs(
      context.connection.id,
      persist,
      namespaceOf(context),
      podNameOf(context),
      options?.tail ?? 500,
    );
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
