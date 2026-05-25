import { extensionRegistry } from '@eclipse-docks/core';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';

extensionRegistry.registerExtension({
  id: 'extension-gcp',
  name: PROVIDER_DISPLAY_NAME,
  description: 'Google Cloud provider (stub — see README)',
  loader: () => import('./gcp-extension-loader'),
  icon: 'cloud',
});

export { COMMAND_NAMESPACE, PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
