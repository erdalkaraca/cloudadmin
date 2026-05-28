import { contributionRegistry } from '@eclipse-docks/core';
import type { TabContribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';
import {
  WORKLOAD_EDITOR_TABS_ID,
  WORKLOAD_TAB_CONFIG,
  WORKLOAD_TAB_INSPECT,
  WORKLOAD_TAB_LOGS,
  WORKLOAD_TAB_OVERVIEW,
} from './constants';
import { workloadTabVisible } from './context';
import './tabs/overview-tab';
import './tabs/logs-tab';
import './tabs/config-tab';
import './tabs/inspect-tab';

let registered = false;

export function registerWorkloadEditorTabs(): void {
  if (registered) return;
  registered = true;

  const tabs: TabContribution[] = [
    {
      name: WORKLOAD_TAB_OVERVIEW,
      label: 'Overview',
      icon: 'circle-info',
      closable: false,
      toolbar: true,
      component: () => html`<cloudadmin-workload-tab-overview></cloudadmin-workload-tab-overview>`,
    },
    {
      name: WORKLOAD_TAB_LOGS,
      label: 'Logs',
      icon: 'scroll',
      closable: false,
      toolbar: true,
      visible: () => workloadTabVisible('logs'),
      component: () => html`<cloudadmin-workload-tab-logs></cloudadmin-workload-tab-logs>`,
    },
    {
      name: WORKLOAD_TAB_CONFIG,
      label: 'Config',
      icon: 'file-code',
      closable: false,
      toolbar: true,
      visible: () => workloadTabVisible('config'),
      component: () => html`<cloudadmin-workload-tab-config></cloudadmin-workload-tab-config>`,
    },
    {
      name: WORKLOAD_TAB_INSPECT,
      label: 'Inspect',
      icon: 'magnifying-glass',
      closable: false,
      toolbar: true,
      visible: () => workloadTabVisible('inspect'),
      component: () => html`<cloudadmin-workload-tab-inspect></cloudadmin-workload-tab-inspect>`,
    },
  ];

  for (const tab of tabs) {
    contributionRegistry.registerContribution(WORKLOAD_EDITOR_TABS_ID, tab);
  }
}
