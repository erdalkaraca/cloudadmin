import { getConnectionSecrets } from 'extension-cloud/api';
import {
  registerTerminalProfile,
  type TerminalBackend,
  type TerminalCreationOptions,
  type TerminalDimensions,
} from '@eclipse-docks/extension-terminal/api';
import { toastError } from '@eclipse-docks/core';
import {
  buildPortainerExecWsUrl,
  createContainerExec,
  resizeContainerExec,
  type PortainerPersistData,
} from './api/portainer-client';

export const PORTAINER_EXEC_PROFILE_ID = 'portainer.exec';

interface PortainerExecContext {
  connectionId: string;
  persist: PortainerPersistData;
  endpointId: number;
  containerId: string;
  command: string[];
}

function requireEnvValue(options: TerminalCreationOptions | undefined, key: string): string {
  const value = options?.env?.[key]?.trim();
  if (!value) throw new Error(`Missing terminal option env.${key}`);
  return value;
}

function parseCommand(options: TerminalCreationOptions | undefined): string[] {
  const raw = options?.env?.PORTAINER_COMMAND?.trim();
  if (!raw) return ['/bin/sh'];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return ['/bin/sh'];
  const command = parsed.map((part) => String(part).trim()).filter(Boolean);
  return command.length > 0 ? command : ['/bin/sh'];
}

function contextFromOptions(options?: TerminalCreationOptions): PortainerExecContext {
  return {
    connectionId: requireEnvValue(options, 'PORTAINER_CONNECTION_ID'),
    persist: { serverUrl: requireEnvValue(options, 'PORTAINER_SERVER_URL') },
    endpointId: Number(requireEnvValue(options, 'PORTAINER_ENDPOINT_ID')),
    containerId: requireEnvValue(options, 'PORTAINER_CONTAINER_ID'),
    command: parseCommand(options),
  };
}

function formatExecError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return 'Failed to open Portainer container console.';
}

class PortainerExecTerminalBackend implements TerminalBackend {
  private readonly listeners = new Set<(data: string) => void>();
  private readonly decoder = new TextDecoder();
  private socket: WebSocket | null = null;
  private sawCarriageReturn = false;
  private execId: string | null = null;

  constructor(private readonly context: PortainerExecContext) {}

  onDidWrite(callback: (data: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(data: string): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  private normalizeOutput(data: string): string {
    if (!data) return data;

    let output = '';
    for (let index = 0; index < data.length; index += 1) {
      const ch = data[index];
      if (ch === '\r') {
        this.sawCarriageReturn = true;
        output += '\r';
        continue;
      }
      if (ch === '\n') {
        if (!this.sawCarriageReturn) output += '\r';
        output += '\n';
        this.sawCarriageReturn = false;
        continue;
      }
      this.sawCarriageReturn = false;
      output += ch;
    }
    return output;
  }

  private emitSocketData(data: string | ArrayBuffer | Blob): void {
    if (typeof data === 'string') {
      this.emit(this.normalizeOutput(data));
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.emit(this.normalizeOutput(this.decoder.decode(data)));
      return;
    }
    void data.arrayBuffer().then((buffer) => {
      this.emit(this.normalizeOutput(this.decoder.decode(buffer)));
    });
  }

  async open(initialDimensions?: TerminalDimensions): Promise<void> {
    try {
      const apiKey = getConnectionSecrets(this.context.connectionId)?.apiKey?.trim();
      if (!apiKey) {
        throw new Error('Portainer API key not in session. Reconnect the endpoint.');
      }

      const execId = await createContainerExec(this.context.connectionId, this.context.persist, {
        endpointId: this.context.endpointId,
        containerId: this.context.containerId,
        command: this.context.command,
      });
      this.execId = execId;

      const wsUrl = buildPortainerExecWsUrl(this.context.persist, {
        endpointId: this.context.endpointId,
        execId,
        apiKey,
      });

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          this.socket = ws;
          resolve();
          if (initialDimensions) {
            this.setDimensions(initialDimensions);
          }
        };
        ws.onerror = () => reject(new Error('Failed to connect to Portainer exec socket.'));
        ws.onclose = () => {
          this.socket = null;
        };
        ws.onmessage = (event) => {
          this.emitSocketData(event.data);
        };
      });
    } catch (error) {
      toastError(formatExecError(error));
      this.close();
    }
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.execId = null;
  }

  handleInput(data: string): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(data);
  }

  setDimensions(dimensions: TerminalDimensions): void {
    const execId = this.execId;
    if (!execId) return;
    void resizeContainerExec(
      this.context.connectionId,
      this.context.persist,
      this.context.endpointId,
      execId,
      dimensions,
    );
  }
}

export function registerPortainerExecTerminalProfile(): void {
  registerTerminalProfile({
    id: PORTAINER_EXEC_PROFILE_ID,
    label: 'Portainer Exec',
    icon: 'terminal',
    create: async (options) => new PortainerExecTerminalBackend(contextFromOptions(options)),
  });
}
