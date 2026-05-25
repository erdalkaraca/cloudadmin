import {
  SIDEBAR_MAIN,
  appLoaderService,
  contributionRegistry,
  type HTMLContribution,
  TOOLBAR_MAIN,
} from '@eclipse-docks/core';
import { installSidebarTabOrder, type SidebarTabRemap } from './sidebar-tab-order';

/** Main sidebar tab order (left → right). Matches contribution `name`s. */
const SIDEBAR_TAB_REMAPS: SidebarTabRemap[] = [
  { name: 'view.cloud', targets: [SIDEBAR_MAIN] },
  { name: 'view.filebrowser', targets: [SIDEBAR_MAIN] },
  { name: 'catalog', targets: [SIDEBAR_MAIN] },
];

installSidebarTabOrder(SIDEBAR_TAB_REMAPS);

/** Which extensions the shell offers; keep in sync with `extension-*` / `@scope/extension-*` entries in package.json (auto side-effect-imported via resolveDepVersionsPlugin). */
contributionRegistry.registerContribution(TOOLBAR_MAIN, {
  label: 'Brand',
  slot: 'start',
  component:
    '<span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:0.75rem;" aria-label="CloudAdmin">' +
    '<img src="/favicon.svg" alt="" width="28" height="28" style="display:block;flex-shrink:0;" />' +
    '<span style="font-weight:600;font-size:1rem;font-family:system-ui,sans-serif;color:currentColor;letter-spacing:-0.02em;">CloudAdmin</span>' +
    '</span>',
} as HTMLContribution);

const appRoot = document.getElementById('app-root') ?? document.body;
appLoaderService.registerApp(
  {
    name: 'CloudAdmin',
    remaps: SIDEBAR_TAB_REMAPS,
    extensions: [
      '@eclipse-docks/extension-utils',
      '@eclipse-docks/extension-pwa',
      '@eclipse-docks/extension-command-palette',
      '@eclipse-docks/extension-catalog',
      '@eclipse-docks/extension-md-editor',
      '@eclipse-docks/extension-plain-editor',
      '@eclipse-docks/extension-media-viewer',
      '@eclipse-docks/extension-settings-tree',
      '@eclipse-docks/extension-memory-usage',
      'extension-cloud',
      'extension-k8s',
      'extension-portainer',
    ],
  },
  { autoStart: true, hostConfig: true, container: appRoot },
);
