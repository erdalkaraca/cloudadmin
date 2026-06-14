export type {
  ClusterObjectEntry,
  ClusterResourceType,
  K8sAuthMode,
  K8sNamespaceEntry,
  K8sPersistData,
  K8sResourceType,
  KubeconfigContextEntry,
  KubeconfigServerEntry,
  ListedPod,
  NamespacedObjectEntry,
  NamespacedResourceType,
} from './k8s-types';

export { createK8sBackend, type K8sBackend } from './k8s-backend';
export { validateK8sCredentials } from './bearer-backend';
export {
  listKubeconfigContextEntries,
  listKubeconfigContexts,
  listKubeconfigServers,
} from './companion-kubectl';

export {
  getClusterObject,
  getNamespacedObject,
  getPod,
  getPodLogs,
  listClusterObjects,
  listClusterResourceTypes,
  listNamespaces,
  listNamespacedObjects,
  listNamespacedResourceTypes,
  listPods,
} from './k8s-api';
