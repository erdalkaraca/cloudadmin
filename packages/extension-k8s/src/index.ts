import { extensionRegistry } from '@eclipse-docks/core';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';

extensionRegistry.registerExtension({
  id: 'extension-k8s',
  name: PROVIDER_DISPLAY_NAME,
  description: 'Kubernetes cloud provider (stub — see README)',
  loader: () => import('./k8s-extension-loader'),
  icon: 'diagram-project',
});

export { COMMAND_NAMESPACE, PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
