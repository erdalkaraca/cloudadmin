# CloudAdmin MVP scope

## In scope (Phase 0–1)

| Package | Role |
|---------|------|
| `extension-k8s` | Kubernetes cluster connections; browser K8s API inventory |
| `extension-portainer` | Portainer endpoint connections; browser Portainer REST API inventory |
| `extension-cloud` | Models, unified tree, connections, scope banner, policy |
| `extension-companion` | Companion HTTP client (`CompanionClient`) |

## Deferred (stubs only)

| Package | Notes |
|---------|--------|
| `extension-aws` | After MVP; AWS SDK v3 in browser |
| `extension-azure` | After MVP; Azure Resource Graph / ARM clients |
| `extension-gcp` | After MVP; GCP client libraries |

AWS, Azure, and GCP are **not** required for the first vertical slice. Portainer replaces them as the second PWA-first connector alongside K8s.

## Companion / IaC

- `extension-companion`, `extension-iac`, advanced `k8s.*` commands: Phase 1+

See each `packages/extension-*/README.md` for provider-specific implementation steps.
