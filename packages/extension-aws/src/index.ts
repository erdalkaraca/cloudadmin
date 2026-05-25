import { extensionRegistry } from '@eclipse-docks/core';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';

extensionRegistry.registerExtension({
  id: 'extension-aws',
  name: PROVIDER_DISPLAY_NAME,
  description: 'AWS cloud provider (stub — see README)',
  loader: () => import('./aws-extension-loader'),
  icon: 'cloud',
});

export { COMMAND_NAMESPACE, PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './provider';
