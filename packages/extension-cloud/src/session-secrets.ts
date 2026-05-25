import { appSettings } from '@eclipse-docks/core';

/** Stored under workspace settings (`.eclipse-docks/settings.json`), not in `connections.json`. */
const SECRETS_PATH = 'cloudadmin.connectionSecrets';

const secretsByConnection = new Map<string, Record<string, string>>();

let settingsHydrated = false;
let hydratePromise: Promise<void> | null = null;

async function loadAllFromAppSettings(): Promise<Record<string, Record<string, string>>> {
  const value = await appSettings.getAt(SECRETS_PATH);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Record<string, string>>;
}

async function saveAllToAppSettings(all: Record<string, Record<string, string>>): Promise<void> {
  await appSettings.setAt(SECRETS_PATH, all);
}

/** Load all connection secrets from Docks appSettings into memory. */
export async function hydrateAllConnectionSecrets(): Promise<void> {
  if (settingsHydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const all = await loadAllFromAppSettings();
      secretsByConnection.clear();
      for (const [connectionId, secrets] of Object.entries(all)) {
        if (secrets && typeof secrets === 'object') {
          secretsByConnection.set(connectionId, { ...secrets });
        }
      }
      settingsHydrated = true;
    })();
  }
  await hydratePromise;
}

/** @deprecated Prefer {@link hydrateAllConnectionSecrets} at startup. */
export async function hydrateConnectionSecrets(connectionId: string): Promise<void> {
  await hydrateAllConnectionSecrets();
  if (!secretsByConnection.has(connectionId)) {
    const all = await loadAllFromAppSettings();
    const stored = all[connectionId];
    if (stored) secretsByConnection.set(connectionId, { ...stored });
  }
}

export async function setConnectionSecrets(
  connectionId: string,
  secrets: Record<string, string>,
): Promise<void> {
  await hydrateAllConnectionSecrets();
  secretsByConnection.set(connectionId, { ...secrets });
  const all = await loadAllFromAppSettings();
  all[connectionId] = { ...secrets };
  await saveAllToAppSettings(all);
}

/** Sync read from memory; call {@link hydrateAllConnectionSecrets} before relying on persisted values. */
export function getConnectionSecrets(connectionId: string): Record<string, string> | undefined {
  return secretsByConnection.get(connectionId);
}

export async function clearConnectionSecrets(connectionId: string): Promise<void> {
  await hydrateAllConnectionSecrets();
  secretsByConnection.delete(connectionId);
  const all = await loadAllFromAppSettings();
  delete all[connectionId];
  await saveAllToAppSettings(all);
}
