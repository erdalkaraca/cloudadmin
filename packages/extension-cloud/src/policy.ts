export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

/** Personal-mode default: allow browser-direct operations. */
export function evaluateDirectOperation(_operationId: string): PolicyDecision {
  return { allowed: true };
}
