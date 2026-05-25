import { DocksElement } from '@eclipse-docks/core';
import { css, customElement, html, state } from '@eclipse-docks/core/externals/lit';
import { CompanionClient } from './api';

@customElement('cloudadmin-companion-status')
export class CloudAdminCompanionStatus extends DocksElement {
  @state()
  private ready = false;

  @state()
  private checking = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      this.ready = (await new CompanionClient().health()).ok;
    } finally {
      this.checking = false;
    }
  }

  render() {
    const label = this.checking
      ? 'Checking Companion…'
      : this.ready
        ? 'Companion connected — click to check'
        : 'Companion unavailable — click to check';
    const color = this.ready
      ? 'var(--wa-color-success-600, #16a34a)'
      : 'var(--wa-color-danger-600, #dc2626)';
    return html`
      <wa-button
        appearance="plain"
        size="small"
        title=${label}
        aria-label=${label}
        ?disabled=${this.checking}
        @click=${() => void this.refresh()}
      >
        <wa-icon
          name=${this.checking ? 'circle-notch' : 'circle'}
          class=${this.checking ? 'spinning' : ''}
          style="color: ${color}; font-size: 0.625rem;"
        ></wa-icon>
      </wa-button>
    `;
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      height: 100%;
      padding-left: 0.5rem;
    }

    .spinning {
      animation: cloudadmin-companion-spin 1s linear infinite;
    }

    @keyframes cloudadmin-companion-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
}
