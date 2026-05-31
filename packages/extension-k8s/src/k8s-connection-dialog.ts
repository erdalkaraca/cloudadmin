import {
  DocksDialogContent,
  contributionRegistry,
  dialogService,
} from '@eclipse-docks/core';
import {
  css,
  customElement,
  html,
  property,
  state,
  type PropertyValues,
} from '@eclipse-docks/core/externals/lit';
import type { KubeconfigServerEntry } from './api/k8s-client';

const K8S_CONNECTION_DIALOG_ID = 'k8s.connection.form';
const DIALOG_TARGET = 'dialogs';
const OK_BUTTON = { id: 'ok', label: 'OK', variant: 'primary' as const };
const CANCEL_BUTTON = { id: 'cancel', label: 'Cancel' };

interface K8sConnectionDialogState {
  label: string;
  message?: string;
  markdown?: boolean;
  initialValues: Record<string, string>;
  availableServers: KubeconfigServerEntry[];
  includeToken?: boolean;
  tokenLabel?: string;
  resolve: (values: Record<string, string> | null) => void;
}

@customElement('docks-k8s-connection-dialog-content')
class DocksK8sConnectionDialogContent extends DocksDialogContent {
  @property({ attribute: false })
  initialValues: Record<string, string> = {};

  @property({ attribute: false })
  availableServers: KubeconfigServerEntry[] = [];

  @property({ type: Boolean })
  includeToken = false;

  @property({ type: String })
  tokenLabel = 'Bearer token';

  @property({ type: String })
  message = '';

  @property({ type: Boolean })
  markdown = false;

  @state()
  private values: Record<string, string> = {};

  @state()
  private validationError = '';

  async firstUpdated(_changed: PropertyValues): Promise<void> {
    this.values = { ...this.initialValues };
    await this.updateComplete;
    const firstInput = this.shadowRoot
      ?.querySelector('wa-input')
      ?.shadowRoot?.querySelector('input') as HTMLInputElement | undefined;
    firstInput?.focus();
  }

  getResult(): Record<string, string> {
    return { ...this.values };
  }

  setValidationError(message: string): void {
    this.validationError = message;
  }

  private updateValue(name: string, value: string): void {
    this.values = { ...this.values, [name]: value };
    if (this.validationError) this.validationError = '';
  }

  private onServerSelect(event: Event): void {
    const item = (event as CustomEvent<{ item?: { value?: string } }>).detail?.item;
    const value = item?.value?.trim();
    if (value) this.updateValue('serverUrl', value);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent('dialog-ok', { bubbles: true, composed: true }));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.dispatchEvent(new CustomEvent('dialog-cancel', { bubbles: true, composed: true }));
    }
  }

  render() {
    return html`
      ${this.message ? this.renderMessage(this.message, this.markdown) : null}
      <div class="form-fields" @keydown=${this.handleKeyDown}>
        <label>
          <span class="field-label">Connection name</span>
          <wa-input
            .value=${this.values.name ?? ''}
            @input=${(event: Event) =>
              this.updateValue('name', (event.target as HTMLInputElement).value)}
          ></wa-input>
        </label>

        <label>
          <span class="field-label">API server URL</span>
          <div class="server-row">
            <wa-input
              type="url"
              .value=${this.values.serverUrl ?? ''}
              placeholder="Optional"
              @input=${(event: Event) =>
                this.updateValue('serverUrl', (event.target as HTMLInputElement).value)}
            ></wa-input>
            ${this.availableServers.length > 0
              ? html`
                  <wa-dropdown @wa-select=${this.onServerSelect}>
                    <wa-button slot="trigger" size="small" appearance="outlined"
                      >Available servers</wa-button
                    >
                    ${this.availableServers.map(
                      (server) =>
                        html`<wa-dropdown-item value=${server.serverUrl}
                          >${server.name} (${server.serverUrl})</wa-dropdown-item
                        >`,
                    )}
                  </wa-dropdown>
                `
              : null}
          </div>
        </label>

        <label>
          <span class="field-label">Contexts</span>
          <wa-input
            .value=${this.values.contexts ?? ''}
            placeholder="Comma-separated, e.g. default, lab"
            @input=${(event: Event) =>
              this.updateValue('contexts', (event.target as HTMLInputElement).value)}
          ></wa-input>
        </label>

        ${this.includeToken
          ? html`
              <label>
                <span class="field-label">${this.tokenLabel}</span>
                <wa-input
                  type="password"
                  password-toggle
                  .value=${this.values.token ?? ''}
                  placeholder="Required"
                  @input=${(event: Event) =>
                    this.updateValue('token', (event.target as HTMLInputElement).value)}
                ></wa-input>
              </label>
            `
          : null}

        ${this.validationError
          ? html`<div class="validation-error">${this.validationError}</div>`
          : null}
      </div>
    `;
  }

  static styles = [
    css`
      .form-fields {
        display: grid;
        gap: 0.75rem;
      }
      .field-label {
        font-weight: 500;
        color: var(--wa-color-text-normal);
      }
      wa-input {
        width: 100%;
      }
      .server-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }
      .validation-error {
        color: var(--wa-color-danger-600, #dc2626);
        font-size: var(--wa-font-size-s);
      }
    `,
  ];
}

let registered = false;

export function registerK8sConnectionDialog(): void {
  if (registered) return;
  registered = true;

  contributionRegistry.registerContribution(DIALOG_TARGET, {
    id: K8S_CONNECTION_DIALOG_ID,
    label: 'Kubernetes connection form',
    buttons: [OK_BUTTON, CANCEL_BUTTON],
    component: (state?: K8sConnectionDialogState) => {
      if (!state) return html`<div>Error: No Kubernetes connection dialog state</div>`;
      return html`
        <docks-k8s-connection-dialog-content
          .initialValues=${state.initialValues}
          .availableServers=${state.availableServers}
          .includeToken=${state.includeToken ?? false}
          .tokenLabel=${state.tokenLabel ?? 'Bearer token'}
          .message=${state.message ?? ''}
          .markdown=${state.markdown ?? false}
        ></docks-k8s-connection-dialog-content>
      `;
    },
    onButton: async (id: string, result: unknown, state?: K8sConnectionDialogState) => {
      if (!state) return true;
      if (id === 'ok') {
        const values = Object.fromEntries(
          Object.entries((result ?? {}) as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v ?? '').trim(),
          ]),
        );
        if (!values.name) {
          const el = document.querySelector(
            'docks-k8s-connection-dialog-content',
          ) as DocksK8sConnectionDialogContent | null;
          el?.setValidationError('Connection name is required.');
          return false;
        }
        if (state.includeToken && !values.token) {
          const el = document.querySelector(
            'docks-k8s-connection-dialog-content',
          ) as DocksK8sConnectionDialogContent | null;
          el?.setValidationError('Bearer token is required.');
          return false;
        }
        state.resolve(values);
      } else {
        state.resolve(null);
      }
      return true;
    },
  });
}

export async function k8sConnectionDialogRequired(options: {
  label: string;
  message?: string;
  markdown?: boolean;
  initialValues: Record<string, string>;
  availableServers: KubeconfigServerEntry[];
  includeToken?: boolean;
  tokenLabel?: string;
}): Promise<Record<string, string>> {
  const values = await new Promise<Record<string, string> | null>((resolve) => {
    void dialogService.open(K8S_CONNECTION_DIALOG_ID, {
      ...options,
      resolve,
    } satisfies K8sConnectionDialogState);
  });

  if (!values) throw new Error('Cancelled');
  return values;
}
