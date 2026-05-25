import { extensionRegistry } from '@eclipse-docks/core';

extensionRegistry.registerExtension({
  id: 'extension-companion',
  name: 'Companion',
  description: 'Optional local Companion — HTTP client, discovery, advanced ops',
  loader: () => import('./companion-extension-loader'),
  icon: 'server',
});
