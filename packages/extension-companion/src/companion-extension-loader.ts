import { TOOLBAR_BOTTOM, contributionRegistry } from '@eclipse-docks/core';
import './companion-status';

export default function companionExtensionLoader(): void {
  contributionRegistry.registerContribution(TOOLBAR_BOTTOM, {
    target: TOOLBAR_BOTTOM,
    label: 'Companion',
    component: '<cloudadmin-companion-status></cloudadmin-companion-status>',
  });

}
