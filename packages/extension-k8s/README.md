# extension-k8s

**Status:** Stub — **MVP** (implement with `extension-cloud`)

| Constant | Value |
|----------|--------|
| `providerId` | `k8s` |
| Command namespace | `k8s.*` |

## Purpose

Kubernetes cluster connections in the unified Cloud tree. The extension now contributes two separate connection types:

1. `Kubernetes (Companion + kubectl)` (`providerId: k8s`)
2. `Kubernetes (JS API + Bearer Token)` (`providerId: k8s-bearer`)

Both types share the same tree hierarchy and workload viewer. The companion type uses `kubectl proxy`, while the bearer type uses direct browser `fetch` calls with an Authorization header.

## Prerequisites

1. `extension-cloud` — models, `cloudConnectionService`, connection + tree contributor registry, scope

## Implementation checklist

### 1. Register contributors (in `k8s-extension-loader.ts`)

When `extension-cloud` exists:

- `CloudConnectionContributor` for `providerId: 'k8s'`
- `CloudTreeContributor` for the same `providerId`

### 2. Connection flow (`connect` / `restore`)

- **Connect UI:** URL first, with optional context list and discovered server dropdown. Companion-backed kubectl uses default kubeconfig resolution.
- **Persist** in `.cloudadmin/connections.json` only: `connectionId`, `name`, `providerId`, `persistData` (e.g. `context`, `contexts`, `serverUrl` — **no** tokens or certs).
- **Secrets:** keep credentials in session memory or OS/browser storage per R-SEC7.1; never write to `connections.json`.
- **Restore:** validate current context/cluster reachability; mark root node error state if unreachable (PROV13.13).

### 3. Tree hierarchy (PROV13.10)

```
connection (cluster)
  └── scope (kube context)
        └── group (namespace)
              └── workload (pod; service/ingress TBD)
```

Tree `kind` values use `CloudTreeNodeKind` from `extension-cloud` (`connection`, `scope`, `group`, `workload`, `service`).

Implement `getChildren(parentId)` with stable node ids: `{connectionId}/{kind}/{...}`.

### 4. Browser API layer (`src/api/`)

- Use `@kubernetes/client-node` or typed `fetch` to API server with credentials from connect flow.
- **MVP inventory:** list contexts, namespaces, pods, deployments, services, events, get manifest (read-only).
- Map results to `Resource` (PROV13.2).

### 5. Commands (Phase 1+)

Register only `k8s.*` in this extension. MVP browser-only; defer to Companion:

| Command | `requiresCompanion` |
|---------|---------------------|
| `k8s.logs.follow` | yes (if not browser-streamed) |
| `k8s.portForward.start\|stop\|status` | yes |
| `k8s.exec.start\|stop` | yes |

### 6. Dependencies (add when implementing)

```bash
npm install @kubernetes/client-node -w extension-k8s
```

Prefer fetch + minimal types if bundle size is a concern.

## Requirements references

- PROV13.1–13.13, §15 Kubernetes, §23.1 MVP catalog
- `docs/internal/mvp-scope.md`

## Testing

- Connect to a kind/minikube cluster via kubeconfig in workspace
- Expand tree through namespace → pod
- Disconnect removes root; `connections.json` updated
