export type CloudConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

/** Canonical tree levels shared across cloud providers. */
export const CloudTreeNodeKind = {
  Connection: 'connection',
  Scope: 'scope',
  Group: 'group',
  Workload: 'workload',
  Service: 'service',
} as const;

export type CloudTreeNodeKind = (typeof CloudTreeNodeKind)[keyof typeof CloudTreeNodeKind];

export function defaultIconForKind(kind: CloudTreeNodeKind): string {
  switch (kind) {
    case CloudTreeNodeKind.Connection:
      return 'cloud';
    case CloudTreeNodeKind.Scope:
      return 'layer-group';
    case CloudTreeNodeKind.Group:
      return 'folder';
    case CloudTreeNodeKind.Workload:
      return 'box';
    case CloudTreeNodeKind.Service:
      return 'network-wired';
    default:
      return 'cloud';
  }
}

export interface CloudConnection {
  id: string;
  providerId: string;
  name: string;
  status: CloudConnectionStatus;
  persistData: Record<string, unknown>;
  errorMessage?: string;
}

export interface CloudTreeNodeRef {
  nodeId: string;
  connectionId: string;
  providerId: string;
  kind: CloudTreeNodeKind;
  label: string;
  /** When set, used instead of {@link defaultIconForKind}. */
  icon?: string;
  hasChildren: boolean;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

export interface CloudConnectResult {
  name: string;
  persistData: Record<string, unknown>;
  secrets?: Record<string, string>;
}

export interface CloudTreeActionContext {
  connection: CloudConnection;
  node: CloudTreeNodeRef;
}

export type WorkloadLifecycleOp = 'start' | 'stop' | 'restart';

export type WorkloadEditorTab = 'overview' | 'logs' | 'config' | 'inspect';

export type WorkloadConfigLanguage = 'json' | 'yaml' | 'dockerfile' | 'plaintext';

export interface WorkloadConfigContent {
  text: string;
  language?: WorkloadConfigLanguage;
}

export interface WorkloadCapabilities {
  logs?: boolean;
  config?: boolean;
  inspect?: boolean;
  lifecycle?: WorkloadLifecycleOp[];
}

export interface WorkloadStatus {
  label: string;
  detail?: string;
}

export interface CloudWorkloadHandler {
  providerId: string;
  getCapabilities(context: CloudTreeActionContext): WorkloadCapabilities;
  getStatus?(context: CloudTreeActionContext): Promise<WorkloadStatus>;
  fetchLogs?(
    context: CloudTreeActionContext,
    options?: { tail?: number; container?: string },
  ): Promise<string>;
  fetchConfig?(context: CloudTreeActionContext): Promise<WorkloadConfigContent>;
  fetchInspect?(context: CloudTreeActionContext): Promise<unknown>;
  lifecycle?(
    context: CloudTreeActionContext,
    operation: WorkloadLifecycleOp,
  ): Promise<void>;
}

export interface CloudTreeAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  run(context: CloudTreeActionContext): void | Promise<void>;
}

export interface CloudConnectionContributor {
  providerId: string;
  label: string;
  icon: string;
  connect(): Promise<CloudConnectResult>;
  /** Edit persisted settings and optional secrets for an existing connection. */
  editConnection?(connection: CloudConnection): Promise<CloudConnectResult>;
  restore(connection: CloudConnection): Promise<CloudConnection>;
  disconnect(connectionId: string): Promise<void>;
  rename?(connectionId: string, name: string): Promise<void>;
  /** Provider-specific actions for the currently selected tree node. */
  getActions?(
    node: CloudTreeNodeRef,
    connection: CloudConnection,
  ): CloudTreeAction[] | Promise<CloudTreeAction[]>;
}

export interface CloudTreeContributor {
  providerId: string;
  getChildren(
    parent: CloudTreeNodeRef | null,
    connection: CloudConnection,
  ): Promise<CloudTreeNodeRef[]>;
  refresh?(connectionId: string): Promise<void>;
}

export interface Resource {
  provider: string;
  type: string;
  id: string;
  name: string;
  location?: string;
  tags?: Record<string, string>;
  status?: string;
  extensions?: Record<string, unknown>;
}

export interface ScopeContext {
  connectionId?: string;
  providerId?: string;
  nodeId?: string;
  kind?: CloudTreeNodeKind;
  label?: string;
  resource?: Resource;
}

export const CONNECTIONS_FILE = '.cloudadmin/connections.json';
export const CONNECTIONS_PERSIST_KEY = 'cloudadmin_connections';
export const CONNECTIONS_VERSION = 1;

export interface PersistedConnectionsFile {
  version: number;
  connections: Array<{
    id: string;
    providerId: string;
    name: string;
    persistData: Record<string, unknown>;
  }>;
}
