# extension-portainer

**Status:** Stub — **MVP** (implement with `extension-cloud`)

| Constant | Value |
|----------|--------|
| `providerId` | `portainer` |
| Command namespace | `portainer.*` |

## Purpose

Connect to one or more **Portainer** instances and browse environments, stacks, and containers from the unified Cloud tree. All MVP operations use the **Portainer HTTP API** in the browser (PWA-first, R-P3.7).

## Prerequisites

1. `extension-cloud` — models, unified explorer, persistence, scope

## Implementation checklist

### 1. Register contributors

- `CloudConnectionContributor` (`providerId: 'portainer'`)
- `CloudTreeContributor` (`providerId: 'portainer'`)

### 2. Connection flow

- **Connect UI:** Portainer base URL (HTTPS), API key or JWT (prompt once; store reference only).
- **Persist:** `serverUrl`, `endpointId` (optional default), display name — in `connections.json` via `extension-cloud`.
- **Auth:** `X-API-Key: <key>` header on API calls; token only in memory/session (not in JSON file).
- **Validate:** `GET /api/status` or `GET /api/system/status` on connect.

### 3. Tree hierarchy (PROV13.10)

```
connection (Portainer instance)
  └── scope (Portainer environment / endpoint)
        └── workload (container; stack level TBD)
```

Tree `kind` values use `CloudTreeNodeKind` from `extension-cloud` (`connection`, `scope`, `group`, `workload`, `service`).

Lazy-load with `getChildren`. Use Portainer IDs in node metadata for subsequent API calls.

### 4. Browser API layer (`src/api/`)

Suggested modules:

| Module | Portainer API (examples) |
|--------|---------------------------|
| `client.ts` | Base URL, headers, error mapping |
| `endpoints.ts` | `GET /api/endpoints` |
| `environments.ts` | Environment status, details |
| `stacks.ts` | `GET /api/stacks` (filter by endpoint) |
| `containers.ts` | `GET /api/endpoints/{id}/docker/containers/json` |

Official docs: https://docs.portainer.io/api/api-reference

Map containers/stacks to normalized `Resource` (`type`, `id`, `name`, `status`, tags).

### 5. MVP operations (browser, no Companion)

- List environments, stacks, containers
- Container inspect (read-only JSON view)
- Start/stop/restart container **only if** policy allows and API supports it (gate with `extension-cloud` policy helpers)
- Stack list + inspect; avoid destructive stack delete in MVP

### 6. Commands (later)

Namespace `portainer.*` only. Example advanced (Companion) if ever needed:

- `portainer.exec.attach` — only if not achievable via Portainer websocket API in browser

Default: **no** `requiresCompanion` commands in MVP.

### 7. Dependencies (add when implementing)

```bash
# Optional thin client; fetch is enough for MVP
npm install -w extension-portainer
```

Use `fetch` + typed responses; add OpenAPI-generated types if you import Portainer’s spec.

## Security notes

- Enforce HTTPS; warn on self-signed (mkcert in dev only).
- Origin + CORS: Portainer must allow the PWA origin or run behind same-site proxy.
- Redact API keys in logs (AUD19.x).

## Requirements references

- PROV13.10 Portainer hierarchy, PROV13.14 (MVP provider)
- `docs/cloudadmin-requirements.md` §23.4 (Portainer MVP)
- `docs/internal/mvp-scope.md`

## Testing

- Connect to local Portainer CE
- Add two connections (two URLs) — two roots in Cloud tree
- Expand environment → stack → container
