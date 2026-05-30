import '@eclipse-docks/extension-monaco-editor/widget';
import { createRef, css, customElement, html, ref } from '@eclipse-docks/core/externals/lit';
import { state } from '@eclipse-docks/core/externals/lit';
import { CloudWorkloadTabPart } from '../tab-base';

@customElement('cloudadmin-workload-tab-config')
export class CloudWorkloadTabConfig extends CloudWorkloadTabPart {
  @state() private text = '';
  @state() private language = 'json';
  @state() private error = '';

  private monacoRef = createRef<HTMLElement & { layout?: () => void }>();

  protected override resetState(): void {
    this.text = '';
    this.error = '';
  }

  protected override async load(): Promise<void> {
    if (!this.capabilities.config) {
      this.error = 'Config is not available for this workload.';
      return;
    }
    const handler = this.handler;
    if (!handler?.fetchConfig) {
      this.error = 'Config is not available for this workload.';
      return;
    }
    this.error = '';
    try {
      const content = await handler.fetchConfig(this.context);
      this.text = content.text;
      this.language = content.language ?? 'json';
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
        title="Refresh config"
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
      <docks-monaco-widget
        ${ref(this.monacoRef)}
        .value=${this.text}
        language=${this.language}
        .readOnly=${true}
        auto-layout
      ></docks-monaco-widget>
    `;
  }

  static styles = [
    css`
      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
        padding: var(--wa-space-m);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'cloudadmin-workload-tab-config': CloudWorkloadTabConfig;
  }
}
