import { toastError } from '@eclipse-docks/core';

export function formatCloudError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}

export function isUserCancelled(err: unknown): boolean {
  return err instanceof Error && err.message === 'Cancelled';
}

/** Show a toast for failures; skips intentional cancel (e.g. dialog Cancel). */
export function toastCloudError(err: unknown, fallback?: string): void {
  if (isUserCancelled(err)) return;
  toastError(formatCloudError(err, fallback));
}

export async function runCloudAction(action: () => void | Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    toastCloudError(err);
  }
}
