export type K8sAuthMode = 'companion' | 'bearer';

export interface K8sPersistData {
  serverUrl: string;
  authMode?: K8sAuthMode;
  /** @deprecated Prefer {@link contexts}. */
  context?: string;
  /** Kubeconfig-style context names shown as scope nodes under the connection. */
  contexts?: string[];
  /** Manually added namespaces keyed by kube context. */
  manualNamespacesByContext?: Record<string, string[]>;
}

export interface KubeconfigServerEntry {
  name: string;
  serverUrl: string;
}

export interface KubeconfigContextEntry {
  name: string;
  serverUrl?: string;
  namespace?: string;
}

export interface NamespacedResourceType {
  groupVersion: string;
  resourceName: string;
  kind: string;
}

export interface ClusterResourceType {
  groupVersion: string;
  resourceName: string;
  kind: string;
}

export interface NamespacedObjectEntry {
  name: string;
  uid: string;
  kind: string;
}

export interface ClusterObjectEntry {
  name: string;
  uid: string;
  kind: string;
}

export interface ListedPod {
  name: string;
  uid: string;
  phase?: string;
  containers: string[];
}

export interface K8sNamespaceEntry {
  name: string;
  uid: string;
}

export type K8sResourceType = NamespacedResourceType | ClusterResourceType;
