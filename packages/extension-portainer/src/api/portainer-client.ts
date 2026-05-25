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
  init?: RequestInit,
): Promise<Response> {
  const url = `${baseUrl(persist)}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      ...headers(connectionId),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
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

function containerPath(endpointId: number, containerId: string, suffix: string): string {
  const id = encodeURIComponent(containerId);
  return `/api/endpoints/${endpointId}/docker/containers/${id}${suffix}`;
}

/** Docker multiplexed log stream: 8-byte header then payload per frame. */
function decodeDockerLogStream(data: ArrayBuffer): string {
  const view = new DataView(data);
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let offset = 0;

  while (offset + 8 <= view.byteLength) {
    const stream = view.getUint8(offset);
    if (stream !== 1 && stream !== 2) break;
    const size = view.getUint32(offset + 4, false);
    offset += 8;
    if (size <= 0 || offset + size > view.byteLength) break;
    parts.push(decoder.decode(new Uint8Array(data, offset, size)));
    offset += size;
  }

  if (parts.length > 0) return parts.join('');
  return decoder.decode(data);
}

export async function getContainerLogs(
  connectionId: string,
  persist: PortainerPersistData,
  endpointId: number,
  containerId: string,
  tail = 500,
): Promise<string> {
  const query = new URLSearchParams({
    stdout: 'true',
    stderr: 'true',
    tail: String(tail),
    timestamps: 'false',
  });
  const res = await portainerFetch(
    connectionId,
    persist,
    `${containerPath(endpointId, containerId, '/logs')}?${query}`,
  );
  if (!res.ok) throw new Error(`container logs: ${res.status}`);
  return decodeDockerLogStream(await res.arrayBuffer());
}

export async function inspectContainer(
  connectionId: string,
  persist: PortainerPersistData,
  endpointId: number,
  containerId: string,
): Promise<unknown> {
  const res = await portainerFetch(
    connectionId,
    persist,
    containerPath(endpointId, containerId, '/json'),
  );
  if (!res.ok) throw new Error(`inspect container: ${res.status}`);
  return res.json();
}

export type ContainerLifecycleOp = 'start' | 'stop' | 'restart';

export async function containerLifecycle(
  connectionId: string,
  persist: PortainerPersistData,
  endpointId: number,
  containerId: string,
  operation: ContainerLifecycleOp,
): Promise<void> {
  const res = await portainerFetch(
    connectionId,
    persist,
    containerPath(endpointId, containerId, `/${operation}`),
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${operation} container: ${res.status} ${body.slice(0, 120)}`);
  }
}
