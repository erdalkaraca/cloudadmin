import { toastError } from '@eclipse-docks/core';

export function formatK8sError(err: unknown, fallback = 'Kubernetes operation failed'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}

export function isKubernetesExecRbacError(err: unknown): boolean {
  const message = formatK8sError(err, '');
  return (
    /pods\/exec/i.test(message) ||
    /cannot get resource/i.test(message) ||
    /exec forbidden/i.test(message)
  );
}

export function toastKubernetesExecRbacError(err: unknown): void {
  toastError(formatK8sError(err, 'Kubernetes exec forbidden. Grant pods/exec get permission.'));
}
