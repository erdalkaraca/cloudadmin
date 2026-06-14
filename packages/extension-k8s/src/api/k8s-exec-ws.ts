import { getConnectionSecrets } from 'extension-cloud/api';

const BEARER_SUBPROTOCOL_PREFIX = 'base64url.bearer.authorization.k8s.io.';

const CHANNEL_STDIN = 0;
const CHANNEL_STDOUT = 1;
const CHANNEL_STDERR = 2;
const CHANNEL_ERROR = 3;
const CHANNEL_RESIZE = 4;

const CHANNEL_PROTOCOL_CANDIDATES = [
  'v4.channel.k8s.io',
  'v3.channel.k8s.io',
  'channel.k8s.io',
  'base64.channel.k8s.io',
] as const;

export type ExecChannelProtocol = (typeof CHANNEL_PROTOCOL_CANDIDATES)[number];

export interface BearerExecWsParams {
  connectionId: string;
  serverUrl: string;
  namespace: string;
  pod: string;
  container: string;
  command?: string[];
}

export interface BearerExecSession {
  socket: WebSocket;
  channelProtocol: ExecChannelProtocol;
  usesBase64Framing: boolean;
}

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function getBearerToken(connectionId: string): string {
  const token = getConnectionSecrets(connectionId)?.token?.trim();
  if (!token) {
    throw new Error('Bearer token not in session. Reconnect the Kubernetes connection.');
  }
  return token;
}

function buildBearerExecUrl(params: BearerExecWsParams): URL {
  const base = normalizeServerUrl(params.serverUrl);
  if (!base) throw new Error('API server URL is required for bearer exec.');

  const url = new URL(
    `/api/v1/namespaces/${encodeURIComponent(params.namespace)}/pods/${encodeURIComponent(params.pod)}/exec`,
    `${base}/`,
  );

  const command = params.command?.length ? params.command : ['/bin/sh'];
  for (const part of command) {
    url.searchParams.append('command', part);
  }
  url.searchParams.set('container', params.container);
  url.searchParams.set('stdin', 'true');
  url.searchParams.set('stdout', 'true');
  url.searchParams.set('stderr', 'true');
  url.searchParams.set('tty', 'false');
  return url;
}

export function buildBearerExecWsUrl(params: BearerExecWsParams): string {
  const url = buildBearerExecUrl(params);
  return url.toString().replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

function buildBearerExecHttpUrl(params: BearerExecWsParams): string {
  return buildBearerExecUrl(params).toString();
}

export function bearerExecProtocols(token: string, channelProtocol: string): string[] {
  return [`${BEARER_SUBPROTOCOL_PREFIX}${encodeBase64Url(token)}`, channelProtocol];
}

function usesBase64Framing(channelProtocol: ExecChannelProtocol): boolean {
  return channelProtocol === 'base64.channel.k8s.io';
}

const EXEC_GET_RBAC_HINT =
  'Browser exec requires RBAC verb get on pods/exec (not just create). ' +
  'Grant: resources: ["pods/exec"], verbs: ["get"].';

function formatExecForbiddenError(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return `Kubernetes exec forbidden. ${EXEC_GET_RBAC_HINT}`;
  }

  try {
    const parsed = JSON.parse(trimmed) as { message?: string };
    const message = parsed.message?.trim();
    if (message) {
      if (/pods\/exec/i.test(message) || /cannot get resource/i.test(message)) {
        return `${message} ${EXEC_GET_RBAC_HINT}`;
      }
      return message;
    }
  } catch {
    // Fall through to raw body.
  }

  return trimmed.includes('pods/exec') || trimmed.includes('cannot get resource')
    ? `${trimmed} ${EXEC_GET_RBAC_HINT}`
    : trimmed;
}

export async function probeBearerExecAccess(params: BearerExecWsParams): Promise<void> {
  const token = getBearerToken(params.connectionId);
  const res = await fetch(buildBearerExecHttpUrl(params), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  });

  if (res.status === 401) {
    throw new Error('Bearer token rejected by API server. Reconnect the Kubernetes connection.');
  }
  if (res.status === 403) {
    const body = await res.text();
    throw new Error(formatExecForbiddenError(body));
  }
}

export function sendExecStdin(session: BearerExecSession, data: string): void {
  if (session.usesBase64Framing) {
    session.socket.send(`0${btoa(data)}`);
    return;
  }

  const encoded = new TextEncoder().encode(data);
  const buffer = new Uint8Array(encoded.length + 1);
  buffer[0] = CHANNEL_STDIN;
  buffer.set(encoded, 1);
  session.socket.send(buffer);
}

export function sendExecResize(session: BearerExecSession, cols: number, rows: number): void {
  const payload = JSON.stringify({ Width: cols, Height: rows });
  if (session.usesBase64Framing) {
    session.socket.send(`${CHANNEL_RESIZE}${btoa(payload)}`);
    return;
  }

  const encoded = new TextEncoder().encode(payload);
  const buffer = new Uint8Array(encoded.length + 1);
  buffer[0] = CHANNEL_RESIZE;
  buffer.set(encoded, 1);
  session.socket.send(buffer);
}

export function parseExecMessage(
  session: BearerExecSession,
  data: string | ArrayBuffer | Blob,
): Promise<{ channel: number; payload: string } | null> {
  if (session.usesBase64Framing) {
    if (typeof data !== 'string' || data.length === 0) return Promise.resolve(null);
    const channel = Number(data[0]);
    if (!Number.isInteger(channel)) return Promise.resolve(null);
    return Promise.resolve({
      channel,
      payload: decodeBase64(data.slice(1)),
    });
  }

  if (typeof data === 'string') {
    return Promise.resolve({ channel: CHANNEL_STDOUT, payload: data });
  }

  const toBuffer = data instanceof ArrayBuffer ? Promise.resolve(data) : data.arrayBuffer();
  return toBuffer.then((buffer) => {
    const view = new Uint8Array(buffer);
    if (view.length === 0) return null;
    return {
      channel: view[0],
      payload: new TextDecoder().decode(view.subarray(1)),
    };
  });
}

export function formatExecChannelOutput(channel: number, payload: string): string {
  if (channel === CHANNEL_ERROR) {
    try {
      const parsed = JSON.parse(payload) as { message?: string; status?: string };
      const status = parsed.status?.trim();
      const message = parsed.message?.trim();
      if (status && message) return `Error: ${status}: ${message}\n`;
      if (message) return `Error: ${message}\n`;
    } catch {
      // Fall through to raw payload.
    }
    return payload ? `Error: ${payload}\n` : '';
  }
  if (channel === CHANNEL_STDERR) {
    return payload.endsWith('\n') ? payload : `${payload}\n`;
  }
  if (channel === CHANNEL_STDOUT) {
    return payload;
  }
  return '';
}

async function openBearerExecSocketOnce(
  wsUrl: string,
  token: string,
  channelProtocol: ExecChannelProtocol,
  timeoutMs: number,
): Promise<BearerExecSession> {
  return new Promise<BearerExecSession>((resolve, reject) => {
    const socket = new WebSocket(wsUrl, bearerExecProtocols(token, channelProtocol));
    socket.binaryType = 'arraybuffer';

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Kubernetes exec timed out while negotiating ${channelProtocol}.`));
    }, timeoutMs);

    const finish = (handler: 'resolve' | 'reject', value: BearerExecSession | Error) => {
      clearTimeout(timeout);
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      if (handler === 'resolve') {
        resolve(value as BearerExecSession);
        return;
      }
      reject(value as Error);
    };

    const onOpen = () => {
      finish('resolve', {
        socket,
        channelProtocol,
        usesBase64Framing: usesBase64Framing(channelProtocol),
      });
    };
    const onError = () => {
      finish('reject', new Error(`Failed to connect using ${channelProtocol}.`));
    };
    const onClose = (event: CloseEvent) => {
      if (socket.readyState === WebSocket.OPEN) return;
      const detail = event.reason?.trim();
      finish(
        'reject',
        new Error(
          detail
            ? `Kubernetes exec WebSocket closed (${event.code}): ${detail}`
            : `Kubernetes exec WebSocket closed (${event.code}) while using ${channelProtocol}.`,
        ),
      );
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}

export async function openBearerExecSocket(
  params: BearerExecWsParams,
  timeoutMs = 15_000,
): Promise<BearerExecSession> {
  await probeBearerExecAccess(params);

  const token = getBearerToken(params.connectionId);
  const wsUrl = buildBearerExecWsUrl(params);
  let lastError: Error | undefined;

  for (const channelProtocol of CHANNEL_PROTOCOL_CANDIDATES) {
    try {
      return await openBearerExecSocketOnce(wsUrl, token, channelProtocol, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Failed to connect to Kubernetes exec WebSocket.');
}
