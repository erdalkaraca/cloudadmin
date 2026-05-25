import { activeSelectionSignal } from '@eclipse-docks/core';
import type { CloudTreeNodeKind, Resource, ScopeContext } from './models';

export interface CloudSelectionData {
  cloudRef: {
    nodeId: string;
    connectionId: string;
    providerId: string;
    kind: CloudTreeNodeKind;
    label: string;
    resourceId?: string;
  };
  connection: { id: string; name: string; providerId: string };
}

function isCloudSelection(data: unknown): data is CloudSelectionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'cloudRef' in data &&
    'connection' in data
  );
}

export function selectionToScopeContext(selection: unknown): ScopeContext | undefined {
  if (!isCloudSelection(selection)) return undefined;
  const resource: Resource | undefined = selection.cloudRef.resourceId
    ? {
        provider: selection.connection.providerId,
        type: selection.cloudRef.kind,
        id: selection.cloudRef.resourceId,
        name: selection.cloudRef.label,
      }
    : undefined;
  return {
    connectionId: selection.connection.id,
    providerId: selection.connection.providerId,
    nodeId: selection.cloudRef.nodeId,
    kind: selection.cloudRef.kind,
    label: `${selection.connection.name} / ${selection.cloudRef.label}`,
    resource,
  };
}

export function getScopeContext(): ScopeContext | undefined {
  return selectionToScopeContext(activeSelectionSignal.get());
}
