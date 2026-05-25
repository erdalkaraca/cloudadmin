import type { CloudWorkloadHandler } from './models';

const handlers = new Map<string, CloudWorkloadHandler>();

export const cloudWorkloadRegistry = {
  register(handler: CloudWorkloadHandler): void {
    handlers.set(handler.providerId, handler);
  },

  getHandler(providerId: string): CloudWorkloadHandler | undefined {
    return handlers.get(providerId);
  },
};
