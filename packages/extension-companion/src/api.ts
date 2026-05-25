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
}
