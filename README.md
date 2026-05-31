# cloudadmin

A **local-first, credentials-respecting** unified interface to manage cloud accounts and Kubernetes clusters across hyperscalers.

Built with [Eclipse Docks](https://github.com/eclipse-docks/core).

## Why CloudAdmin?

### Architecture
CloudAdmin is a **zero-install Progressive Web App (PWA)**. Open it in your browser, optionally install it like a native app, and start managing cloud accounts immediately — no setup required.

- **No installation needed**: Runs directly in the browser; install as a native-like app on desktop/mobile if preferred
- **Credentials never leave your machine**: All cloud credentials are stored locally in the browser
- **Air-gapped ready**: Works fully offline once installed; no cloud backend required
- **Privacy-first**: No credential synchronization, no central credential store, no third-party visibility
- **GDPR/compliance friendly**: Zero credential transmission across networks

For advanced operations that browsers cannot perform natively (e.g. proxying Kubernetes API calls, using local kubeconfigs, running CLI tools), an optional **local companion service** can be installed alongside the app.

### Trade-offs vs. Centralized Solutions

#### ✅ Pros of CloudAdmin's Approach
- **Zero install**: Works immediately in any modern browser, no setup
- **Zero trust**: Credentials never transmitted to any external service
- **Self-contained**: No server infrastructure required to get started
- **Air-gapped**: Fully functional in disconnected environments
- **Flexible extensions**: Modular extension architecture supports custom providers
- **Privacy guarantees**: Your credentials stay on your machine

#### ⚠️ Cons of CloudAdmin's Approach
- **Single-user per instance**: Not designed as a shared team dashboard
- **Advanced features need companion**: Some operations (local kubeconfig, CLI tools) require the optional companion service
- **No built-in central sync**: Credential sharing is delegated to a trusted vault (see below), not managed by CloudAdmin itself

### Shared Accounts via Key Vaults

CloudAdmin's local-first model does not prevent team credential sharing—it delegates that responsibility to a **trusted key vault** (e.g. 1Password, HashiCorp Vault, Bitwarden Secrets). Each team member runs their own companion instance; credentials are pulled from the shared vault locally and never pass through CloudAdmin's infrastructure.

This keeps the security boundary intact: the vault is the trust boundary your team already controls, and CloudAdmin never becomes a new attack surface for credentials.

### Best For
- Individual engineers managing personal cloud/cluster access
- Platform teams building internal tools with private credentials
- Air-gapped/offline environments
- Compliance-sensitive organizations that can't centralize credentials
- Teams combining security requirements with local-first architecture

### Not Ideal For
- Centralized team dashboards where a single shared instance serves all users
- Organizations that want cloud credentials managed in a central database rather than a key vault
- Complex cross-team governance scenarios with fine-grained per-user permissions

## Getting Started

1. Open CloudAdmin in your browser — it works immediately, no installation required
2. Optionally, install it as a native-like app using your browser's install option
3. Connect your first cloud account or Kubernetes cluster from the connection panel

Some providers and features require the companion service for operations that browsers cannot perform natively. If prompted, follow the [companion setup instructions](#local-companion-service) to enable them.

> **Contributing or building from source?** See [CONTRIBUTING.md](CONTRIBUTING.md).

## Local Companion Service (Optional)

CloudAdmin works without the companion for most cloud provider connections. The companion is only needed for advanced operations that browsers cannot perform natively — CloudAdmin will tell you when it's required.

When installed, the companion unlocks:

- **Local kubeconfig support**: Connect to Kubernetes clusters using your existing local kubeconfig contexts
- **kubectl proxy sessions**: Manage clusters that require a local proxy rather than direct API access
- **CLI tool management**: Install and run local tools needed by specific providers or workflows
- **Unrestricted cloud API access**: Bypass browser CORS restrictions for APIs that don't support direct browser calls

### Running Companion Locally

1. Open the **Catalog** view in CloudAdmin
2. Find the companion binary for your platform
3. Download and save it to a folder of your choice
4. Run the binary — no installation or configuration required

Companion runs on `http://127.0.0.1:9477` by default. The PWA connects to this address only — no external communication.
