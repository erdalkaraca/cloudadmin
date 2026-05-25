import { contributionRegistry, type HTMLContribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';
import type { CloudConnectionContributor, CloudTreeContributor } from './models';
import { CLOUD_CONNECTIONS_DROPDOWN } from './cloud-connections-dropdown';
import { cloudConnectionService } from './cloud-connection-service';
import { cloudTreeRegistry } from './cloud-tree-registry';

export function registerCloudProvider(
  connection: CloudConnectionContributor,
  tree: CloudTreeContributor,
): void {
  if (connection.providerId !== tree.providerId) {
    throw new Error(
      `Provider id mismatch: ${connection.providerId} vs ${tree.providerId}`,
    );
  }
  cloudConnectionService.registerConnectionContributor(connection);
  cloudTreeRegistry.registerTreeContributor(tree);

  const providerId = connection.providerId;
  contributionRegistry.registerContribution(CLOUD_CONNECTIONS_DROPDOWN, {
    name: `cloud.connect.${providerId}`,
    label: connection.label,
    icon: connection.icon,
    component: () => html`
      <docks-command
        icon=${connection.icon}
        .action=${() => {
          void cloudConnectionService.connectProvider(providerId).catch((err) => {
            console.error('[extension-cloud] connect failed', err);
          });
        }}
      >
        ${connection.label}
      </docks-command>
    `,
  } as HTMLContribution);
}
