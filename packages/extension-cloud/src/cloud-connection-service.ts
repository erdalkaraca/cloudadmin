import { persistenceService, publish, workspaceService } from '@eclipse-docks/core';
import type { Directory, File } from '@eclipse-docks/core';
import {
  CONNECTIONS_PERSIST_KEY,
  CONNECTIONS_VERSION,
  type CloudConnection,
  type CloudConnectionContributor,
  type CloudConnectionStatus,
  type CloudTreeAction,
  type CloudTreeNodeRef,
  type PersistedConnectionsFile,
} from './models';
import {
  clearConnectionSecrets,
  hydrateAllConnectionSecrets,
  setConnectionSecrets,
} from './session-secrets';
import { TOPIC_CLOUD_CONNECTIONS_CHANGED } from './api';

function newConnectionId(): string {
  return `conn-${crypto.randomUUID()}`;
}

class CloudConnectionService {
  private readonly connectionContributors = new Map<string, CloudConnectionContributor>();
  private connections: CloudConnection[] = [];
  private loaded = false;

  registerConnectionContributor(contributor: CloudConnectionContributor): void {
    this.connectionContributors.set(contributor.providerId, contributor);
  }

  getConnectionContributors(): CloudConnectionContributor[] {
    return [...this.connectionContributors.values()];
  }

  getConnectionContributor(providerId: string): CloudConnectionContributor | undefined {
    return this.connectionContributors.get(providerId);
  }

  async getActions(
    node: CloudTreeNodeRef,
    connection: CloudConnection,
  ): Promise<CloudTreeAction[]> {
    const contributor = this.connectionContributors.get(connection.providerId);
    if (!contributor?.getActions) return [];
    return contributor.getActions(node, connection);
  }

  getConnections(): CloudConnection[] {
    return [...this.connections];
  }

  getConnection(connectionId: string): CloudConnection | undefined {
    return this.connections.find((c) => c.id === connectionId);
  }

  async initialize(): Promise<void> {
    if (this.loaded) return;
    await hydrateAllConnectionSecrets();
    await this.loadConnections();
    this.loaded = true;
    this.notifyChanged();
  }

  async connectProvider(providerId: string): Promise<CloudConnection | undefined> {
    const contributor = this.connectionContributors.get(providerId);
    if (!contributor) return undefined;
    const result = await contributor.connect();
    const connection = await this.addConnection(
      providerId,
      result.name,
      result.persistData,
      'connected',
    );
    if (result.secrets) await setConnectionSecrets(connection.id, result.secrets);
    return connection;
  }

  async addConnection(
    providerId: string,
    name: string,
    persistData: Record<string, unknown>,
    status: CloudConnectionStatus = 'connected',
  ): Promise<CloudConnection> {
    const connection: CloudConnection = {
      id: newConnectionId(),
      providerId,
      name,
      status,
      persistData,
    };
    this.connections.push(connection);
    await this.saveConnections();
    this.notifyChanged();
    return connection;
  }

  async removeConnection(connectionId: string): Promise<void> {
    const contributor = this.connectionContributors.get(
      this.connections.find((c) => c.id === connectionId)?.providerId ?? '',
    );
    if (contributor) await contributor.disconnect(connectionId);
    await clearConnectionSecrets(connectionId);
    this.connections = this.connections.filter((c) => c.id !== connectionId);
    await this.saveConnections();
    this.notifyChanged();
  }

  async renameConnection(connectionId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Connection name cannot be empty');
    const connection = this.getConnection(connectionId);
    if (!connection) return;
    const contributor = this.connectionContributors.get(connection.providerId);
    if (contributor?.rename) await contributor.rename(connectionId, trimmed);
    connection.name = trimmed;
    await this.saveConnections();
    this.notifyChanged();
  }

  async refreshConnection(connectionId: string): Promise<void> {
    const connection = this.getConnection(connectionId);
    if (!connection) return;
    const contributor = this.connectionContributors.get(connection.providerId);
    if (!contributor) return;
    connection.status = 'connecting';
    this.notifyChanged();
    try {
      const restored = await contributor.restore(connection);
      Object.assign(connection, restored, { status: 'connected' as const });
      connection.errorMessage = undefined;
    } catch (err) {
      connection.status = 'error';
      connection.errorMessage = err instanceof Error ? err.message : String(err);
    }
    await this.saveConnections();
    this.notifyChanged();
  }

  private async loadConnections(): Promise<void> {
    const fromWorkspace = await this.loadFromWorkspaceFile();
    const raw =
      fromWorkspace ??
      ((await persistenceService.getObject(CONNECTIONS_PERSIST_KEY)) as PersistedConnectionsFile | null);
    if (!raw?.connections?.length) {
      this.connections = [];
      return;
    }
    this.connections = [];
    for (const row of raw.connections) {
      const base: CloudConnection = {
        id: row.id,
        providerId: row.providerId,
        name: row.name,
        status: 'disconnected',
        persistData: row.persistData ?? {},
      };
      const contributor = this.connectionContributors.get(row.providerId);
      if (!contributor) {
        this.connections.push(base);
        continue;
      }
      try {
        const restored = await contributor.restore(base);
        this.connections.push(restored);
      } catch (err) {
        base.status = 'error';
        base.errorMessage = err instanceof Error ? err.message : String(err);
        this.connections.push(base);
      }
    }
  }

  private async saveConnections(): Promise<void> {
    const payload: PersistedConnectionsFile = {
      version: CONNECTIONS_VERSION,
      connections: this.connections.map((c) => ({
        id: c.id,
        providerId: c.providerId,
        name: c.name,
        persistData: c.persistData,
      })),
    };
    await persistenceService.persistObject(CONNECTIONS_PERSIST_KEY, payload);
    await this.saveToWorkspaceFile(payload);
  }

  private async loadFromWorkspaceFile(): Promise<PersistedConnectionsFile | null> {
    const workspace = await workspaceService.getWorkspace();
    if (!workspace) return null;
    try {
      const file = (await workspace.getResource('.cloudadmin/connections.json')) as File | null;
      if (!file) return null;
      const text = String(await file.getContents());
      return JSON.parse(text) as PersistedConnectionsFile;
    } catch {
      return null;
    }
  }

  private async saveToWorkspaceFile(payload: PersistedConnectionsFile): Promise<void> {
    const workspace = await workspaceService.getWorkspace();
    if (!workspace) return;
    try {
      const dir = (await workspace.getResource('.cloudadmin/', { create: true })) as Directory | null;
      if (!dir) return;
      const json = JSON.stringify(payload, null, 2);
      const file = (await dir.getResource('connections.json', { create: true })) as File | null;
      if (file) await file.saveContents(json);
    } catch {
      // Workspace may be read-only; persistenceService fallback already saved.
    }
  }

  private notifyChanged(): void {
    publish(TOPIC_CLOUD_CONNECTIONS_CHANGED, {});
  }
}

export const cloudConnectionService = new CloudConnectionService();
