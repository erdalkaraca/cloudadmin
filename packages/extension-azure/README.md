# extension-azure

**Status:** Stub — **deferred** (post-MVP)

| Constant | Value |
|----------|--------|
| `providerId` | `azure` |
| Command namespace | `azure.*` |

## Purpose

Azure tenant/subscription connections; inventory via **Azure Resource Graph** and ARM clients in the browser (§14.2).

## When to implement

After MVP providers (K8s + Portainer) and shared `extension-cloud` contracts.

## Implementation checklist

### 1. Contributors

`CloudConnectionContributor` + `CloudTreeContributor` for `providerId: 'azure'`.

### 2. Connection flow

- Microsoft Entra / device code / existing token in secure session storage
- Persist: `tenantId`, `subscriptionId`, display name — no client secrets in `connections.json`

### 3. Tree hierarchy

```
connection (subscription)
  └── resource group
        └── resource (typed by RP)
```

### 4. Browser API

- `@azure/arm-resources`, `@azure/arm-resourcegraph`, or `@azure/identity` + fetch
- Read-heavy MVP: VMs, AKS, storage, networking (§14.2)

### 5. Commands

Register only `azure.*`; `requiresCompanion` only for operations without ARM API coverage.

### 6. Dependencies

```bash
npm install @azure/identity @azure/arm-resources -w extension-azure
```

## Requirements references

- §14.2 Azure requirements
- PROV13.10 Azure hierarchy

## Enable in app

Keep stub loaded for extension discovery; hide from “Add cloud account” until connection UI ships (coordinate with `extension-cloud` feature flags).
