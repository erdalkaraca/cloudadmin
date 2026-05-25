import { extensionRegistry } from '@eclipse-docks/core';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';

extensionRegistry.registerExtension({
  id: 'extension-azure',
  name: PROVIDER_DISPLAY_NAME,
  description: 'Azure cloud provider (stub — see README)',
  loader: () => import('./azure-extension-loader'),
  icon: 'cloud',
});

export { COMMAND_NAMESPACE, PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
