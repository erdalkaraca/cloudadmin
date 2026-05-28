import { DocksPart } from '@eclipse-docks/core';
import { css, html } from '@eclipse-docks/core/externals/lit';
import { state } from '@eclipse-docks/core/externals/lit';
import type { CloudTreeActionContext } from '../models';
import { cloudConnectionService } from '../cloud-connection-service';
import { cloudWorkloadRegistry } from '../cloud-workload-registry';
import type { CloudWorkloadHandler, WorkloadCapabilities } from '../models';
import type { CloudWorkloadEditorInput } from '../cloud-workload-opener';
import { CloudAdminWorkloadEditor } from './shell';

export abstract class CloudWorkloadTabPart extends DocksPart {
  protected scrollMode: 'scroller' | 'native' = 'native';

  @state() protected loaded = false;
  /** True once this panel is (or was) the active `wa-tab-panel` — avoids mounting Monaco while `display: none`. */
  @state() protected tabRevealed = false;

  private tabShowListener?: (event: Event) => void;

  protected get workloadShell(): CloudAdminWorkloadEditor | null {
    return this.findWorkloadShell(this);
  }

  protected get editorInput(): CloudWorkloadEditorInput | undefined {
    return this.workloadShell?.editorInput;
  }

  protected get context(): CloudTreeActionContext {
    const input = this.editorInput;
    if (!input) throw new Error('No workload editor.');
    const connection =
      cloudConnectionService.getConnection(input.connection.id) ?? input.connection;
    return { connection, node: input.node };
  }

  protected get handler(): CloudWorkloadHandler | undefined {
    return cloudWorkloadRegistry.getHandler(this.context.connection.providerId);
  }

  /** Capabilities for this tab's workload (from the enclosing editor shell). */
  protected get capabilities(): WorkloadCapabilities {
    if (!this.editorInput) return {};
    return this.handler?.getCapabilities(this.context) ?? {};
  }

  protected renderLoading() {
    return html`<p class="muted">Loading…</p>`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncTabRevealed();
    this.tabShowListener = (event: Event) => {
      const name = (event as CustomEvent<{ name?: string }>).detail?.name;
      if (name && name === this.tabContribution?.name) void this.onTabShown();
    };
    this.closest('wa-tab-group')?.addEventListener('wa-tab-show', this.tabShowListener);
    if (this.tabRevealed) void this.onTabShown();
  }

  override disconnectedCallback(): void {
    if (this.tabShowListener) {
      this.closest('wa-tab-group')?.removeEventListener('wa-tab-show', this.tabShowListener);
    }
    super.disconnectedCallback();
  }

  private syncTabRevealed(): void {
    const panel = this.closest('wa-tab-panel');
    if (panel?.hasAttribute('active')) {
      this.tabRevealed = true;
    }
  }

  protected async onTabShown(): Promise<void> {
    this.tabRevealed = true;
    await this.ensureLoaded();
    await this.afterTabShown();
    this.requestUpdate();
  }

  /** Hook for tabs that need a layout pass when their panel becomes visible (e.g. Monaco). */
  protected async afterTabShown(): Promise<void> {}

  protected resetState(): void {}

  protected async ensureLoaded(): Promise<void> {
    if (!this.editorInput || this.loaded) return;
    await this.load();
    this.loaded = true;
    this.requestUpdate();
  }

  protected abstract load(): Promise<void>;

  /** Reload after toolbar refresh or lifecycle actions. */
  protected async reload(): Promise<void> {
    this.loaded = false;
    await this.ensureLoaded();
    await this.afterTabShown();
    this.requestUpdate();
  }

  /** Crosses shadow roots to the enclosing workload editor shell. */
  private findWorkloadShell(start: Element | null): CloudAdminWorkloadEditor | null {
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

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
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
        flex: 0 0 auto;
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

      .muted {
        color: var(--wa-color-text-quiet);
        padding: var(--wa-space-m);
      }
    `,
  ];
}
