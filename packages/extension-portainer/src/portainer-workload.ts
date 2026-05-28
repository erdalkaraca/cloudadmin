import type {
  CloudTreeActionContext,
  CloudWorkloadHandler,
  WorkloadCapabilities,
  WorkloadConfigContent,
  WorkloadLifecycleOp,
  WorkloadStatus,
} from 'extension-cloud/api';
import { PROVIDER_ID } from './provider';
import {
  containerLifecycle,
  getContainerLogs,
  inspectContainer,
  type PortainerPersistData,
} from './api/portainer-client';
import { configJsonFromInspect, dockerfileFromInspect } from './portainer-config';

function persistOf(connection: CloudTreeActionContext['connection']): PortainerPersistData {
  return { serverUrl: String(connection.persistData.serverUrl ?? '') };
}

function endpointId(context: CloudTreeActionContext): number {
  return Number(context.node.meta?.endpointId ?? 0);
}

function containerId(context: CloudTreeActionContext): string {
  const id = context.node.resourceId;
  if (!id) throw new Error('Container id missing on tree node.');
  return id;
}

function normalizedState(context: CloudTreeActionContext): string {
  return String(context.node.meta?.state ?? '').toLowerCase();
}

function lifecycleForState(state: string): WorkloadLifecycleOp[] {
  if (state === 'running') return ['stop', 'restart'];
  if (state === 'exited' || state === 'created' || state === 'paused') return ['start'];
  return ['start', 'stop', 'restart'];
}

export const portainerWorkloadHandler: CloudWorkloadHandler = {
  providerId: PROVIDER_ID,

  getCapabilities(context): WorkloadCapabilities {
    const state = normalizedState(context);
    return {
      logs: true,
      config: true,
      inspect: true,
      lifecycle: lifecycleForState(state),
    };
  },

  async getStatus(context): Promise<WorkloadStatus> {
    const state = String(context.node.meta?.state ?? 'unknown');
    const status = context.node.meta?.status;
    return {
      label: state,
      detail: typeof status === 'string' ? status : undefined,
    };
  },

  async fetchLogs(context, options) {
    const persist = persistOf(context.connection);
    return getContainerLogs(
      context.connection.id,
      persist,
      endpointId(context),
      containerId(context),
      options?.tail ?? 500,
    );
  },

  async fetchConfig(context): Promise<WorkloadConfigContent> {
    const persist = persistOf(context.connection);
    const inspect = await inspectContainer(
      context.connection.id,
      persist,
      endpointId(context),
      containerId(context),
    );
    const dockerfile = dockerfileFromInspect(inspect);
    if (dockerfile) {
      return { language: 'dockerfile', text: dockerfile };
    }
    return { language: 'json', text: configJsonFromInspect(inspect) };
  },

  async fetchInspect(context) {
    const persist = persistOf(context.connection);
    return inspectContainer(
      context.connection.id,
      persist,
      endpointId(context),
      containerId(context),
    );
  },

  async lifecycle(context, operation) {
    const persist = persistOf(context.connection);
    await containerLifecycle(
      context.connection.id,
      persist,
      endpointId(context),
      containerId(context),
      operation,
    );
  },
};
