# extension-companion

Optional local **Companion** integration: HTTP health check, K8s API proxying, and run API stubs for advanced operations.

## Docks extension

Registers a status dot on the **footer toolbar** (`TOOLBAR_BOTTOM`, same slot as memory usage): green when connected, red when unavailable.

## API

```typescript
import { CompanionClient, DEFAULT_COMPANION_BASE } from 'extension-companion/api';

const client = new CompanionClient(DEFAULT_COMPANION_BASE);
await client.health();

// Proxy a Kubernetes API request through the local Companion.
await client.proxyKubernetes({
	context: 'my-context',
	method: 'GET',
	path: '/api/v1/namespaces',
});
```

## Local binary (self-contained)

From this package directory, build and run without referencing paths outside `extension-companion`:

```bash
npm run companion:build
npm run companion:run
```

For debug development with hot reload on Rust source changes:

```bash
npm run companion:dev
```

This watches `companion/src` and `companion/Cargo.toml`, then rebuilds/restarts the companion process automatically.

`npm run companion:build` now builds both Linux and Windows x64 artifacts.

- Linux: `companion/vendor/bin/cloudadmin-companion`
- Windows: `companion/vendor/bin/cloudadmin-companion.exe`

## Files

- **src/api.ts** — `CompanionClient`, health/run/proxy types (import via `extension-companion/api`)
- **src/companion-status.ts** — toolbar status badge
- **src/companion-extension-loader.ts** — toolbar contribution + startup health log
- **src/index.ts** — extension registration only
- **companion/** — Rust loopback proxy binary (`/health`, `/k8s/proxy`)
