import {
  DocksPart,
  SIDEBAR_MAIN,
  activeSelectionSignal,
  contributionRegistry,
  icon,
  subscribe,
  unsubscribe,
  type TreeNode,
} from '@eclipse-docks/core';
import {
  createRef,
  css,
  customElement,
  html,
  nothing,
  ref,
  state,
  type TemplateResult,
} from '@eclipse-docks/core/externals/lit';
import {
  CloudTreeNodeKind,
  defaultIconForKind,
  type CloudConnection,
  type CloudTreeAction,
  type CloudTreeNodeRef,
} from './models';
import { CLOUD_CONNECTIONS_DROPDOWN } from './cloud-connections-dropdown';
import { confirmDialog, formDialogRequired } from '@eclipse-docks/core';
import { runCloudAction, toastCloudError } from './cloud-toast';
import { cloudConnectionService } from './cloud-connection-service';
import { openWorkloadEditor } from './cloud-workload-opener';
import { cloudTreeRegistry } from './cloud-tree-registry';
import { TOPIC_CLOUD_CONNECTIONS_CHANGED } from './api';

const VIEW_CLOUD = 'view.cloud';
const EMPTY_MESSAGE =
  'No cloud accounts yet. Use Add cloud account to connect a provider.';

interface CloudTreeNodeData {
  cloudRef: CloudTreeNodeRef;
  connection: CloudConnection;
}

function errorChildNode(message: string): TreeNode {
  return {
    label: message,
    icon: 'triangle-exclamation',
    leaf: true,
    children: [],
    loaded: true,
  };
}

function canOpenInEditor(ref: CloudTreeNodeRef): boolean {
  if (ref.kind === CloudTreeNodeKind.Workload) return true;
  return Boolean(ref.meta && (ref.meta.openInEditor === true || ref.meta.openInEditor === 'true'));
}

function refreshLabelForKind(kind: CloudTreeNodeKind): string {
  switch (kind) {
    case CloudTreeNodeKind.Connection:
      return 'Refresh connection';
    case CloudTreeNodeKind.Scope:
      return 'Refresh scope';
    case CloudTreeNodeKind.Group:
      return 'Refresh group';
    case CloudTreeNodeKind.Workload:
      return 'Refresh workload';
    case CloudTreeNodeKind.Service:
      return 'Refresh service';
    default:
      return 'Refresh';
  }
}

type WaTreeItemElement = HTMLElement & { lazy?: boolean; loading?: boolean };

function resolveTreeIcon(ref: CloudTreeNodeRef, connection: CloudConnection): string {
  if (ref.icon) return ref.icon;
  if (ref.kind === CloudTreeNodeKind.Connection) {
    return (
      cloudConnectionService.getConnectionContributor(connection.providerId)?.icon ??
      defaultIconForKind(ref.kind)
    );
  }
  return defaultIconForKind(ref.kind);
}

@customElement('docks-cloud-tree')
export class DocksCloudTree extends DocksPart {
  @state() private rootNodes: TreeNode[] = [];
  @state() private providerContextActions: CloudTreeAction[] = [];
  private treeRef = createRef<HTMLElement>();
  private subscriptionToken?: string;
  private loadingNodes = new Set<TreeNode>();

  protected doBeforeUI(): void {
    void cloudConnectionService.initialize().then(() => this.rebuildTree());
    this.subscriptionToken = subscribe(TOPIC_CLOUD_CONNECTIONS_CHANGED, () => this.rebuildTree());
  }

  protected doClose(): void {
    if (this.subscriptionToken) {
      unsubscribe(this.subscriptionToken);
      this.subscriptionToken = undefined;
    }
    super.doClose();
  }

  private async rebuildTree(): Promise<void> {
    const connections = cloudConnectionService.getConnections();
    this.rootNodes = connections.map((connection) => this.connectionToTreeNode(connection));
    await Promise.all(this.rootNodes.map((node) => this.loadNodeChildren(node)));
    this.requestUpdate();
  }

  private connectionToTreeNode(connection: CloudConnection): TreeNode {
    const cloudRef: CloudTreeNodeRef = {
      nodeId: `${connection.id}/connection`,
      connectionId: connection.id,
      providerId: connection.providerId,
      kind: CloudTreeNodeKind.Connection,
      label: connection.name,
      hasChildren: true,
    };
    const hasError = Boolean(connection.errorMessage?.trim());
    return {
      data: { cloudRef, connection } satisfies CloudTreeNodeData,
      label: cloudRef.label,
      icon: resolveTreeIcon(cloudRef, connection),
      leaf: false,
      children: hasError ? [errorChildNode(String(connection.errorMessage))] : [],
      loaded: hasError,
      loadError: undefined,
    };
  }

  protected renderToolbar() {
    return html`
      <docks-command
        icon="plus"
        title="Add cloud account"
        label
        dropdown=${CLOUD_CONNECTIONS_DROPDOWN}
      ></docks-command>
      <docks-command
        icon="arrows-rotate"
        title="Refresh"
        .action=${() => void this.rebuildTree()}
      ></docks-command>
    `;
  }

  private shellActions(data: CloudTreeNodeData): CloudTreeAction[] {
    const { cloudRef, connection } = data;
    const actions: CloudTreeAction[] = [];
    if (cloudConnectionService.supportsEditConnection(connection.providerId)) {
      actions.push({
        id: 'cloudadmin.shell.edit',
        label: 'Edit connection',
        icon: 'pen-to-square',
        run: () =>
          runCloudAction(async () => {
            await cloudConnectionService.editConnection(connection.id);
            await this.rebuildTree();
          }),
      });
    }
    if (cloudRef.kind === CloudTreeNodeKind.Connection) {
      actions.push({
        id: 'cloudadmin.shell.rename',
        label: 'Rename',
        icon: 'pen',
        run: () =>
          runCloudAction(async () => {
            const values = await formDialogRequired({
              label: 'Rename connection',
              fields: [
                { name: 'name', label: 'Connection name', value: connection.name },
              ],
            });
            const name = values.name;
            if (name === connection.name) return;
            await cloudConnectionService.renameConnection(connection.id, name);
          }),
      });
      actions.push({
        id: 'cloudadmin.shell.disconnect',
        label: 'Disconnect',
        icon: 'trash',
        run: () =>
          runCloudAction(async () => {
            if (!(await confirmDialog(`Disconnect "${connection.name}"?`))) return;
            await cloudConnectionService.removeConnection(connection.id);
          }),
      });
    }
    if (canOpenInEditor(cloudRef)) {
      actions.push({
        id: 'cloudadmin.shell.open-workload',
        label: 'Open',
        icon: 'up-right-from-square',
        run: () =>
          runCloudAction(() =>
            openWorkloadEditor(connection, cloudRef),
          ),
      });
    }
    actions.push({
      id: 'cloudadmin.shell.refresh',
      label: refreshLabelForKind(cloudRef.kind),
      icon: 'arrows-rotate',
      run: () => runCloudAction(() => this.refreshSelectedNode(data)),
    });
    return actions;
  }

  private findTreeNode(
    nodeId: string,
  ): { node: TreeNode; parent: TreeNode | null } | undefined {
    const visit = (
      nodes: TreeNode[],
      parent: TreeNode | null,
    ): { node: TreeNode; parent: TreeNode | null } | undefined => {
      for (const candidate of nodes) {
        const ref = (candidate.data as CloudTreeNodeData | undefined)?.cloudRef;
        if (ref?.nodeId === nodeId) return { node: candidate, parent };
        if (candidate.children?.length) {
          const found = visit(candidate.children, candidate);
          if (found) return found;
        }
      }
      return undefined;
    };
    return visit(this.rootNodes, null);
  }

  private async refreshSelectedNode(data: CloudTreeNodeData): Promise<void> {
    const { cloudRef, connection } = data;
    const located = this.findTreeNode(cloudRef.nodeId);
    if (!located) return;

    if (cloudRef.kind === CloudTreeNodeKind.Connection) {
      await cloudConnectionService.refreshConnection(connection.id);
      const updated = cloudConnectionService.getConnection(connection.id);
      if (updated?.status === 'error' && updated.errorMessage) {
        toastCloudError(new Error(updated.errorMessage));
      }
      return;
    }

    if (cloudRef.kind === CloudTreeNodeKind.Workload) {
      await this.refreshWorkloadNode(located.node, cloudRef.nodeId);
      this.requestUpdate();
      return;
    }

    await this.reloadNodeChildren(located.node);
    this.requestUpdate();
  }

  private async reloadNodeChildren(node: TreeNode): Promise<void> {
    const data = node.data as CloudTreeNodeData | undefined;
    if (!data || node.leaf) return;
    node.loaded = false;
    node.loadError = undefined;
    node.children = [];
    await this.loadNodeChildren(node);
  }

  private async refreshWorkloadNode(node: TreeNode, nodeId: string): Promise<void> {
    const located = this.findTreeNode(nodeId);
    const parent = located?.parent;
    if (!parent) return;

    const parentData = parent.data as CloudTreeNodeData | undefined;
    if (!parentData) return;

    await this.reloadNodeChildren(parent);
    const refreshed = parent.children?.find(
      (child) => (child.data as CloudTreeNodeData | undefined)?.cloudRef.nodeId === nodeId,
    );
    if (!refreshed) return;

    node.data = refreshed.data;
    node.label = refreshed.label;
    node.icon = refreshed.icon;
    node.leaf = refreshed.leaf;
    node.loadError = refreshed.loadError;
    node.children = refreshed.children;
    node.loaded = refreshed.loaded;
  }

  private async loadProviderContextActions(data: CloudTreeNodeData): Promise<void> {
    const providerActions = await cloudConnectionService.getActions(data.cloudRef, data.connection);
    if (this.selectedData()?.cloudRef.nodeId !== data.cloudRef.nodeId) return;
    this.providerContextActions = providerActions;
    this.requestUpdate();
  }

  private renderActionCommands(
    actions: CloudTreeAction[],
    data: CloudTreeNodeData,
  ): TemplateResult {
    return html`${actions.map(
      (action) => html`
        <docks-command
          icon=${action.icon ?? ''}
          title=${action.label}
          ?disabled=${action.disabled ?? false}
            .action=${() =>
              void runCloudAction(() =>
                action.run({ connection: data.connection, node: data.cloudRef }),
              )}
        >
          ${action.label}
        </docks-command>
      `,
    )}`;
  }

  /**
   * Like filebrowser: always expose at least one menu item so `docks-contextmenu` opens
   * (`hasMenuBody()` runs before the synthetic click that updates selection).
   * The tree-wide Refresh is only shown with no selection; selected nodes use shellActions.
   */
  protected renderContextMenu() {
    if (this.rootNodes.length === 0) return nothing;

    const data = this.selectedData();
    if (data) {
      return this.renderActionCommands(
        [...this.providerContextActions, ...this.shellActions(data)],
        data,
      );
    }

    return html`
      <docks-command
        icon="arrows-rotate"
        title="Refresh all connections"
        .action=${() => void this.rebuildTree()}
      >
        Refresh all
      </docks-command>
    `;
  }

  private selectedData(): CloudTreeNodeData | undefined {
    const sel = activeSelectionSignal.get() as CloudTreeNodeData | undefined;
    return sel?.connection ? sel : undefined;
  }

  private async loadNodeChildren(node: TreeNode, render = true): Promise<void> {
    const data = node.data as CloudTreeNodeData | undefined;
    if (!data || node.leaf || node.loaded || this.loadingNodes.has(node)) return;
    this.loadingNodes.add(node);
    try {
      const children = await cloudTreeRegistry.getChildren(data.cloudRef, data.connection);
      node.children = children.map((ref) => this.cloudRefToTreeNode(ref, data.connection));
      node.loaded = true;
      if (render) {
        this.requestUpdate();
      }
    } catch (err) {
      node.loadError = err instanceof Error ? err.message : String(err);
      node.children = [errorChildNode(node.loadError)];
      node.loadError = undefined;
      node.loaded = true;
      if (render) {
        this.requestUpdate();
      }
    } finally {
      this.loadingNodes.delete(node);
    }
  }

  private async onLazyLoad(event: Event, node: TreeNode): Promise<void> {
    const item = event.currentTarget as WaTreeItemElement;
    if (!node.loaded) {
      await this.loadNodeChildren(node, false);
    }
    // filebrowser sets `loaded` + re-render; WA also needs `loading` cleared on the
    // live item when the children slot stays empty (no slotchange event).
    item.lazy = false;
    item.loading = false;
    this.requestUpdate();
  }

  private cloudRefToTreeNode(ref: CloudTreeNodeRef, connection: CloudConnection): TreeNode {
    return {
      data: { cloudRef: ref, connection } satisfies CloudTreeNodeData,
      label: ref.label,
      icon: resolveTreeIcon(ref, connection),
      leaf: !ref.hasChildren,
      children: [],
      loaded: !ref.hasChildren,
    };
  }

  createTreeItems(node: TreeNode, expanded = false): TemplateResult {
    if (!node) return html``;
    // Same rule as filebrowser: lazy only until children have been fetched once.
    const isLazy = !node.leaf && !node.loaded;
    return html`
      <wa-tree-item
        @dblclick=${this.nobubble((e: Event) => this.onItemDblClicked(e, node))}
        @wa-lazy-load=${this.nobubble((e: Event) => this.onLazyLoad(e, node))}
        .model=${node}
        ?expanded=${expanded}
        ?lazy=${isLazy}
      >
        <div class="tree-item-rows">
          <div class="tree-item-label-row">
            <span class="tree-label">
              ${icon(node.icon, { label: node.leaf ? 'Resource' : 'Group' })}
              <span class="tree-label-text">${node.label}</span>
            </span>
          </div>
        </div>
        ${node.children?.map((child) => this.createTreeItems(child))}
      </wa-tree-item>
    `;
  }

  private onItemDblClicked(event: Event, node: TreeNode): void {
    const data = node.data as CloudTreeNodeData | undefined;
    if (data && node.leaf && canOpenInEditor(data.cloudRef)) {
      void runCloudAction(() =>
        openWorkloadEditor(data.connection, data.cloudRef),
      );
      return;
    }
    const item = event.currentTarget as HTMLElement & { expanded?: boolean };
    if (!node.leaf && 'expanded' in item) item.expanded = !item.expanded;
  }

  onSelectionChanged(event: Event): void {
    const detail = (event as CustomEvent<{ selection?: Array<{ model?: TreeNode }> }>).detail;
    const node = detail?.selection?.[0]?.model;
    const data = node?.data as CloudTreeNodeData | undefined;
    if (data?.connection) {
      activeSelectionSignal.set(data);
      this.providerContextActions = [];
      void this.loadProviderContextActions(data);
      return;
    }
    activeSelectionSignal.set(undefined);
    this.providerContextActions = [];
  }

  protected renderContent() {
    return html`
      <div class="tree" ${ref(this.treeRef)}>
        ${this.rootNodes.length > 0
          ? html`
              <wa-tree
                @wa-selection-change=${this.nobubble(this.onSelectionChanged)}
                style="--indent-guide-width: 1px;"
              >
                ${this.rootNodes.map((n) => this.createTreeItems(n, true))}
              </wa-tree>
            `
          : html`
              <docks-no-content message=${EMPTY_MESSAGE} icon="cloud"></docks-no-content>
            `}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .tree {
      height: 100%;
      min-height: 0;
      position: relative;
    }

    .tree wa-tree {
      height: 100%;
    }

    .tree-item-rows {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--wa-space-2xs);
      min-width: 0;
      width: 100%;
    }

    .tree-item-label-row {
      min-width: 0;
    }

    .tree-item-detail-row {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }

    .tree-item-error-text {
      font-size: var(--wa-font-size-s);
      line-height: var(--wa-line-height-normal);
      color: var(--wa-color-danger-text, #c62828);
    }

    .tree-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .tree-label-text {
      white-space: nowrap;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'docks-cloud-tree': DocksCloudTree;
  }
}

export function registerCloudView(): void {
  contributionRegistry.registerContribution(SIDEBAR_MAIN, {
    name: VIEW_CLOUD,
    label: 'Cloud Browser',
    icon: 'cloud',
    closable: false,
    toolbar: true,
    component: (id: string) => html`<docks-cloud-tree id="${id}"></docks-cloud-tree>`,
  });
}
