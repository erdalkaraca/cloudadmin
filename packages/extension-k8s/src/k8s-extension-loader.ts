import { contributionRegistry } from '@eclipse-docks/core';
import {
  COMPANION_TOOL_POLICIES,
  type CompanionToolPolicyContribution,
} from 'extension-companion/api';
import { registerK8sConnectionDialog } from './k8s-connection-dialog';
import { registerK8sProviders } from './k8s-contributors';
import { registerK8sExecTerminalProfile } from './k8s-terminal-profile';

const K8S_COMPANION_POLICY_CONTRIBUTION = {
  name: 'k8s.companion.toolPolicies',
  label: 'Kubernetes Companion Policies',
  requester: 'extension-k8s',
  rules: [
    { tool: 'kubectl', allowedArgsPrefixes: [['install'], ['proxy'], ['exec', '-i']] },
    { tool: 'kubectl', allowedArgsPrefixes: [] },
    {
      tool: 'kubectl',
      allowedArgsPrefixes: [
        ['api-resources'],
        ['config', 'get-contexts', '-o', 'name'],
        ['config', 'current-context'],
        ['config', 'view', '-o', 'json'],
      ],
    },
  ],
} satisfies CompanionToolPolicyContribution;

export default function k8sExtensionLoader(): void {
  registerK8sConnectionDialog();
  contributionRegistry.registerContribution(
    COMPANION_TOOL_POLICIES,
    K8S_COMPANION_POLICY_CONTRIBUTION,
  );
  registerK8sExecTerminalProfile();
  registerK8sProviders();
}
