import { extensionRegistry } from '@eclipse-docks/core';

extensionRegistry.registerExtension({
  id: 'extension-cloud',
  name: 'Cloud',
  description: 'Unified cloud explorer, connections, scope, models, and policy',
  loader: () => import('./cloud-extension-loader'),
  icon: 'cloud',
});
