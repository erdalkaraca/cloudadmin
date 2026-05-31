import { TOOLBAR_BOTTOM, contributionRegistry } from '@eclipse-docks/core';
import { registerCatalog, type CatalogContribution } from '@eclipse-docks/extension-catalog/api';
import './companion-status';
import { initializeCompanionToolPolicyContributions } from './tool-policy-contributions';

const COMPANION_BINARY_URL = new URL('../companion/vendor/bin/cloudadmin-companion', import.meta.url)
  .href;
const COMPANION_BINARY_WIN_URL = new URL('../companion/vendor/bin/cloudadmin-companion.exe', import.meta.url)
  .href;

const COMPANION_CATALOG: CatalogContribution = {
  label: 'Companion',
  icon: 'server',
  contributionId: 'catalog.companion',
  items: [
    {
      label: 'Binaries',
      icon: 'file-zipper',
      contributionId: 'catalog.companion.binaries',
      items: [
        {
          label: 'cloudadmin-companion (linux-x64)',
          icon: 'download',
          state: {
            url: COMPANION_BINARY_URL,
            filename: 'cloudadmin-companion',
          },
        },
        {
          label: 'cloudadmin-companion.exe (windows-x64)',
          icon: 'download',
          state: {
            url: COMPANION_BINARY_WIN_URL,
            filename: 'cloudadmin-companion.exe',
          },
        },
      ],
    },
  ],
};

export default function companionExtensionLoader(): void {
  registerCatalog(COMPANION_CATALOG);
  initializeCompanionToolPolicyContributions();

  contributionRegistry.registerContribution(TOOLBAR_BOTTOM, {
    target: TOOLBAR_BOTTOM,
    label: 'Companion',
    component: '<cloudadmin-companion-status></cloudadmin-companion-status>',
  });

}
