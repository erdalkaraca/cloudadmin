# Contributing to CloudAdmin

This guide is for developers building, extending, or contributing to CloudAdmin.

## Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc` or `package.json` `engines` for version)
- [Rust](https://rustup.rs/) — for building the companion service
- [npm](https://npmjs.com/) workspaces support

## Development Setup

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (e.g. `http://localhost:5173/`).

## Project Structure

- **`packages/app`** — The Docks app shell (entry point, layout, extension registration)
- **`packages/extension-cloud`** — Core cloud connection model, tree views, workload editor
- **`packages/extension-companion`** — Companion service client, status indicator, catalog integration
- **`packages/extension-k8s`** — Kubernetes provider (companion proxy + bearer token modes)
- **`packages/extension-aws`** — AWS provider
- **`packages/extension-azure`** — Azure provider
- **`packages/extension-gcp`** — GCP provider
- **`packages/extension-portainer`** — Portainer provider
- **`packages/extension-example`** — Minimal extension template; use as a starting point

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (all packages) |
| `npm run preview` | Preview production build locally |

## Adding a New Cloud Provider Extension

1. Copy `packages/extension-example` to `packages/extension-<name>`
2. Add it to `packages/app/package.json` dependencies
3. Register it in `packages/app/src/main.ts` (`registerApp({ extensions: [...] })`)
4. Implement `CloudConnectionContributor` and `CloudTreeContributor` from `extension-cloud/api`

Vite loads extension side-effect entry points automatically via `resolveDepVersionsPlugin()` in `vite.config.ts`.

## Extension Architecture

Extensions contribute capabilities through the `@eclipse-docks/core` contribution registry:

- **`CLOUD_CONNECTIONS`** — Connection form + connect/restore/disconnect lifecycle
- **`CLOUD_TREE`** — Tree nodes shown in the sidebar for a provider
- **`CLOUD_WORKLOAD_HANDLERS`** — Workload operations (logs, config, lifecycle)
- **`COMPANION_TOOL_POLICIES`** — Declare which local tools an extension may execute via the companion
- **`SYSTEM_LAYOUTS`** — Custom layout registrations

## Companion Service (Rust)

The companion bridges browser limitations — it handles cloud API proxying, local credential storage, kubectl sessions, and tool management.

### Building from Source

```bash
cd packages/extension-companion/companion
cargo build --release
./target/release/companion
```

Companion listens on `http://127.0.0.1:9477` by default.

### Dev Mode

```bash
cd packages/extension-companion
npm run companion:dev
```

This builds and runs the companion in watch mode alongside the Vite dev server.

## PWA

The app uses **vite-plugin-pwa** (injectManifest strategy) with a service worker at `packages/app/src/sw.ts`. The `@eclipse-docks/extension-pwa` extension provides install/update UI in the toolbar.

Production `npm run build` emits the web app manifest and precached assets.

To remove PWA support: remove the PWA extension from `packages/app/package.json` and `packages/app/src/main.ts`, delete `src/sw.ts`, and remove the `VitePWA(...)` block from `packages/app/vite.config.ts`.

## Framework

CloudAdmin is built on [Eclipse Docks](https://github.com/eclipse-docks/core). Refer to its documentation for layout system, contribution registries, toolbar contributions, and dialog APIs.

## CI/CD and GitHub Pages

### Local validation

```bash
npm run validate-ci
```

Runs the same build check as GitHub Actions before you push.

### Workflows

| Workflow | Trigger |
|----------|---------|
| `ci.yml` | Push/PR to `main` or `develop` |
| `pr-validation.yml` | PR opened/updated |
| `auto-tag.yml` | Push to `main` with `vX.Y.Z` in commit subject |
| `build-and-deploy.yml` | Semver tag push (`X.Y.Z`) → deploy to `gh-pages` |

Hosted demo: **https://erdalkaraca.github.io/cloudadmin/**

CI builds with `VITE_BASE_PATH=/<repo-name>/` so the subpath matches GitHub Pages project sites.

### Releasing

1. Run VS Code task **trigger-release (dry-run)** to preview the next version
2. Run **trigger-release** (or `./scripts/trigger-release.sh patch`) on `main`
3. The script pushes an empty `Release: vX.Y.Z` commit → `auto-tag.yml` creates tag + GitHub Release → `build-and-deploy.yml` publishes to `gh-pages`

Optional: set `OPENAI_API_KEY` in root `.env` for AI-generated release notes.

### One-time GitHub repo setup

1. **Settings → Pages → Build and deployment** — source: branch **`gh-pages`**, folder **`/ (root)`**
2. **Settings → Actions → General → Workflow permissions** — enable **Read and write permissions**
3. **Settings → Secrets → Actions** — **`PAT_TOKEN`** is optional; auto-tag deploys to Pages in the same workflow run after tagging.
