import { extensionRegistry } from '@eclipse-docks/core';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';

extensionRegistry.registerExtension({
  id: 'extension-portainer',
  name: PROVIDER_DISPLAY_NAME,
  description: 'Portainer cloud provider (stub — see README)',
  loader: () => import('./portainer-extension-loader'),
  icon: 'cubes',
});

export { COMMAND_NAMESPACE, PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
