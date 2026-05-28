import '@eclipse-docks/extension-monaco-editor/widget';
import { createRef, css, customElement, html, ref } from '@eclipse-docks/core/externals/lit';
import { state } from '@eclipse-docks/core/externals/lit';
import { CloudWorkloadTabPart } from '../tab-base';

@customElement('cloudadmin-workload-tab-inspect')
export class CloudWorkloadTabInspect extends CloudWorkloadTabPart {
  @state() private text = '';
  @state() private error = '';

  private monacoRef = createRef<HTMLElement & { layout?: () => void }>();

  protected override resetState(): void {
    this.text = '';
    this.error = '';
  }

  protected override async load(): Promise<void> {
    if (!this.capabilities.inspect) {
      this.error = 'Inspect is not available for this workload.';
      return;
    }
    const handler = this.handler;
    if (!handler?.fetchInspect) {
      this.error = 'Inspect is not available for this workload.';
      return;
    }
    this.error = '';
    try {
      const data = await handler.fetchInspect(this.context);
      this.text = JSON.stringify(data, null, 2);
    } catch (err) {
      this.text = '';
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  protected override async afterTabShown(): Promise<void> {
    await this.layoutMonaco();
  }

  private async layoutMonaco(): Promise<void> {
    if (!this.tabRevealed || !this.text) return;
    await this.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.monacoRef.value?.layout?.();
  }

  protected renderToolbar() {
    return html`
      <docks-command
        icon="arrows-rotate"
        title="Refresh inspect"
        appearance="plain"
        .action=${() => void this.reload()}
      ></docks-command>
    `;
  }

  protected renderContent() {
    if (!this.editorInput) {
      return this.renderLoading();
    }
    if (!this.loaded && !this.error) {
      return this.renderLoading();
    }
    if (this.error) {
      return html`<p class="error-text">${this.error}</p>`;
    }
    if (!this.tabRevealed) {
      return this.renderLoading();
    }
    return html`
      <div class="monaco-editor-host">
        <docks-monaco-widget
          ${ref(this.monacoRef)}
          .value=${this.text}
          language="json"
          .readOnly=${true}
          auto-layout
        ></docks-monaco-widget>
      </div>
    `;
  }

  static styles = [
    css`
      .monaco-editor-host {
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      docks-monaco-widget {
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
      }

      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
        padding: var(--wa-space-m);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'cloudadmin-workload-tab-inspect': CloudWorkloadTabInspect;
  }
}
