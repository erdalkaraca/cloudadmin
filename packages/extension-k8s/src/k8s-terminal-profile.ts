import { CompanionClient, buildK8sExecWsUrl } from 'extension-companion/api';
import {
  registerTerminalProfile,
  type TerminalBackend,
  type TerminalCreationOptions,
  type TerminalDimensions,
} from '@eclipse-docks/extension-terminal/api';
import {
  formatExecChannelOutput,
  openBearerExecSocket,
  parseExecMessage,
  sendExecResize,
  sendExecStdin,
  type BearerExecSession,
} from './api/k8s-exec-ws';
import { isKubernetesExecRbacError, toastKubernetesExecRbacError } from './k8s-toast';

export const K8S_EXEC_PROFILE_ID = 'k8s.exec';
const LOCAL_PROMPT = '$> ';
const CLUSTER_PROMPT = '$> kubectl ';
const K8S_REQUESTER = 'extension-k8s';

interface K8sExecContext {
  authMode: 'companion' | 'bearer';
  mode: 'pod' | 'cluster';
  connectionId?: string;
  serverUrl?: string;
  kubeContext: string;
  namespace?: string;
  pod?: string;
  container?: string;
  command?: string[];
}

function requireEnvValue(options: TerminalCreationOptions | undefined, key: string): string {
  const value = options?.env?.[key]?.trim();
  if (!value) throw new Error(`Missing terminal option env.${key}`);
  return value;
}

function parseCommand(options: TerminalCreationOptions | undefined): string[] | undefined {
  const raw = options?.env?.K8S_COMMAND?.trim();
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return undefined;
  const command = parsed.map((part) => String(part).trim()).filter(Boolean);
  return command.length > 0 ? command : undefined;
}

function contextFromOptions(options?: TerminalCreationOptions): K8sExecContext {
  const authMode = options?.env?.K8S_AUTH_MODE?.trim() === 'bearer' ? 'bearer' : 'companion';
  const kubeContext = requireEnvValue(options, 'K8S_CONTEXT');
  const target = options?.env?.K8S_TARGET?.trim();
  const pod = options?.env?.K8S_POD?.trim();
  const container = options?.env?.K8S_CONTAINER?.trim();
  const namespace = options?.env?.K8S_NAMESPACE?.trim();

  if (target === 'cluster' || !pod || !container) {
    return {
      authMode,
      mode: 'cluster',
      connectionId: options?.env?.K8S_CONNECTION_ID?.trim(),
      serverUrl: options?.env?.K8S_SERVER_URL?.trim(),
      kubeContext,
      namespace,
    };
  }

  return {
    authMode,
    mode: 'pod',
    connectionId: options?.env?.K8S_CONNECTION_ID?.trim(),
    serverUrl: options?.env?.K8S_SERVER_URL?.trim(),
    kubeContext,
    namespace: requireEnvValue(options, 'K8S_NAMESPACE'),
    pod: requireEnvValue(options, 'K8S_POD'),
    container: requireEnvValue(options, 'K8S_CONTAINER'),
    command: parseCommand(options),
  };
}

class K8sExecTerminalBackend implements TerminalBackend {
  private readonly listeners = new Set<(data: string) => void>();
  private readonly decoder = new TextDecoder();
  private readonly companion = new CompanionClient();
  private socket: WebSocket | null = null;
  private bearerSession: BearerExecSession | undefined;
  private sawCarriageReturn = false;
  private initialPromptShown = false;
  private promptText = LOCAL_PROMPT;
  private localInputLength = 0;
  private awaitingCommandPrompt = false;
  private promptIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private clusterCommandBuffer = '';
  private clusterCommandQueue = Promise.resolve();

  constructor(private readonly context: K8sExecContext) {}

  onDidWrite(callback: (data: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(data: string): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  private emitPrompt(): void {
    this.initialPromptShown = true;
    this.localInputLength = 0;
    this.emit(this.promptText);
  }

  private clearPromptIdleTimer(): void {
    if (!this.promptIdleTimer) return;
    clearTimeout(this.promptIdleTimer);
    this.promptIdleTimer = null;
  }

  private schedulePromptAfterIdle(): void {
    this.clearPromptIdleTimer();
    this.promptIdleTimer = setTimeout(() => {
      this.promptIdleTimer = null;
      if (!this.awaitingCommandPrompt) return;
      this.awaitingCommandPrompt = false;
      this.emitPrompt();
    }, 180);
  }

  private emitLine(data: string): void {
    if (!data) return;
    this.emit(this.normalizeOutput(data));
  }

  private normalizeCommandArgs(raw: string): string[] {
    const tokens = raw.split(/\s+/).map((part) => part.trim()).filter(Boolean);
    if (tokens.length === 0) {
      return [];
    }

    if (tokens[0] === 'whoami') {
      return ['auth', 'whoami', ...tokens.slice(1)];
    }
    if (tokens[0] === 'current-context') {
      return ['config', 'current-context', ...tokens.slice(1)];
    }
    if (tokens[0] === 'use-context') {
      return ['config', 'use-context', ...tokens.slice(1)];
    }

    if (tokens[0] === 'kubectl') {
      return tokens.slice(1);
    }
    return tokens;
  }

  private enqueueClusterCommand(command: string): void {
    this.clusterCommandQueue = this.clusterCommandQueue
      .then(() => this.executeClusterCommand(command))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.emitLine(`Error: ${message}\n`);
        this.emitPrompt();
      });
  }

  private async executeClusterCommand(rawCommand: string): Promise<void> {
    const command = rawCommand.trim();
    if (!command) {
      this.emitPrompt();
      return;
    }

    if (command === 'clear' || command === 'cls') {
      this.emit('\x1bc');
      this.emitPrompt();
      return;
    }

    const args = this.normalizeCommandArgs(command);
    if (args.length === 0) {
      this.emitPrompt();
      return;
    }

    const kubectlArgs: string[] = [...args];
    if (!args.some((arg) => arg === '--context' || arg.startsWith('--context='))) {
      kubectlArgs.push('--context', this.context.kubeContext);
    }

    const result = await this.companion.execTool({
      requester: K8S_REQUESTER,
      tool: 'kubectl',
      args: kubectlArgs,
    });

    if (result.stdout) {
      this.emitLine(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
    }
    if (result.stderr) {
      this.emitLine(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
    }
    if (result.exitCode !== 0 && !result.stderr) {
      this.emitLine(`kubectl exited with code ${result.exitCode}\n`);
    }

    this.emitPrompt();
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
        if (!this.sawCarriageReturn) {
          output += '\r';
        }
        output += '\n';
        this.sawCarriageReturn = false;
        continue;
      }
      this.sawCarriageReturn = false;
      output += ch;
    }
    return output;
  }

  private echoInputLocally(data: string): void {
    if (!data) return;

    for (let index = 0; index < data.length; index += 1) {
      const ch = data[index];
      if (ch === '\r') {
        this.emit('\r\n');
        this.localInputLength = 0;
        continue;
      }
      if (ch === '\x7f' || ch === '\b') {
        if (this.localInputLength <= 0) {
          continue;
        }
        this.emit('\b \b');
        this.localInputLength -= 1;
        continue;
      }
      if (ch === '\t') {
        this.emit('\t');
        this.localInputLength += 1;
        continue;
      }
      if (ch === '\x1b') {
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code >= 32) {
        this.emit(ch);
        this.localInputLength += 1;
      }
    }
  }

  private attachSocketHandlers(socket: WebSocket, onOpen: () => void): void {
    socket.onopen = () => {
      this.socket = socket;
      onOpen();
    };
    socket.onclose = () => {
      this.socket = null;
      this.bearerSession = undefined;
    };
    socket.onmessage = (event) => {
      void this.handleSocketMessage(event.data);
    };
  }

  private async handleSocketMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    if (this.bearerSession) {
      const message = await parseExecMessage(this.bearerSession, data);
      if (!message) return;
      const output = formatExecChannelOutput(message.channel, message.payload);
      if (!output) return;
      this.emit(this.normalizeOutput(output));
      if (this.awaitingCommandPrompt) this.schedulePromptAfterIdle();
      return;
    }

    if (typeof data === 'string') {
      this.emit(this.normalizeOutput(data));
      if (this.awaitingCommandPrompt) this.schedulePromptAfterIdle();
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.emit(this.normalizeOutput(this.decoder.decode(data)));
      if (this.awaitingCommandPrompt) this.schedulePromptAfterIdle();
      return;
    }
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      this.emit(this.normalizeOutput(this.decoder.decode(buffer)));
      if (this.awaitingCommandPrompt) this.schedulePromptAfterIdle();
    }
  }

  private async openCompanionPodExec(initialDimensions?: TerminalDimensions): Promise<void> {
    const wsUrl = buildK8sExecWsUrl({
      context: this.context.kubeContext,
      namespace: this.context.namespace ?? '',
      pod: this.context.pod ?? '',
      container: this.context.container ?? '',
      command: this.context.command,
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      this.attachSocketHandlers(ws, () => {
        this.emit('Connected (no PTY). Type command and press Enter.\r\n');
        queueMicrotask(() => this.emitPrompt());
        resolve();
        if (initialDimensions) {
          this.setDimensions(initialDimensions);
        }
      });
      ws.onerror = () => reject(new Error('Failed to connect to Kubernetes exec socket. Is the companion running?'));
    });
  }

  private async openBearerPodExec(initialDimensions?: TerminalDimensions): Promise<void> {
    const connectionId = this.context.connectionId?.trim();
    const serverUrl = this.context.serverUrl?.trim();
    const namespace = this.context.namespace?.trim();
    const pod = this.context.pod?.trim();
    const container = this.context.container?.trim();
    if (!connectionId || !serverUrl || !namespace || !pod || !container) {
      throw new Error('Bearer exec requires connection, server URL, namespace, pod, and container.');
    }

    const session = await openBearerExecSocket({
      connectionId,
      serverUrl,
      namespace,
      pod,
      container,
      command: this.context.command,
    });

    this.bearerSession = session;
    this.socket = session.socket;
    session.socket.onmessage = (event) => {
      void this.handleSocketMessage(event.data);
    };
    session.socket.onclose = () => {
      this.socket = null;
      this.bearerSession = undefined;
    };

    this.emit('Connected (bearer exec). Type command and press Enter.\r\n');
    queueMicrotask(() => this.emitPrompt());
    if (initialDimensions) {
      this.setDimensions(initialDimensions);
    }
  }

  async open(initialDimensions?: TerminalDimensions): Promise<void> {
    try {
      if (this.context.mode === 'cluster') {
        if (this.context.authMode === 'bearer') {
          throw new Error('Cluster console is not available for bearer connections.');
        }
        this.promptText = CLUSTER_PROMPT;
        this.emit('Connected (cluster mode). Run kubectl commands and press Enter.\r\n');
        queueMicrotask(() => this.emitPrompt());
        void initialDimensions;
        return;
      }

      this.promptText = LOCAL_PROMPT;
      if (this.context.authMode === 'bearer') {
        await this.openBearerPodExec(initialDimensions);
        return;
      }
      await this.openCompanionPodExec(initialDimensions);
    } catch (error) {
      if (isKubernetesExecRbacError(error)) {
        toastKubernetesExecRbacError(error);
        this.close();
        return;
      }
      throw error;
    }
  }

  close(): void {
    this.clearPromptIdleTimer();
    this.socket?.close();
    this.socket = null;
    this.bearerSession = undefined;
    this.initialPromptShown = false;
    this.localInputLength = 0;
    this.awaitingCommandPrompt = false;
    this.clusterCommandBuffer = '';
  }

  handleInput(data: string): void {
    if (!this.initialPromptShown) {
      this.emitPrompt();
    }

    if (this.context.mode === 'cluster') {
      for (let index = 0; index < data.length; index += 1) {
        const ch = data[index];
        if (ch === '\r') {
          this.emit('\r\n');
          const command = this.clusterCommandBuffer;
          this.clusterCommandBuffer = '';
          this.localInputLength = 0;
          this.enqueueClusterCommand(command);
          continue;
        }
        if (ch === '\x7f' || ch === '\b') {
          if (this.localInputLength <= 0 || this.clusterCommandBuffer.length === 0) {
            continue;
          }
          this.clusterCommandBuffer = this.clusterCommandBuffer.slice(0, -1);
          this.localInputLength -= 1;
          this.emit('\b \b');
          continue;
        }
        if (ch === '\x1b') {
          continue;
        }
        if (ch === '\t') {
          this.clusterCommandBuffer += ch;
          this.localInputLength += 1;
          this.emit('\t');
          continue;
        }
        const code = ch.charCodeAt(0);
        if (code >= 32) {
          this.clusterCommandBuffer += ch;
          this.localInputLength += 1;
          this.emit(ch);
        }
      }
      return;
    }

    this.echoInputLocally(data);
    const normalized = data.replace(/\r/g, '\n');
    if (this.bearerSession) {
      sendExecStdin(this.bearerSession, normalized);
    } else {
      this.socket?.send(normalized);
    }

    if (normalized.includes('\n')) {
      this.awaitingCommandPrompt = true;
      this.schedulePromptAfterIdle();
    }
  }

  setDimensions(dimensions: TerminalDimensions): void {
    if (this.bearerSession) {
      sendExecResize(this.bearerSession, dimensions.cols, dimensions.rows);
      return;
    }
    this.socket?.send(JSON.stringify({ resize: dimensions }));
  }
}

export function registerK8sExecTerminalProfile(): void {
  registerTerminalProfile({
    id: K8S_EXEC_PROFILE_ID,
    label: 'Kubernetes Exec',
    icon: 'terminal',
    create: async (options) => new K8sExecTerminalBackend(contextFromOptions(options)),
  });
}
