import {
  TOOLBAR_MAIN,
  activeSelectionSignal,
  contributionRegistry,
} from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';
import type { HTMLContribution } from '@eclipse-docks/core';
import './docks-cloud-tree';
import { registerCloudView } from './docks-cloud-tree';
import { getScopeContext } from './scope-context';

export default function cloudExtensionLoader(): void {
  registerCloudView();

  contributionRegistry.registerContribution(TOOLBAR_MAIN, {
    label: 'Scope',
    slot: 'center',
    component: () => {
      activeSelectionSignal.get();
      const scope = getScopeContext();
      const scopeText = scope?.label ?? 'No cloud scope selected';
      return html`
        <span class="cloudadmin-scope" style="display:inline-flex;align-items:center;gap:0.5rem;">
          <wa-icon name="crosshairs"></wa-icon>
          <span>${scopeText}</span>
        </span>
      `;
    },
  } as HTMLContribution);
}
