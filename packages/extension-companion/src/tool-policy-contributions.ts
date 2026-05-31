import {
  TOPIC_CONTRIBUTEIONS_CHANGED,
  contributionRegistry,
  subscribe,
  toastInfo,
  type Contribution,
} from '@eclipse-docks/core';
import {
  COMPANION_TOOL_POLICIES,
  CompanionClient,
  type CompanionToolPolicyContribution,
  type ToolPolicyRule,
} from './api';

type PolicyContribution = Contribution & CompanionToolPolicyContribution;

let initialized = false;
let syncInFlight: Promise<void> | undefined;
let syncQueued = false;

function normalizeRule(rule: ToolPolicyRule): ToolPolicyRule | undefined {
  const tool = String(rule.tool ?? '').trim();
  if (!tool) return undefined;
  const allowedArgsPrefixes = (rule.allowedArgsPrefixes ?? [])
    .map((prefix) => prefix.map((value) => String(value).trim()).filter(Boolean))
    .filter((prefix) => prefix.length > 0);
  return { tool, allowedArgsPrefixes };
}

function collectPoliciesByRequester(): Map<string, ToolPolicyRule[]> {
  const contributions = contributionRegistry.getContributions<PolicyContribution>(
    COMPANION_TOOL_POLICIES,
  );
  const byRequester = new Map<string, ToolPolicyRule[]>();

  for (const contribution of contributions) {
    const requester = String(contribution.requester ?? '').trim();
    if (!requester) continue;
    const rules = (contribution.rules ?? []).map(normalizeRule).filter(Boolean) as ToolPolicyRule[];
    if (rules.length === 0) continue;
    byRequester.set(requester, [...(byRequester.get(requester) ?? []), ...rules]);
  }

  return byRequester;
}

async function syncCompanionToolPolicies(): Promise<void> {
  const byRequester = collectPoliciesByRequester();
  if (byRequester.size === 0) return;

  const companion = new CompanionClient();
  for (const [requester, rules] of byRequester) {
    await companion.registerToolPolicies({ requester, rules });
    toastInfo(
      `Tool policies registered from "${requester}": ${rules.length} rule${rules.length !== 1 ? 's' : ''}`
    );
  }
}

function scheduleSync(): void {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = (async () => {
    do {
      syncQueued = false;
      await syncCompanionToolPolicies();
    } while (syncQueued);
  })()
    .catch(() => {
      // Best-effort sync; request-time operations still surface policy errors.
    })
    .finally(() => {
      syncInFlight = undefined;
    });
}

export function initializeCompanionToolPolicyContributions(): void {
  if (initialized) return;
  initialized = true;

  scheduleSync();

  subscribe(TOPIC_CONTRIBUTEIONS_CHANGED, (event?: { target?: string }) => {
    if (event?.target && event.target !== COMPANION_TOOL_POLICIES) return;
    scheduleSync();
  });
}
