import '@eclipse-docks/extension-monaco-editor/widget';
import { DocksPart, confirmDialog } from '@eclipse-docks/core';
import {
  createRef,
  css,
  customElement,
  html,
  nothing,
  property,
  ref,
  state,
} from '@eclipse-docks/core/externals/lit';
import type { PropertyValues } from '@eclipse-docks/core/externals/lit';
import { logsTextToTabular } from './workload-logs-tabular';
import { cloudConnectionService } from './cloud-connection-service';
import { cloudWorkloadRegistry } from './cloud-workload-registry';
import type { CloudWorkloadEditorInput } from './cloud-workload-opener';
import { evaluateDirectOperation } from './policy';
import { runCloudAction, toastCloudError } from './cloud-toast';
import type {
  CloudTreeActionContext,
  WorkloadCapabilities,
  WorkloadEditorTab,
  WorkloadLifecycleOp,
  WorkloadStatus,
} from './models';

@customElement('cloudadmin-workload-editor')
export class CloudAdminWorkloadEditor extends DocksPart {
  protected scrollMode: 'scroller' | 'native' = 'native';

  @property({ attribute: false })
  editorInput!: CloudWorkloadEditorInput;

  @state() private activeTab: WorkloadEditorTab = 'overview';
  @state() private status?: WorkloadStatus;
  @state() private statusError = '';
  @state() private logsText = '';
  @state() private logsError = '';
  @state() private logsLoading = false;
  @state() private configText = '';
  @state() private configLanguage = 'json';
  @state() private configError = '';
  @state() private configLoading = false;
  @state() private inspectText = '';
  @state() private inspectError = '';
  @state() private inspectLoading = false;
  @state() private lifecycleBusy = false;
  @state() private overviewLoading = false;

  connectedCallback(): void {
    this.isEditor = true;
    super.connectedCallback();
    this.activeTab = this.resolveInitialTab();
    this.ensureTabLoaded(this.activeTab);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('editorInput')) return;
    this.logsText = '';
    this.logsError = '';
    this.configText = '';
    this.configError = '';
    this.inspectText = '';
    this.inspectError = '';
    this.status = undefined;
    this.statusError = '';
  }

  private get context(): CloudTreeActionContext {
    const connection =
      cloudConnectionService.getConnection(this.editorInput.connection.id) ??
      this.editorInput.connection;
    return { connection, node: this.editorInput.node };
  }

  private get handler() {
    return cloudWorkloadRegistry.getHandler(this.editorInput.node.providerId);
  }

  private get capabilities(): WorkloadCapabilities {
    return this.handler?.getCapabilities(this.context) ?? {};
  }

  private resolveInitialTab(): WorkloadEditorTab {
    const requested = this.editorInput.initialTab ?? 'overview';
    const caps = this.handler?.getCapabilities(this.context) ?? {};
    if (requested === 'logs' && !caps.logs) return 'overview';
    if (requested === 'config' && !caps.config) return 'overview';
    if (requested === 'inspect' && !caps.inspect) return 'overview';
    return requested;
  }

  private ensureTabLoaded(tab: WorkloadEditorTab): void {
    if (tab === 'logs' && !this.logsText && !this.logsError && !this.logsLoading) {
      void this.loadLogs();
    }
    if (tab === 'config' && !this.configText && !this.configError && !this.configLoading) {
      void this.loadConfig();
    }
    if (tab === 'inspect' && !this.inspectText && !this.inspectError && !this.inspectLoading) {
      void this.loadInspect();
    }
    if (tab === 'overview' && !this.status && !this.statusError && !this.overviewLoading) {
      void this.loadOverview();
    }
  }

  private inspectMonacoRef = createRef<HTMLElement & { layout?: () => void }>();
  private configMonacoRef = createRef<HTMLElement & { layout?: () => void }>();

  private async layoutMonacoEditor(
    editorRef: typeof this.inspectMonacoRef,
  ): Promise<void> {
    await this.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    editorRef.value?.layout?.();
  }

  private onTabShow(event: CustomEvent<{ name: string }>): void {
    const name = event.detail?.name as WorkloadEditorTab;
    if (name !== 'overview' && name !== 'logs' && name !== 'config' && name !== 'inspect') {
      return;
    }
    this.activeTab = name;
    this.ensureTabLoaded(name);
    if (name === 'config') {
      void this.layoutMonacoEditor(this.configMonacoRef);
    }
    if (name === 'inspect') {
      void this.layoutMonacoEditor(this.inspectMonacoRef);
    }
  }

  private async loadOverview(): Promise<void> {
    const handler = this.handler;
    if (!handler?.getStatus) {
      this.status = { label: 'Unknown' };
      return;
    }
    this.overviewLoading = true;
    this.statusError = '';
    try {
      this.status = await handler.getStatus(this.context);
    } catch (err) {
      this.statusError = err instanceof Error ? err.message : String(err);
    } finally {
      this.overviewLoading = false;
    }
  }

  private async loadLogs(): Promise<void> {
    const handler = this.handler;
    if (!handler?.fetchLogs) return;
    this.logsLoading = true;
    this.logsError = '';
    try {
      this.logsText = await handler.fetchLogs(this.context, { tail: 500 });
    } catch (err) {
      this.logsText = '';
      this.logsError = err instanceof Error ? err.message : String(err);
    } finally {
      this.logsLoading = false;
    }
  }

  private async loadConfig(): Promise<void> {
    const handler = this.handler;
    if (!handler?.fetchConfig) return;
    this.configLoading = true;
    this.configError = '';
    try {
      const content = await handler.fetchConfig(this.context);
      this.configText = content.text;
      this.configLanguage = content.language ?? 'json';
    } catch (err) {
      this.configText = '';
      this.configError = err instanceof Error ? err.message : String(err);
    } finally {
      this.configLoading = false;
      if (this.activeTab === 'config') {
        void this.layoutMonacoEditor(this.configMonacoRef);
      }
    }
  }

  private async loadInspect(): Promise<void> {
    const handler = this.handler;
    if (!handler?.fetchInspect) return;
    this.inspectLoading = true;
    this.inspectError = '';
    try {
      const data = await handler.fetchInspect(this.context);
      this.inspectText = JSON.stringify(data, null, 2);
    } catch (err) {
      this.inspectText = '';
      this.inspectError = err instanceof Error ? err.message : String(err);
    } finally {
      this.inspectLoading = false;
      if (this.activeTab === 'inspect') {
        void this.layoutMonacoEditor(this.inspectMonacoRef);
      }
    }
  }

  private canLifecycle(op: WorkloadLifecycleOp): boolean {
    if (!this.capabilities.lifecycle?.includes(op)) return false;
    const decision = evaluateDirectOperation(`cloud.workload.${op}`);
    return decision.allowed;
  }

  private async runLifecycle(op: WorkloadLifecycleOp): Promise<void> {
    const handler = this.handler;
    if (!handler?.lifecycle || !this.canLifecycle(op)) return;
    if (op === 'stop') {
      const ok = await confirmDialog(`Stop "${this.editorInput.node.label}"?`);
      if (!ok) return;
    }
    this.lifecycleBusy = true;
    try {
      await handler.lifecycle(this.context, op);
      await this.loadOverview();
    } catch (err) {
      toastCloudError(err);
    } finally {
      this.lifecycleBusy = false;
    }
  }

  private renderLifecycleToolbar() {
    if (this.activeTab !== 'overview') return nothing;
    const ops: Array<{ op: WorkloadLifecycleOp; label: string; icon: string }> = [
      { op: 'start', label: 'Start', icon: 'play' },
      { op: 'stop', label: 'Stop', icon: 'stop' },
      { op: 'restart', label: 'Restart', icon: 'arrows-rotate' },
    ];
    const available = ops.filter((o) => this.canLifecycle(o.op));
    if (available.length === 0) return nothing;
    return available.map(
      (o) => html`
        <docks-command
          icon=${o.icon}
          title=${o.label}
          appearance="plain"
          ?disabled=${this.lifecycleBusy}
          .action=${() => void runCloudAction(() => this.runLifecycle(o.op))}
        ></docks-command>
      `,
    );
  }

  private renderTabRefreshToolbar() {
    if (this.activeTab === 'logs' && this.capabilities.logs) {
      return html`
        <docks-command
          icon="arrows-rotate"
          title="Refresh logs"
          appearance="plain"
          ?disabled=${this.logsLoading}
          .action=${() => void this.loadLogs()}
        ></docks-command>
      `;
    }
    if (this.activeTab === 'config' && this.capabilities.config) {
      return html`
        <docks-command
          icon="arrows-rotate"
          title="Refresh config"
          appearance="plain"
          ?disabled=${this.configLoading}
          .action=${() => void this.loadConfig()}
        ></docks-command>
      `;
    }
    if (this.activeTab === 'inspect' && this.capabilities.inspect) {
      return html`
        <docks-command
          icon="arrows-rotate"
          title="Refresh inspect"
          appearance="plain"
          ?disabled=${this.inspectLoading}
          .action=${() => void this.loadInspect()}
        ></docks-command>
      `;
    }
    return nothing;
  }

  protected renderToolbar() {
    return html`${this.renderLifecycleToolbar()}${this.renderTabRefreshToolbar()}`;
  }

  private renderOverview() {
    if (!this.handler) {
      return html`<p class="muted">No workload handler for this provider.</p>`;
    }
    if (this.overviewLoading) {
      return html`<p class="muted">Loading…</p>`;
    }
    if (this.statusError) {
      return html`<p class="error-text">${this.statusError}</p>`;
    }
    const meta = this.editorInput.node.meta;
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

  private renderLogsPanel() {
    if (!this.capabilities.logs) {
      return html`<p class="muted">Logs are not available for this workload.</p>`;
    }
    return html`
      <div class="panel-body">
        ${this.logsLoading
          ? html`<p class="muted">Loading logs…</p>`
          : this.logsError
            ? html`<p class="error-text">${this.logsError}</p>`
            : html`
                <docks-data-table
                  .data=${logsTextToTabular(this.logsText)}
                  emptyMessage="No log output."
                ></docks-data-table>
              `}
      </div>
    `;
  }

  private renderMonacoPanel(options: {
    enabled: boolean;
    unavailableMessage: string;
    tab: WorkloadEditorTab;
    loading: boolean;
    error: string;
    text: string;
    language: string;
    editorRef: ReturnType<typeof createRef<HTMLElement & { layout?: () => void }>>;
  }) {
    if (!options.enabled) {
      return html`<p class="muted">${options.unavailableMessage}</p>`;
    }
    const showEditor =
      this.activeTab === options.tab &&
      !options.loading &&
      !options.error &&
      !!options.text;
    return html`
      <div class="panel-body panel-body--monaco">
        ${options.loading
          ? html`<p class="muted">Loading…</p>`
          : options.error
            ? html`<p class="error-text">${options.error}</p>`
            : showEditor
              ? html`
                  <div class="monaco-editor-host">
                    <docks-monaco-widget
                      ${ref(options.editorRef)}
                      .value=${options.text}
                      language=${options.language}
                      .readOnly=${true}
                      auto-layout
                    ></docks-monaco-widget>
                  </div>
                `
              : nothing}
      </div>
    `;
  }

  private renderConfigPanel() {
    return this.renderMonacoPanel({
      enabled: Boolean(this.capabilities.config),
      unavailableMessage: 'Config is not available for this workload.',
      tab: 'config',
      loading: this.configLoading,
      error: this.configError,
      text: this.configText,
      language: this.configLanguage,
      editorRef: this.configMonacoRef,
    });
  }

  private renderInspectPanel() {
    return this.renderMonacoPanel({
      enabled: Boolean(this.capabilities.inspect),
      unavailableMessage: 'Inspect is not available for this workload.',
      tab: 'inspect',
      loading: this.inspectLoading,
      error: this.inspectError,
      text: this.inspectText,
      language: 'json',
      editorRef: this.inspectMonacoRef,
    });
  }

  protected renderContent() {
    const caps = this.capabilities;
    return html`
      <div class="workload-editor">
        <wa-tab-group
          class="workload-tabs"
          active=${this.activeTab}
          placement="bottom"
          @wa-tab-show=${(event: CustomEvent<{ name: string }>) => this.onTabShow(event)}
        >
          <wa-tab slot="nav" panel="overview">Overview</wa-tab>
          ${caps.logs ? html`<wa-tab slot="nav" panel="logs">Logs</wa-tab>` : nothing}
          ${caps.config ? html`<wa-tab slot="nav" panel="config">Config</wa-tab>` : nothing}
          ${caps.inspect ? html`<wa-tab slot="nav" panel="inspect">Inspect</wa-tab>` : nothing}

          <wa-tab-panel name="overview">${this.renderOverview()}</wa-tab-panel>
          ${caps.logs
            ? html`<wa-tab-panel name="logs">${this.renderLogsPanel()}</wa-tab-panel>`
            : nothing}
          ${caps.config
            ? html`<wa-tab-panel name="config">${this.renderConfigPanel()}</wa-tab-panel>`
            : nothing}
          ${caps.inspect
            ? html`<wa-tab-panel name="inspect">${this.renderInspectPanel()}</wa-tab-panel>`
            : nothing}
        </wa-tab-group>
      </div>
    `;
  }

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
      }

      .workload-editor {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
      }

      .workload-tabs {
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
      }

      .workload-tabs::part(base) {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }

      .workload-tabs::part(body) {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      /* wa-tab-group (placement=bottom) sets --padding: var(--wa-space-xl) 0 on panels */
      .workload-tabs wa-tab-panel {
        --padding: 0;
        box-sizing: border-box;
      }

      /* Do not set display on inactive panels — it overrides wa-tab-group hiding. */
      wa-tab-panel:not([active]) {
        display: none !important;
      }

      wa-tab-panel[active] {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      wa-tab-panel[active]::part(base) {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
        box-sizing: border-box;
      }

      wa-tab-panel[name='overview'][active] {
        overflow: auto;
      }

      wa-tab-panel[name='overview'][active]::part(base) {
        overflow: auto;
      }

      .panel-body {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .panel-body--monaco {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .monaco-editor-host {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .panel-body docks-data-table,
      .monaco-editor-host docks-monaco-widget {
        flex: 1 1 0;
        min-height: 0;
        width: 100%;
        height: 100%;
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
    'cloudadmin-workload-editor': CloudAdminWorkloadEditor;
  }
}
