import { css, customElement, html } from '@eclipse-docks/core/externals/lit';
import { state } from '@eclipse-docks/core/externals/lit';
import { logsTextToTabular } from '../../workload-logs-tabular';
import { CloudWorkloadTabPart } from '../tab-base';

@customElement('cloudadmin-workload-tab-logs')
export class CloudWorkloadTabLogs extends CloudWorkloadTabPart {
  @state() private logsText = '';
  @state() private logsError = '';

  protected override resetState(): void {
    this.logsText = '';
    this.logsError = '';
  }

  protected override async load(): Promise<void> {
    if (!this.capabilities.logs) {
      this.logsError = 'Logs are not available for this workload.';
      return;
    }
    const handler = this.handler;
    if (!handler?.fetchLogs) {
      this.logsError = 'Logs are not available for this workload.';
      return;
    }
    this.logsError = '';
    try {
      this.logsText = await handler.fetchLogs(this.context, { tail: 500 });
    } catch (err) {
      this.logsText = '';
      this.logsError = err instanceof Error ? err.message : String(err);
    }
  }

  protected renderToolbar() {
    return html`
      <docks-command
        icon="arrows-rotate"
        title="Refresh logs"
        appearance="plain"
        .action=${() => void this.reload()}
      ></docks-command>
    `;
  }

  protected override async afterTabShown(): Promise<void> {
    this.requestUpdate();
  }

  protected renderContent() {
    if (!this.editorInput || (!this.loaded && !this.logsError)) {
      return this.renderLoading();
    }
    if (!this.tabRevealed) {
      return this.renderLoading();
    }
    if (this.logsError) {
      return html`<p class="error-text">${this.logsError}</p>`;
    }
    return html`
      <docks-data-table
        .data=${logsTextToTabular(this.logsText)}
        emptyMessage="No log output."
      ></docks-data-table>
    `;
  }

  static styles = [
    css`
      docks-data-table {
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
    'cloudadmin-workload-tab-logs': CloudWorkloadTabLogs;
  }
}
