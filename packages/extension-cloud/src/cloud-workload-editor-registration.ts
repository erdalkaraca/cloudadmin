import { editorRegistry, type EditorInput } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';
import './cloud-workload-editor';
import {
  CLOUD_WORKLOAD_EDITOR_ID,
  isCloudWorkloadEditorInput,
  type CloudWorkloadEditorInput,
} from './cloud-workload-opener';

export function registerCloudWorkloadEditor(): void {
  editorRegistry.registerEditorInputHandler({
    editorId: CLOUD_WORKLOAD_EDITOR_ID,
    label: 'Cloud workload',
    icon: 'box',
    ranking: 50,
    canHandle: (input) => isCloudWorkloadEditorInput(input),
    handle: async (input) => {
      const workloadInput = input as CloudWorkloadEditorInput;
      const key = `cloudadmin:workload:${workloadInput.node.nodeId}`;
      const editorInput: EditorInput = {
        key,
        title: workloadInput.node.label,
        icon: workloadInput.node.icon ?? 'box',
        data: workloadInput,
        state: {},
        component: (id: string) => html`
          <cloudadmin-workload-editor
            id="${id}"
            .editorInput=${workloadInput}
          ></cloudadmin-workload-editor>
        `,
      };
      return editorInput;
    },
  });
}
