import { editorRegistry } from '@eclipse-docks/core';
import type { CloudConnection, CloudTreeNodeRef, WorkloadEditorTab } from './models';

export const CLOUD_WORKLOAD_EDITOR_INPUT_TYPE = 'cloudadmin-workload' as const;
export const CLOUD_WORKLOAD_EDITOR_ID = 'cloudadmin-workload-editor';

export interface CloudWorkloadEditorInput {
  type: typeof CLOUD_WORKLOAD_EDITOR_INPUT_TYPE;
  connection: CloudConnection;
  node: CloudTreeNodeRef;
  initialTab?: WorkloadEditorTab;
}

export function isCloudWorkloadEditorInput(
  input: unknown,
): input is CloudWorkloadEditorInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as CloudWorkloadEditorInput).type === CLOUD_WORKLOAD_EDITOR_INPUT_TYPE
  );
}

export async function openWorkloadEditor(
  connection: CloudConnection,
  node: CloudTreeNodeRef,
  initialTab: WorkloadEditorTab = 'overview',
): Promise<void> {
  const input: CloudWorkloadEditorInput = {
    type: CLOUD_WORKLOAD_EDITOR_INPUT_TYPE,
    connection,
    node,
    initialTab,
  };
  await editorRegistry.loadEditor(input, CLOUD_WORKLOAD_EDITOR_ID);
}
