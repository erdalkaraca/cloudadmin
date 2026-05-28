import { DocksPart } from '@eclipse-docks/core';
import { css, customElement, html, nothing, property } from '@eclipse-docks/core/externals/lit';
import type { CloudWorkloadEditorInput } from '../cloud-workload-opener';
import { WORKLOAD_EDITOR_TABS_ID } from './constants';

@customElement('cloudadmin-workload-editor')
export class CloudAdminWorkloadEditor extends DocksPart {
  protected scrollMode: 'scroller' | 'native' = 'native';

  @property({ attribute: false })
  editorInput!: CloudWorkloadEditorInput;

  protected renderContent() {
    return html`
      <docks-tabs id=${WORKLOAD_EDITOR_TABS_ID} placement="bottom"></docks-tabs>
    `;
  }

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        min-height: 0;
        box-sizing: border-box;
      }

      .part-shell {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
        width: 100%;
      }

      .part-toolbar {
        display: none;
      }

      .part-content {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .part-content-inner {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
      }

      docks-tabs {
        flex: 1 1 0;
        min-height: 0;
        width: 100%;
        height: 100%;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'cloudadmin-workload-editor': CloudAdminWorkloadEditor;
  }
}
