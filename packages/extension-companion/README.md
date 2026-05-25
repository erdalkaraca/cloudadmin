# extension-companion

Optional local **Companion** integration: HTTP health check and run API stub for future container/compute actions.

## Docks extension

Registers a status dot on the **footer toolbar** (`TOOLBAR_BOTTOM`, same slot as memory usage): green when connected, red when unavailable.

## API

```typescript
import { CompanionClient, DEFAULT_COMPANION_BASE } from 'extension-companion/api';

const client = new CompanionClient(DEFAULT_COMPANION_BASE);
await client.health();
```

## Files

- **src/api.ts** — `CompanionClient`, health/run types (import via `extension-companion/api`)
- **src/companion-status.ts** — toolbar status badge
- **src/companion-extension-loader.ts** — toolbar contribution + startup health log
- **src/index.ts** — extension registration only
