import '@eclipse-docks/extension-monaco-editor/widget';
import { confirmDialog } from '@eclipse-docks/core';
import { css, customElement, html, nothing } from '@eclipse-docks/core/externals/lit';
import { state } from '@eclipse-docks/core/externals/lit';
import type { WorkloadLifecycleOp, WorkloadStatus } from '../../models';
import { evaluateDirectOperation } from '../../policy';
import { runCloudAction, toastCloudError } from '../../cloud-toast';
import { cloudWorkloadRegistry } from '../../cloud-workload-registry';
import { CloudWorkloadTabPart } from '../tab-base';

@customElement('cloudadmin-workload-tab-overview')
export class CloudWorkloadTabOverview extends CloudWorkloadTabPart {
  @state() private status?: WorkloadStatus;
  @state() private statusError = '';
  @state() private lifecycleBusy = false;

  protected override resetState(): void {
    this.status = undefined;
    this.statusError = '';
  }

  protected override async load(): Promise<void> {
    const handler = this.handler;
    if (!handler?.getStatus) {
      this.status = { label: 'Unknown' };
      return;
    }
    this.statusError = '';
    try {
      this.status = await handler.getStatus(this.context);
    } catch (err) {
      this.statusError = err instanceof Error ? err.message : String(err);
    }
  }

  private canLifecycle(op: WorkloadLifecycleOp): boolean {
    const caps = this.capabilities;
    if (!caps.lifecycle?.includes(op)) return false;
    return evaluateDirectOperation(`cloud.workload.${op}`).allowed;
  }

  private async runLifecycle(op: WorkloadLifecycleOp): Promise<void> {
    const handler = this.handler;
    if (!handler?.lifecycle || !this.canLifecycle(op)) return;
    if (op === 'stop') {
      const ok = await confirmDialog(`Stop "${this.editorInput?.node.label}"?`);
      if (!ok) return;
    }
    this.lifecycleBusy = true;
    try {
      await handler.lifecycle(this.context, op);
      await this.reload();
    } catch (err) {
      toastCloudError(err);
    } finally {
      this.lifecycleBusy = false;
    }
  }

  protected renderToolbar() {
    const ops: Array<{ op: WorkloadLifecycleOp; label: string; icon: string }> = [
      { op: 'start', label: 'Start', icon: 'play' },
      { op: 'stop', label: 'Stop', icon: 'stop' },
      { op: 'restart', label: 'Restart', icon: 'arrows-rotate' },
    ];
    return html`${ops
      .filter((o) => this.canLifecycle(o.op))
      .map(
        (o) => html`
          <docks-command
            icon=${o.icon}
            title=${o.label}
            appearance="plain"
            ?disabled=${this.lifecycleBusy}
            .action=${() => void runCloudAction(() => this.runLifecycle(o.op))}
          ></docks-command>
        `,
      )}`;
  }

  protected renderContent() {
    if (!this.editorInput) {
      return html`<p class="muted">Loading…</p>`;
    }
    if (!cloudWorkloadRegistry.getHandler(this.context.connection.providerId)) {
      return html`<p class="muted">No workload handler for this provider.</p>`;
    }
    if (this.statusError) {
      return html`<p class="error-text">${this.statusError}</p>`;
    }
    const meta = this.editorInput?.node.meta;
    return html`
      <dl class="overview-dl">
        <dt>Status</dt>
        <dd>${this.status?.label ?? '—'}</dd>
        ${this.status?.detail
          ? html`
              <dt>Detail</dt>
              <dd>${this.status.detail}</dd>
            `
          : nothing}
        <dt>Connection</dt>
        <dd>${this.context.connection.name}</dd>
        <dt>Provider</dt>
        <dd>${this.context.connection.providerId}</dd>
        ${meta && Object.keys(meta).length > 0
          ? html`
              <dt>Metadata</dt>
              <dd><pre class="meta-pre">${JSON.stringify(meta, null, 2)}</pre></dd>
            `
          : nothing}
      </dl>
    `;
  }

  static styles = [
    css`
      .part-content {
        overflow: auto;
        padding: var(--wa-space-m);
        box-sizing: border-box;
      }

      .overview-dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.35rem 1rem;
        margin: 0;
      }

      .overview-dl dt {
        font-weight: 500;
        color: var(--wa-color-text-quiet);
      }

      .overview-dl dd {
        margin: 0;
      }

      .meta-pre {
        margin: 0;
        font-family: var(--wa-font-family-mono, monospace);
        font-size: var(--wa-font-size-s);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .muted {
        color: var(--wa-color-text-quiet);
      }

      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'cloudadmin-workload-tab-overview': CloudWorkloadTabOverview;
  }
}
