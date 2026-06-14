import { extensionRegistry } from '@eclipse-docks/core';

extensionRegistry.registerExtension({
  id: 'extension-portainer',
  name: 'Portainer',
  description: 'Portainer cloud provider (stub — see README)',
  loader: () => import('./portainer-extension-loader'),
  icon: 'cubes',
});
