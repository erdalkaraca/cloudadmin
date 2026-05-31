import { contributionRegistry } from '@eclipse-docks/core';
import {
  COMPANION_TOOL_POLICIES,
  type CompanionToolPolicyContribution,
} from 'extension-companion/api';
import { registerK8sConnectionDialog } from './k8s-connection-dialog';
import { registerK8sProviders } from './k8s-contributors';

const K8S_COMPANION_POLICY_CONTRIBUTION: CompanionToolPolicyContribution = {
  name: 'k8s.companion.toolPolicies',
  label: 'Kubernetes Companion Policies',
  requester: 'extension-k8s',
  rules: [
    { tool: 'kubectl', allowedArgsPrefixes: [['install'], ['proxy']] },
    {
      tool: 'kubectl',
      allowedArgsPrefixes: [
        ['config', 'get-contexts', '-o', 'name'],
        ['config', 'current-context'],
        ['config', 'view', '-o', 'json'],
      ],
    },
  ],
};

export default function k8sExtensionLoader(): void {
  registerK8sConnectionDialog();
  contributionRegistry.registerContribution(
    COMPANION_TOOL_POLICIES,
    K8S_COMPANION_POLICY_CONTRIBUTION,
  );
  registerK8sProviders();
}
