export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface CompanionHealth {
  ok: boolean;
  version?: string;
}

export interface RunRequest {
  commandId: string;
  input: Record<string, unknown>;
  runId?: string;
}

export interface RunResponse {
  runId: string;
  status: RunStatus;
  output?: Record<string, unknown>;
  error?: string;
}

export interface K8sProxyRequest {
  requester?: string;
  kubeconfigPath?: string;
  context?: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface K8sProxyResponse {
  status: number;
  contentType?: string;
  body: string;
}

export interface ToolPolicyRule {
  tool: string;
  allowedArgsPrefixes: string[][];
}

export interface RegisterToolPoliciesRequest {
  requester: string;
  rules: ToolPolicyRule[];
}

export interface RegisterToolPoliciesResponse {
  ok: boolean;
  requester: string;
  rulesCount: number;
}

export interface ToolExecRequest {
  requester: string;
  tool: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ToolExecResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ToolInstallRequest {
  requester: string;
  tool: string;
  version: string;
  os?: string;
  arch?: string;
  force?: boolean;
}

export interface ToolInstallResponse {
  ok: boolean;
  version: string;
  url: string;
  path: string;
  sha256: string;
  downloaded: boolean;
}

export const COMPANION_TOOL_POLICIES = 'companion.toolPolicies';

export interface CompanionToolPolicyContribution {
  name?: string;
  label?: string;
  requester: string;
  rules: ToolPolicyRule[];
}

export const DEFAULT_COMPANION_BASE = 'http://127.0.0.1:9477';

export class CompanionClient {
  constructor(private readonly baseUrl: string = DEFAULT_COMPANION_BASE) {}

  async health(): Promise<CompanionHealth> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      if (!res.ok) return { ok: false };
      const body = (await res.json()) as { version?: string };
      return { ok: true, version: body.version };
    } catch {
      return { ok: false };
    }
  }

  async startRun(request: RunRequest): Promise<RunResponse> {
    const res = await fetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`Companion /runs failed: ${res.status}`);
    return (await res.json()) as RunResponse;
  }

  async getRun(runId: string): Promise<RunResponse> {
    const res = await fetch(`${this.baseUrl}/runs/${encodeURIComponent(runId)}`);
    if (!res.ok) throw new Error(`Companion get run failed: ${res.status}`);
    return (await res.json()) as RunResponse;
  }

  async proxyKubernetes(request: K8sProxyRequest): Promise<K8sProxyResponse> {
    const res = await fetch(`${this.baseUrl}/k8s/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return {
      status: res.status,
      contentType: res.headers.get('Content-Type') ?? undefined,
      body: await res.text(),
    };
  }

  async registerToolPolicies(
    request: RegisterToolPoliciesRequest,
  ): Promise<RegisterToolPoliciesResponse> {
    console.warn(
      `[Companion] Registering ${request.rules.length} tool policies from "${request.requester}"`,
      request.rules,
    );

    const res = await fetch(`${this.baseUrl}/tools/policies/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Companion tool policy register failed: ${res.status}${body ? `: ${body}` : ''}`);
    }

    const result = (await res.json()) as RegisterToolPoliciesResponse;
    console.info(
      `[Companion] Successfully registered ${result.rulesCount} tool policies from "${result.requester}"`,
    );
    return result;
  }

  async execTool(request: ToolExecRequest): Promise<ToolExecResponse> {
    const res = await fetch(`${this.baseUrl}/tools/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Companion tool exec failed: ${res.status}${body ? `: ${body}` : ''}`);
    }
    return (await res.json()) as ToolExecResponse;
  }

  async installTool(request: ToolInstallRequest): Promise<ToolInstallResponse> {
    const res = await fetch(`${this.baseUrl}/tools/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Companion tool install failed: ${res.status}${body ? `: ${body}` : ''}`);
    }
    return (await res.json()) as ToolInstallResponse;
  }
}
