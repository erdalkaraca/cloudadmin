import { activeEditorSignal, activePartSignal } from '@eclipse-docks/core';
import type { CloudTreeActionContext, WorkloadCapabilities } from '../models';
import { cloudConnectionService } from '../cloud-connection-service';
import { cloudWorkloadRegistry } from '../cloud-workload-registry';
import { CloudAdminWorkloadEditor } from './shell';

function workloadShellFrom(start: Element | null): CloudAdminWorkloadEditor | null {
  let current: Element | null = start;
  while (current) {
    if (current instanceof CloudAdminWorkloadEditor) {
      return current;
    }
    const parent = current.parentElement;
    if (parent) {
      current = parent;
    } else {
      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? (root.host as Element) : null;
    }
  }
  return null;
}

function activeWorkloadShell(): CloudAdminWorkloadEditor | null {
  return (
    workloadShellFrom(activePartSignal.get()) ??
    (activeEditorSignal.get() instanceof CloudAdminWorkloadEditor
      ? activeEditorSignal.get()
      : null)
  );
}

export function getActiveWorkloadContext(): CloudTreeActionContext | undefined {
  const input = activeWorkloadShell()?.editorInput;
  if (!input) return undefined;
  const connection =
    cloudConnectionService.getConnection(input.connection.id) ?? input.connection;
  return { connection, node: input.node };
}

export function getActiveWorkloadCapabilities(): WorkloadCapabilities {
  const ctx = getActiveWorkloadContext();
  if (!ctx) return {};
  return cloudWorkloadRegistry.getHandler(ctx.connection.providerId)?.getCapabilities(ctx) ?? {};
}

export function workloadTabVisible(
  capability: keyof Pick<WorkloadCapabilities, 'logs' | 'config' | 'inspect'>,
): boolean {
  return Boolean(getActiveWorkloadCapabilities()[capability]);
}
