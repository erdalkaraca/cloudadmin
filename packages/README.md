# CloudAdmin packages

## Platform

| Package | Role |
|---------|------|
| `extension-cloud` | Models, tree, connections, scope, policy (`docs/internal/phase2-policy-hooks.md`) |
| `extension-companion` | Companion HTTP client (`extension-companion/api`) |

Import the public API from `extension-cloud/api`; use `extension-cloud/models` for type-only imports. `extension-companion` depends on cloud models only (no cycle).

## Cloud provider extensions

| Package | MVP | README |
|---------|-----|--------|
| `extension-k8s` | Yes | [README](./extension-k8s/README.md) |
| `extension-portainer` | Yes | [README](./extension-portainer/README.md) |
| `extension-aws` | Deferred | [README](./extension-aws/README.md) |
| `extension-azure` | Deferred | [README](./extension-azure/README.md) |
| `extension-gcp` | Deferred | [README](./extension-gcp/README.md) |

MVP scope: [docs/internal/mvp-scope.md](../docs/internal/mvp-scope.md).

## Planned (add later if needed)

- `extension-actions` — advanced command UI

## App shell

- `app` — Eclipse Docks host
- `extension-example` — Docks extension sample (remove when no longer needed)
