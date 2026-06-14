import type { CloudConnection } from 'extension-cloud/api';
import { PROVIDER_ID_BEARER } from '../provider';
import { BearerK8sBackend } from './bearer-backend';
import { CompanionK8sBackend } from './companion-backend';
import type {
  K8sAuthMode,
  K8sNamespaceEntry,
  K8sPersistData,
  K8sResourceType,
} from './k8s-types';

export interface K8sBackend {
  readonly mode: K8sAuthMode;
  fetch(persist: K8sPersistData, path: string, init?: RequestInit): Promise<Response>;
  testConnection(persist: K8sPersistData): Promise<void>;
  listNamespaces(persist: K8sPersistData): Promise<K8sNamespaceEntry[]>;
  listResourceTypes(persist: K8sPersistData, namespaced: boolean): Promise<K8sResourceType[]>;
  supportsPodConsole(): boolean;
  supportsClusterConsole(): boolean;
}

export function createK8sBackend(connection: CloudConnection): K8sBackend {
  return connection.providerId === PROVIDER_ID_BEARER
    ? new BearerK8sBackend(connection.id)
    : new CompanionK8sBackend();
}
