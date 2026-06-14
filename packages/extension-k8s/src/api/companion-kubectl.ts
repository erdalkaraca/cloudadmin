import { CompanionClient } from 'extension-companion/api';
import type { KubeconfigContextEntry, KubeconfigServerEntry } from './k8s-types';

export const K8S_REQUESTER = 'extension-k8s';

interface KubeconfigView {
  ['current-context']?: string;
  contexts?: Array<{
    name?: string;
    context?: {
      cluster?: string;
      namespace?: string;
    };
  }>;
  clusters?: Array<{ name?: string; cluster?: { server?: string } }>;
}

let companionInitPromise: Promise<void> | undefined;

async function fetchStableKubectlVersion(): Promise<string> {
  const res = await fetch('https://dl.k8s.io/release/stable.txt');
  if (!res.ok) throw new Error(`stable kubectl lookup failed: ${res.status}`);
  const version = (await res.text()).trim();
  if (!version) throw new Error('stable kubectl lookup returned empty version');
  return version;
}

export async function ensureCompanionK8sSetup(): Promise<void> {
  if (!companionInitPromise) {
    companionInitPromise = (async () => {
      const companion = new CompanionClient();
      const stableVersion = await fetchStableKubectlVersion();
      await companion.installTool({
        requester: K8S_REQUESTER,
        tool: 'kubectl',
        version: stableVersion,
      });
    })().catch((error) => {
      companionInitPromise = undefined;
      throw error;
    });
  }
  await companionInitPromise;
}

async function inferContextsFromKubeconfig(
  companion: CompanionClient,
  env?: Record<string, string>,
): Promise<{ contexts: string[]; currentContext?: string }> {
  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const contexts = (parsed.contexts ?? [])
    .map((entry) => entry.name?.trim())
    .filter((value): value is string => Boolean(value));
  const currentContext = parsed['current-context']?.trim() || undefined;
  return { contexts: [...new Set(contexts)], currentContext };
}

export async function listKubeconfigContexts(
  kubeconfigPath?: string,
): Promise<{ contexts: string[]; currentContext?: string }> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const contextsResult = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'get-contexts', '-o', 'name'],
    env,
  });
  if (contextsResult.exitCode !== 0) {
    return inferContextsFromKubeconfig(companion, env);
  }

  const currentResult = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'current-context'],
    env,
  });
  if (currentResult.exitCode !== 0) {
    return inferContextsFromKubeconfig(companion, env);
  }

  const contexts = contextsResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const currentContext = currentResult.stdout.trim() || undefined;
  return { contexts: [...new Set(contexts)], currentContext };
}

export async function listKubeconfigServers(
  kubeconfigPath?: string,
): Promise<KubeconfigServerEntry[]> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const seen = new Set<string>();
  const entries: KubeconfigServerEntry[] = [];
  for (const entry of parsed.clusters ?? []) {
    const serverUrl = entry.cluster?.server?.trim();
    if (!serverUrl) continue;
    const name = entry.name?.trim() || serverUrl;
    const dedupeKey = `${name}::${serverUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push({ name, serverUrl });
  }
  return entries;
}

export async function listKubeconfigContextEntries(
  kubeconfigPath?: string,
): Promise<KubeconfigContextEntry[]> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const env = kubeconfigPath?.trim() ? { KUBECONFIG: kubeconfigPath.trim() } : undefined;

  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
    env,
  });
  if (result.exitCode !== 0) {
    throw new Error(`kubectl config view failed: ${result.stderr || result.exitCode}`);
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const clusterByName = new Map<string, string>();
  for (const cluster of parsed.clusters ?? []) {
    const name = cluster.name?.trim();
    const serverUrl = cluster.cluster?.server?.trim();
    if (!name || !serverUrl) continue;
    clusterByName.set(name, serverUrl);
  }

  const entries: KubeconfigContextEntry[] = [];
  for (const context of parsed.contexts ?? []) {
    const name = context.name?.trim();
    if (!name) continue;
    const clusterName = context.context?.cluster?.trim();
    entries.push({
      name,
      namespace: context.context?.namespace?.trim() || undefined,
      serverUrl: clusterName ? clusterByName.get(clusterName) : undefined,
    });
  }

  return entries;
}

export async function inferNamespacesFromKubeconfig(
  contextName?: string,
): Promise<Array<{ name: string; uid: string }>> {
  await ensureCompanionK8sSetup();
  const companion = new CompanionClient();
  const result = await companion.execTool({
    requester: K8S_REQUESTER,
    tool: 'kubectl',
    args: ['config', 'view', '-o', 'json'],
  });
  if (result.exitCode !== 0) {
    return [];
  }

  const parsed = JSON.parse(result.stdout) as KubeconfigView;
  const wantedContext = contextName?.trim();
  const currentContext = parsed['current-context']?.trim();
  const selected = wantedContext || currentContext;

  const fromSelected = (parsed.contexts ?? [])
    .filter((entry) => (selected ? entry.name?.trim() === selected : false))
    .map((entry) => entry.context?.namespace?.trim())
    .filter((value): value is string => Boolean(value));

  const fromAll = (parsed.contexts ?? [])
    .map((entry) => entry.context?.namespace?.trim())
    .filter((value): value is string => Boolean(value));

  const namespaces = [...new Set([...(fromSelected.length > 0 ? fromSelected : fromAll), 'default'])];
  return namespaces.map((name) => ({ name, uid: `inferred:${name}` }));
}
