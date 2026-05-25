import { TOOLBAR_BOTTOM, contributionRegistry } from '@eclipse-docks/core';
import './companion-status';
import { CompanionClient } from './api';

export default function companionExtensionLoader(): void {
  contributionRegistry.registerContribution(TOOLBAR_BOTTOM, {
    target: TOOLBAR_BOTTOM,
    label: 'Companion',
    component: '<cloudadmin-companion-status></cloudadmin-companion-status>',
  });

  void new CompanionClient().health().then((h) => {
    if (h.ok) console.info('[extension-companion] Companion ready', h.version ?? '');
  });
}
