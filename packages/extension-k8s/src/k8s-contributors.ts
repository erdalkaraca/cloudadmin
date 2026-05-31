import { registerCloudProvider } from 'extension-cloud/api';
import { PROVIDER_ID_BEARER, PROVIDER_ID_COMPANION } from './provider';
import { createK8sWorkloadHandler } from './k8s-workload';
import {
  companionConnectionContributor,
  companionTreeContributor,
} from './k8s-contributors-companion';
import {
  bearerConnectionContributor,
  bearerTreeContributor,
} from './k8s-contributors-bearer';

export function registerK8sProviders(): void {
  registerCloudProvider(
    companionConnectionContributor,
    companionTreeContributor,
    createK8sWorkloadHandler(PROVIDER_ID_COMPANION),
  );
  registerCloudProvider(
    bearerConnectionContributor,
    bearerTreeContributor,
    createK8sWorkloadHandler(PROVIDER_ID_BEARER),
  );
}
