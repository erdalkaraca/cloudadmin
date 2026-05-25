import { contributionRegistry, type HTMLContribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';
import type {
  CloudConnectionContributor,
  CloudTreeContributor,
  CloudWorkloadHandler,
} from './models';
import { CLOUD_CONNECTIONS_DROPDOWN } from './cloud-connections-dropdown';
import { cloudConnectionService } from './cloud-connection-service';
import { toastCloudError } from './cloud-toast';
import { cloudTreeRegistry } from './cloud-tree-registry';
import { cloudWorkloadRegistry } from './cloud-workload-registry';

export function registerCloudProvider(
  connection: CloudConnectionContributor,
  tree: CloudTreeContributor,
  workload?: CloudWorkloadHandler,
): void {
  if (connection.providerId !== tree.providerId) {
    throw new Error(
      `Provider id mismatch: ${connection.providerId} vs ${tree.providerId}`,
    );
  }
  cloudConnectionService.registerConnectionContributor(connection);
  cloudTreeRegistry.registerTreeContributor(tree);
  if (workload) {
    if (workload.providerId !== connection.providerId) {
      throw new Error(
        `Workload provider id mismatch: ${workload.providerId} vs ${connection.providerId}`,
      );
    }
    cloudWorkloadRegistry.register(workload);
  }

  const providerId = connection.providerId;
  contributionRegistry.registerContribution(CLOUD_CONNECTIONS_DROPDOWN, {
    name: `cloud.connect.${providerId}`,
    label: connection.label,
    icon: connection.icon,
    component: () => html`
      <docks-command
        icon=${connection.icon}
        .action=${() => {
          void cloudConnectionService.connectProvider(providerId).catch(toastCloudError);
        }}
      >
        ${connection.label}
      </docks-command>
    `,
  } as HTMLContribution);
}
