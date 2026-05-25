import { getConnectionSecrets } from 'extension-cloud/api';

export interface PortainerPersistData {
  serverUrl: string;
}

function baseUrl(persist: PortainerPersistData): string {
  return persist.serverUrl.trim().replace(/\/$/, '');
}

function headers(connectionId: string): HeadersInit {
  const secrets = getConnectionSecrets(connectionId);
  const apiKey = secrets?.apiKey;
  if (!apiKey) throw new Error('Portainer API key not in session. Reconnect the endpoint.');
  return {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  };
}

export async function portainerFetch(
  connectionId: string,
  persist: PortainerPersistData,
  path: string,
): Promise<Response> {
  const url = `${baseUrl(persist)}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, { headers: headers(connectionId) });
}

export async function validatePortainerCredentials(
  persist: PortainerPersistData,
  apiKey: string,
): Promise<void> {
  const url = `${baseUrl(persist)}/api/status`;
  const res = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Portainer API error ${res.status}`);
}

export async function testPortainerConnection(
  connectionId: string,
  persist: PortainerPersistData,
): Promise<void> {
  const res = await portainerFetch(connectionId, persist, '/api/status');
  if (!res.ok) throw new Error(`Portainer API error ${res.status}`);
}

export interface PortainerEndpoint {
  id: number;
  name: string;
  type: number;
  status?: number;
}

type PortainerEndpointRaw = PortainerEndpoint & {
  Id?: number;
  Name?: string;
  Type?: number;
};

function normalizeEndpoint(raw: PortainerEndpointRaw): PortainerEndpoint {
  return {
    id: raw.id ?? raw.Id ?? 0,
    name: raw.name ?? raw.Name ?? 'endpoint',
    type: raw.type ?? raw.Type ?? 0,
    status: raw.status,
  };
}

export async function listEndpoints(
  connectionId: string,
  persist: PortainerPersistData,
): Promise<PortainerEndpoint[]> {
  const res = await portainerFetch(connectionId, persist, '/api/endpoints');
  if (!res.ok) throw new Error(`list endpoints: ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : [];
  return list.map((raw) => normalizeEndpoint(raw as PortainerEndpointRaw)).filter((ep) => ep.id > 0);
}

export interface PortainerContainer {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
}

export async function listContainers(
  connectionId: string,
  persist: PortainerPersistData,
  endpointId: number,
): Promise<PortainerContainer[]> {
  const res = await portainerFetch(
    connectionId,
    persist,
    `/api/endpoints/${endpointId}/docker/containers/json?all=1`,
  );
  if (!res.ok) throw new Error(`list containers: ${res.status}`);
  return (await res.json()) as PortainerContainer[];
}
