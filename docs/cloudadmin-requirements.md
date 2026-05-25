# CloudAdmin — Complete Requirements Catalog (Hybrid PWA + Local Companion)

**Version:** 1.0  
**Purpose:** Architecture requirements baseline for a modular hybrid system (PWA-first + local Companion).  
**Core constraint:** The Companion executes **predefined + user/admin-defined Actions only** (no arbitrary shell).  
**Core advanced capability:** Interactive `kubectl exec` allowed but gated behind an **Advanced** UI section and policy.  
**Scope:** Manage **existing** AWS accounts, Azure subscriptions/tenants, and Kubernetes clusters (any conformant cluster).  
**Extensibility:** Modular to add providers later (GCP, Portainer, Docker-only hosts).

---

## Table of Contents
1. [Definitions](#1-definitions)  
2. [Scope, Goals, Non-Goals](#2-scope-goals-non-goals)  
3. [Architecture Principles](#3-architecture-principles)  
4. [System Components & Responsibilities](#4-system-components--responsibilities)  
5. [Deployment Modes](#5-deployment-modes)  
6. [Identity, Authentication, Authorization](#6-identity-authentication-authorization)  
7. [Credential, Token, Secret Handling](#7-credential-token-secret-handling)  
8. [PWA Requirements (Offline, UX, Security)](#8-pwa-requirements-offline-ux-security)  
9. [Local Companion Requirements (Local-only, Pairing, Storage)](#9-local-companion-requirements-local-only-pairing-storage)  
10. [Action System Requirements (Built-in + Custom)](#10-action-system-requirements-built-in--custom)  
11. [Interactive Sessions (Advanced)](#11-interactive-sessions-advanced)  
12. [Toolchain Management (Companion)](#12-toolchain-management-companion)  
13. [Provider/Plugin Architecture (Extensible)](#13-providerplugin-architecture-extensible)  
14. [Cloud Provider Functional Requirements (AWS/Azure)](#14-cloud-provider-functional-requirements-awsazure)  
15. [Kubernetes Functional Requirements (Any Cluster)](#15-kubernetes-functional-requirements-any-cluster)  
16. [Terraform/OpenTofu Functional Requirements](#16-terraformopentofu-functional-requirements)  
17. [1Password & Secret Manager Integrations](#17-1password--secret-manager-integrations)  
18. [Policy, Guardrails, Approvals](#18-policy-guardrails-approvals)  
19. [Audit, Logging, Observability](#19-audit-logging-observability)  
20. [Data Model & Storage](#20-data-model--storage)  
21. [APIs & Protocols (PWA ↔ Companion)](#21-apis--protocols-pwa--companion)  
22. [Non-Functional Requirements](#22-non-functional-requirements)  
23. [Initial Built-in Action Catalog (MVP)](#23-initial-built-in-action-catalog-mvp)  
24. [Out-of-Scope](#24-out-of-scope)  
25. [Open Decisions](#25-open-decisions)

---

## 1. Definitions

- **PWA:** Progressive Web App UI that runs in the browser with offline app-shell caching via Service Worker.
- **Companion:** An **optional** local Rust binary (`companion`, shipped by `extension-companion`) bound to loopback. Required **only** for **advanced** commands (`requiresCompanion: true`)—e.g. exec into pods/compute, port-forward, Terraform CLI—not for inventory or routine operations done via vendor JS SDKs/APIs in provider extensions. When used, it merges command catalogs and runs allowlisted workspace CLI tools (see **Workspace tool**). UI and docs use **Companion**, not “agent”, to avoid confusion with **AI agents** in Eclipse Docks.
- **Workspace tool:** A CLI binary (e.g. `kubectl`, `terraform`) installed under the workspace (e.g. `.cloudadmin/tools/<toolId>/<version>/`) by the user via app extension install/checkout flows; the Companion resolves paths from a workspace tool manifest before each run.
- **Command:** A versioned operation identified by `commandId` (e.g. `k8s.pods.list`) with JSON Schema **input** and **output** types exposed to the UI via `extension-api`. The Companion maps commands to workspace CLI tools internally; the UI MUST NOT use argv, shell, or raw CLI streams except through typed interactive channel contracts.
- **Command catalog (extension-provided):** Commands registered by a **single provider extension** in its namespace when enabled (e.g. only `k8s.*` from `extension-k8s`). Registration MAY include a Companion-private **implementation** block (`toolId`, argv template, parsers) that is not returned to the PWA catalog API.
- **Cloud connection:** A user-added link to a provider environment (cluster, account, subscription, project, Portainer endpoint, etc.)—like a **workspace folder root**. Stored as metadata (persisted); shown as a **root** in the unified Cloud tree; may have siblings (multiple connections per provider).
- **Unified cloud tree:** One Cloud explorer (R-PROV13.5) with **Add cloud account** (workspace-style); merges **connection roots** and lazy subtrees from enabled provider extensions.
- First-party packages use the `extension-*` naming pattern **without** a `cloudadmin` prefix. Docks-style entry points: `index` registers the extension; public API via `extension-cloud/api`, `extension-companion/api`; type-only imports via `extension-cloud/models`.
- **Scope:** Boundary for operations (AWS account/region, Azure tenant/subscription, K8s cluster/namespace, Portainer endpoint); updated when the user selects a node in the unified tree.
- **Team mode:** Multi-user usage with shared policy and audit (typically via a control service).
- **Personal mode:** Single-user usage without central collaboration requirements.

---

## 2. Scope, Goals, Non-Goals

### 2.1 Scope
- **R2.1 (SHALL)** Support management of **existing** environments:
  - AWS accounts (and roles/profiles)
  - Azure tenants/subscriptions
  - Kubernetes clusters (any conformant cluster)
- **R2.2 (SHALL)** Support two operational planes:
  - **PWA-first (default):** inventory and safe operations via **vendor JS SDKs / HTTP APIs** in provider extensions—**no Companion required**
  - **Advanced (optional):** operations impractical or unsafe in the browser (e.g. exec into pods/compute, port-forward, Terraform CLI, 1Password CLI)—**Companion required** only for those commands

### 2.2 Goals
- **R2.3 (SHALL)** Maximize browser-only capabilities using web-safe SDKs/APIs.
- **R2.4 (SHALL)** Provide “full admin panel” experience by adding a local Companion for tasks impossible/impractical in browser.
- **R2.5 (SHALL)** Secure handling of tokens/credentials:
  - PWA: WebAuthn for CloudAdmin user auth; no long-lived secrets stored
  - Companion: OS credential manager for persisted secrets/tokens
- **R2.6 (SHALL)** Modular architecture enabling future providers (GCP, Portainer, Docker-only).

### 2.3 Non-goals
- **R2.7 (SHALL)** Creating new AWS accounts / Azure subscriptions (“account vending”) is out of scope.
- **R2.8 (SHALL)** Remote-hosted Companion operation is out of scope for v1 (local-only security baseline).

---

## 3. Architecture Principles

- **P3.1 (SHALL)** Prefer PWA-only implementations where secure and feasible.
- **P3.2 (SHALL)** Minimize secret exposure and persistence; avoid long-lived secrets in browser.
- **P3.3 (SHALL)** The Companion is privileged; secure pairing and strict local-only binding is mandatory.
- **P3.4 (SHALL)** The Companion runs **Actions only**; no arbitrary shell execution endpoint exists.
- **P3.5 (SHALL)** Provider extensibility is via Docks app extensions: **browser APIs/SDKs for default UX**; the Companion is an **optional** generic CLI host for **advanced** commands only.
- **P3.6 (SHALL)** All risky operations are gated by policy + explicit UI/step-up auth/approval.
- **P3.7 (SHALL)** The Companion MUST NOT be required for inventory, read-heavy views, or operations that provider extensions can implement with web-safe JS APIs (AWS/Azure/K8s/Portainer SDKs or conformant HTTP APIs).

---

## 4. System Components & Responsibilities

### 4.1 PWA (CloudAdmin UI)
- **C4.1 (SHALL)** Provide UI for:
  - resource inventory, search, and dashboards (**via provider extension JS SDKs/APIs where possible**)
  - workflow wizards and safe operations (**browser-first**)
  - advanced operations and interactive exec (**Companion-backed commands only**)
- **C4.1a (SHALL)** Provider extensions SHALL implement routine operations without the Companion; only commands marked `requiresCompanion` (or `uiGating: advanced`) may invoke `extension-api` runs.
- **C4.1b (SHALL)** Provide a **unified cloud explorer** (`extension-cloud`) showing one tree of connected/known clouds; provider extensions contribute subtrees only through the unified tree API (R-PROV13.5).
- **C4.2 (SHALL)** Implement offline-capable app shell using Service Worker.
- **C4.3 (SHALL)** Render streamed output safely (sanitize terminal output and escape sequences).
- **C4.4 (SHALL)** Provide context safety banners (account/subscription/cluster/namespace).

### 4.2 Local Companion
- **C4.5 (SHALL)** Bind to loopback only; provide authenticated API + streaming for PWA.
- **C4.6 (SHALL)** Execute registered Actions only by spawning workspace-local CLI tools with allowlisted argv templates (no generic shell).
- **C4.7 (SHALL)** Resolve and invoke CLI tools from the workspace tool manifest; **SHALL NOT** be the primary UX for downloading tools (app extensions provide install/checkout flows).
- **C4.8 (SHALL)** Resolve secret references at runtime (1Password REST if available else CLI).
- **C4.9 (SHALL)** Store credentials/tokens in OS credential manager.
- **C4.10 (SHALL)** Provide diagnostics bundle export with redaction.

### 4.3 Optional Control Service (recommended for team mode)
- **C4.11 (SHOULD)** Provide central storage for:
  - org/users/RBAC
  - policies and action-catalog allowlists
  - audit logs
  - companion device registry/revocation
- **C4.12 (SHALL)** Avoid storing customer cloud credentials in the control service.

---

## 5. Deployment Modes

### 5.1 PWA-first (default; no Companion)
- **D5.1 (SHALL)** The full admin experience for inventory and safe control-plane work SHALL work **without** the Companion, using vendor-specific JS APIs in extensions (e.g. AWS SDK v3, Azure ARM/Resource Graph clients, Kubernetes API fetch/client, Portainer API).
- **D5.1a (SHALL)** `extension-companion` is **optional**; the app MUST remain usable when it is not installed, not running, or not paired.

### 5.2 Advanced (Companion only when needed)
- **D5.2 (SHALL)** Require the Companion **only** for advanced commands (e.g. `k8s.exec`, port-forward, in-pod/compute execution, Terraform apply, secret resolution via CLI)—not for listing resources or routine CRUD where browser APIs suffice.
- **D5.3 (SHALL)** Provide clear UI when a specific operation requires the Companion (install/run/discover); unrelated screens MUST NOT block on Companion status.
- **D5.4 (SHALL)** When the Companion is required but missing/offline, degrade gracefully for **those operations only** (R-D5.2).

---

## 6. Identity, Authentication, Authorization

### 6.1 CloudAdmin user authentication
- **IA6.1 (SHALL)** Use WebAuthn (passkeys/security keys) for user authentication to CloudAdmin.
- **IA6.2 (SHALL)** Support step-up auth for high-risk actions (terraform apply, delete, exec).
- **IA6.3 (SHOULD)** Support enterprise IdP SSO (OIDC/SAML) via optional control service.

### 6.2 Authorization and RBAC
- **IA6.4 (SHALL)** Provide RBAC:
  - roles (viewer/operator/admin/custom)
  - scope bindings (account/subscription/cluster/namespace/project)
  - action permissions (invoke/approve/define custom action)
- **IA6.5 (SHALL)** Enforce RBAC in UI and at execution boundaries (Companion and control service if present).
- **IA6.6 (SHALL)** Support environment separation (dev/stage/prod) with stricter defaults in prod.

---

## 7. Credential, Token, Secret Handling

### 7.1 PWA constraints
- **SEC7.1 (SHALL)** PWA SHALL NOT persist long-lived cloud credentials (access keys, client secrets, kube client key material).
- **SEC7.2 (SHALL)** PWA MAY store non-sensitive preferences and cached UI state.

### 7.2 Companion credential storage
- **SEC7.3 (SHALL)** The Companion SHALL store persisted tokens/credentials only in OS credential manager:
  - Windows Credential Manager/DPAPI
  - macOS Keychain
  - Linux Secret Service (GNOME Keyring/KWallet; fallback defined)
- **SEC7.4 (SHALL)** Companion config and caches SHALL be encrypted at rest with OS-keystore-backed keys.
- **SEC7.5 (SHALL)** Secret values are injected at runtime and not written to disk by default.

### 7.3 Cloud authentication support
- **SEC7.6 (SHALL)** AWS: support IAM Identity Center (SSO) via Companion and STS role assumption patterns.
- **SEC7.7 (SHALL)** Azure: support Entra ID tokens in PWA for ARM and Azure CLI auth via Companion when needed.
- **SEC7.8 (SHALL)** Kubernetes: support kubeconfig contexts and exec-based auth via Companion.

---

## 8. PWA Requirements (Offline, UX, Security)

### 8.1 Offline app-shell
- **PWA8.1 (SHALL)** Cache app shell assets via Service Worker for offline launch.
- **PWA8.2 (SHALL)** Display clear offline/degraded indicators and prevent initiating actions that require connectivity.

### 8.2 UX safety
- **PWA8.3 (SHALL)** Always show current scope context (account/subscription/cluster/namespace).
- **PWA8.4 (SHALL)** High-risk operations require explicit confirmation, and may require step-up auth.
- **PWA8.5 (SHOULD)** Provide “safe mode” policy defaults: e.g., disable deletes in prod unless approved.

### 8.3 Browser security
- **PWA8.6 (SHALL)** Implement strong CSP, XSS protections, and strict sanitization of all streamed output.
- **PWA8.7 (SHALL)** Prevent terminal escape/clipboard attacks (sanitize control sequences where needed).

---

## 9. Local Companion Requirements (Local-only, Pairing, Storage)

### 9.1 Local-only networking
- **CMP9.1 (SHALL)** The Companion binds only to loopback (`127.0.0.1`/`::1`).
- **CMP9.2 (SHALL)** The Companion rejects requests without valid Origin allowlist match.
- **CMP9.3 (SHALL)** The Companion uses authenticated requests with anti-replay (nonce/timestamp).

### 9.2 Pairing & device trust
- **CMP9.4 (SHALL)** Pairing requires user presence via code/QR shown by the Companion.
- **CMP9.5 (SHALL)** Pairing yields a revocable device token stored in OS credential manager.
- **CMP9.6 (SHALL)** PWA provides device list and revocation UI.

### 9.3 Execution sandboxing and resource limits
- **CMP9.7 (SHALL)** Each action run occurs in an isolated workspace directory with bounded permissions.
- **CMP9.8 (SHALL)** The Companion enforces timeouts, concurrency limits, and cancellation where feasible.
- **CMP9.9 (SHALL)** The Companion prevents arbitrary filesystem reads/writes unless explicitly required by an action and policy.

### 9.4 Updates and integrity
- **CMP9.10 (SHALL)** Companion binaries MUST be code-signed.
- **CMP9.11 (SHALL)** Auto-update verifies signature and supports rollback.
- **CMP9.12 (SHOULD)** Enterprise policy can pin versions and allow offline installers.

### 9.5 Distribution, install, and discovery (Docks extension)
- **CMP9.13 (SHALL)** The Companion binary SHALL be built from and distributed with `extension-companion` (`vendor/bin`, Rust sources under `companion/` in that package).
- **CMP9.14 (SHALL)** `extension-companion` SHALL install/sync the bundled binary into the user’s Docks workspace at `.cloudadmin/companion/<version>/`.
- **CMP9.15 (SHALL)** The PWA SHALL NOT launch the native Companion process; the user starts it manually from the workspace install path.
- **CMP9.16 (SHALL)** After install, the UI SHALL instruct the user to run the Companion manually (copy command, open workspace folder).
- **CMP9.17 (SHALL)** The PWA SHALL discover a running Companion via loopback `GET /health` after user acknowledgment (e.g. “I’ve started the Companion”) and on a configurable heartbeat while hybrid mode is expected.
- **CMP9.18 (SHALL)** Commands with `requiresCompanion: true` SHALL remain unavailable until discovery succeeds and pairing completes when required; all other PWA features SHALL work without the Companion.

---

## 10. Action System Requirements (Built-in + Custom)

### 10.1 Core constraints
- **ACT10.1 (SHALL)** The Companion SHALL NOT expose a generic shell or ad hoc CLI endpoint—only registered commands with schema-validated input/output.
- **ACT10.2 (SHALL)** PWA can only invoke commands listed in the Companion catalog via `extension-api` typed requests and responses.

### 10.2 Command definition requirements
- **ACT10.3 (SHALL)** Each command SHALL define for the **public API** (UI-visible):
  - `commandId`, `name`, `description`, `category`, owning extension id
  - `riskLevel` (low/medium/high)
  - `uiGating` (normal/advanced)
  - `interactive` (true/false)
  - **input** JSON Schema and **output** JSON Schema (or reference to stable DTO ids in `extension-api` / provider extension schemas)
  - **`requiresCompanion`** (boolean): if true, execution uses Companion; if false, the provider extension implements the operation in the browser (command descriptor MAY still exist for uniform UX, but MUST NOT call the Companion)
  - secret reference requirements, scope requirements, optional artifact types
- **ACT10.3a (SHALL)** Each command MAY define a Companion-private **implementation** (toolId, argv template, output parser, tool version constraints) used only at execution time; this MUST NOT be required for UI clients.
- **ACT10.4 (SHALL)** The Companion validates command input against the input schema and returns responses conforming to the output schema (structured JSON or typed stream events).

### 10.3 Command catalog
- **ACT10.5 (SHALL)** The Companion exposes `GET /commands` (or equivalent) returning **public** command descriptors only.
- **ACT10.6 (SHALL)** Catalog entries SHALL be sufficient to generate UI forms and risk warnings from schemas alone.

### 10.4 Custom actions
- **ACT10.7 (SHALL)** Users/admins can create custom actions.
- **ACT10.8 (SHALL)** Custom actions are expressed in a constrained format (template/DSL/action spec), not arbitrary shell scripts by default.
- **ACT10.9 (SHALL)** Custom actions undergo the same validation, policy enforcement, and auditing as built-in actions.
- **ACT10.10 (SHALL)** Enterprise policy can:
  - disable custom actions
  - restrict to admin-only
  - require approval/signature before enablement
  - restrict tools and target scopes
- **ACT10.11 (SHOULD)** Custom actions support versioning, rollback, and change history.

### 10.5 Command catalogs (provider extensions)
- **ACT10.12 (SHALL)** Commands SHALL be owned by **provider extensions** (e.g. `extension-k8s` registers only `k8s.*`; `extension-aws` only `aws.*`); extensions MUST NOT register commands outside their namespace.
- **ACT10.12a (SHALL)** When a provider extension is enabled and the Companion is **Ready**, it SHALL register its command catalog (e.g. `POST /catalog/register`); disabling SHALL unregister that namespace.
- **ACT10.12b (SHALL)** UI code SHALL call commands only through `extension-api` (`RunRequest` / `RunResponse`); provider UIs SHALL use their own generated/declared input and output types, not CLI text.
- **ACT10.12c (SHALL)** For commands with `requiresCompanion: true`, Companion execution SHALL map to workspace tools (R-TOOL12.1) and normalize CLI results to the output schema; commands with `requiresCompanion: false` SHALL be implemented in the provider extension via JS APIs without calling the Companion.
- **ACT10.13 (SHOULD)** Command catalogs may be signed and verified (enterprise configurable).
- **ACT10.14 (SHALL)** The Companion SHALL deny registering or executing commands from untrusted catalogs when policy requires it.

---

## 11. Interactive Sessions (Advanced)

### 11.1 General interactive session rules
- **INT11.1 (SHALL)** Only actions marked `interactive=true` can start an interactive session.
- **INT11.2 (SHALL)** Interactive sessions are only available in the PWA “Advanced” section and via policy.
- **INT11.3 (SHALL)** Sessions have TTL + idle timeout and explicit end-session control.
- **INT11.4 (SHALL)** Session start/stop is audited.

### 11.2 Kubernetes exec
- **INT11.5 (SHALL)** Provide `k8s.exec` as an advanced interactive action.
- **INT11.6 (SHALL)** Strong context banner must include cluster, namespace, pod, container; highlight prod.
- **INT11.7 (SHOULD)** Policy can restrict exec by environment, namespace allowlists, label selectors, and require step-up auth.

---

## 12. Toolchain Management (workspace + extensions)

### 12.1 Workspace tools
- **TOOL12.1 (SHALL)** CLI tools (`kubectl`, `helm`, `terraform`/`tofu`, optional `aws`, `az`, `op`, etc.) SHALL be installed into the Docks workspace (e.g. `.cloudadmin/tools/<toolId>/<version>/`) by **app extensions** or the user via workspace manager (catalog/`wget`), not bundled inside the Companion binary.
- **TOOL12.2 (SHALL)** The workspace SHALL maintain a tool manifest (paths, versions, integrity hashes) that the Companion reads before each action run.
- **TOOL12.3 (SHALL)** The Companion SHALL fail fast with a clear error if a required `toolId` is missing from the workspace manifest.

### 12.2 Supply chain security
- **TOOL12.4 (SHALL)** All tool downloads must be integrity-verified (checksum/signature) by the extension or checkout flow that placed them in the workspace.
- **TOOL12.5 (SHALL)** Download sources must be allowlisted by policy.
- **TOOL12.6 (SHOULD)** Enterprises can pin tool versions and disable auto-updates.

### 12.3 Execution environment (Companion)
- **TOOL12.7 (SHALL)** The Companion spawns workspace tool binaries with controlled env var allowlist and secret injection at runtime.
- **TOOL12.8 (SHALL)** Support proxy configuration and custom CA bundles for child CLI processes.

---

## 13. Provider/Plugin Architecture (Extensible)

### 13.1 Provider extension interface
- **PROV13.1 (SHALL)** Each provider extension (K8s, AWS, Azure, Portainer, …) SHALL implement **by default** scope discovery, inventory, and safe operations using **vendor JS SDKs or HTTP APIs** in the browser, with typed models—**without** the Companion.
- **PROV13.1a (SHALL)** Each extension SHALL register only **its** `<provider>.*` commands; commands that need the Companion MUST set `requiresCompanion: true` (typically `uiGating: advanced`).
- **PROV13.1b (SHALL)** Tool install UX (workspace CLIs) applies only to extensions/commands that use Companion execution—not to browser-only flows.
- **PROV13.2 (SHALL)** Provider extensions SHALL produce normalized `Resource` models; browser and Companion paths MUST return shapes compatible with those models where they represent the same data.
- **PROV13.3 (SHALL)** Browser code SHALL use provider-published TypeScript types; Companion-backed UI SHALL use `extension-api` run types for `requiresCompanion` commands only.
- **PROV13.4 (SHALL)** Every operation declares `direct` (browser) or `requiresCompanion` (advanced) for UI gating and policy.

### 13.2 Unified cloud tree (multi-account explorer, workspace-style)
- **PROV13.5 (SHALL)** `extension-cloud` SHALL provide a **unified Cloud tree view** and a **cloud connection service** modeled after Eclipse Docks **multi-folder workspace** handling (`workspaceService`: multiple roots, add/remove, persist, per-type connect flows).
- **PROV13.6 (SHALL)** The user SHALL be able to **add a new cloud account/connection** from the Cloud view (toolbar or context menu), choosing a **provider type** (K8s, AWS, Azure, GCP, Portainer, …) from enabled extensions—analogous to “Connect workspace” / add folder in the file browser.
- **PROV13.7 (SHALL)** Each provider extension SHALL register a **connection contributor** (`connect`, `restore`, `disconnect`, optional `rename`) and a **tree contributor** (`getChildren`) for its `providerId`—same extension owns both; no separate ad hoc connection UI outside `extension-cloud`.
- **PROV13.8 (SHALL)** Multiple connections MAY exist per provider (e.g. two clusters, three AWS profiles); each saved connection appears as a **root node** in the unified tree; children are lazy-loaded per R-PROV13.9.
- **PROV13.9 (SHALL)** Tree nodes SHALL use stable ids, `connectionId`, `providerId`, `kind`, display label, optional `Resource` link, and `hasChildren`; expanding calls the owning contributor’s `getChildren(parentId)`.
- **PROV13.10 (SHALL)** Per-provider hierarchy examples:
  - **K8s:** connection (cluster) → context → namespace → workload/pod
  - **AWS:** connection (account/profile) → region → service grouping → resource
  - **Azure:** connection (subscription) → resource group → resource
  - **GCP:** connection (project) → location → resource
  - **Portainer:** connection (endpoint) → environment → stack → container
- **PROV13.11 (SHALL)** Connection metadata SHALL persist in the Docks workspace (e.g. `.cloudadmin/connections.json`); restore on startup like workspace folders; secrets/auth material SHALL NOT be stored in that file (R-SEC7.1).
- **PROV13.12 (SHALL)** Selecting a node SHALL update scope context (R-PWA8.3); the user MAY remove/disconnect a cloud account from the tree (with confirmation).
- **PROV13.13 (SHOULD)** Disconnected or failing connections show status on the root node; per-connection refresh via the owning contributor.

### 13.3 MVP and future providers
- **PROV13.14 (SHALL)** MVP PWA-first connectors: **Kubernetes** (`extension-k8s`) and **Portainer** (`extension-portainer`), integrated via `extension-cloud` (R-PROV13.5–13.13).
- **PROV13.15 (SHOULD)** Post-MVP connectors (stubs in repo; implement per package README):
  - AWS (`extension-aws`)
  - Azure (`extension-azure`)
  - GCP (`extension-gcp`, future)
  - Docker-only hosts (future; Companion-mediated)

---

## 14. Cloud Provider Functional Requirements (AWS/Azure)

### 14.1 AWS (PWA-first)
- **AWS14.1 (SHALL)** Support multi-account access patterns (SSO/AssumeRole).
- **AWS14.2 (SHALL)** Provide inventory and basic ops for core services (EC2/VPC/S3/EKS/CloudWatch; IAM read-heavy).
- **AWS14.3 (SHOULD)** Correlate actions with CloudTrail where possible.

### 14.2 Azure (PWA-first)
- **AZ14.4 (SHALL)** Support multi-tenant and multi-subscription inventory.
- **AZ14.5 (SHALL)** Use ARM + Resource Graph where available for inventory.
- **AZ14.6 (SHOULD)** Correlate actions with Azure Activity Logs where possible.

---

## 15. Kubernetes Functional Requirements (Any Cluster)

### 15.1 Inventory and exploration (PWA / `extension-k8s` JS APIs)
- **K815.1 (SHALL)** Explore (via Kubernetes API in browser—no Companion):
  - namespaces, nodes
  - workloads (deployments/statefulsets/daemonsets)
  - pods, services, ingress
  - events
- **K815.2 (SHALL)** View manifests (YAML/JSON) and resource details via API.

### 15.2 Safe operations (PWA-first where feasible)
- **K815.3 (SHOULD)** Apply/delete manifests via Kubernetes API in browser when auth and policy allow; otherwise via Companion command.
- **K815.4 (SHALL)** Delete operations are guarded by policy and confirmations.
- **K815.5 (SHOULD)** Logs viewing via API/stream in browser when feasible; log follow MAY use Companion when streaming requires it.

### 15.3 Advanced operations (Companion required)
- **K815.6 (SHALL)** Port-forward (`requiresCompanion`) with explicit lifecycle.
- **K815.7 (SHALL)** Interactive exec into pods/compute (`k8s.exec`, `requiresCompanion`, `uiGating: advanced`) with policy gating.

---

## 16. Terraform/OpenTofu Functional Requirements

### 16.1 Configuration sourcing
- **IAC16.1 (SHALL)** Support Terraform/OpenTofu CLI execution via Companion actions.
- **IAC16.2 (SHALL)** Terraform configs are hosted in Git repos; PWA MAY fetch and send a bundle to the Companion.
- **IAC16.3 (SHOULD)** The Companion MAY optionally support fetching from Git directly (more enterprise-friendly).

### 16.2 Bundle validation (PWA-provided)
- **IAC16.4 (SHALL)** Validate bundle size and file allowlist; block path traversal.
- **IAC16.5 (SHOULD)** Enterprise policy can require signed bundles or restrict allowed repo origins.

### 16.3 Plan/apply workflow
- **IAC16.6 (SHALL)** Two-phase plan/apply:
  - `plan` produces plan artifact and hash
  - `apply` requires approval token bound to plan hash, scope, actor, expiry
- **IAC16.7 (SHALL)** PWA displays structured plan diff using `terraform show -json`.
- **IAC16.8 (SHALL)** Support remote state backends with locking (required for team mode).
- **IAC16.9 (SHOULD)** Policy-as-code checks on plan output (OPA/Conftest) before apply.

---

## 17. 1Password & Secret Manager Integrations

### 17.1 General secret model
- **SM17.1 (SHALL)** Use secret references, not secret values, in PWA and action definitions.
- **SM17.2 (SHALL)** Secrets are resolved only in the Companion at execution time.

### 17.2 1Password
- **SM17.3 (SHALL)** Use 1Password REST API if available (e.g., 1Password Connect).
- **SM17.4 (SHALL)** If REST not available, support 1Password CLI (`op`) executed by the Companion.
- **SM17.5 (SHALL)** Provide diagnostics action for 1Password connectivity/permissions.

### 17.3 Redaction
- **SM17.6 (SHALL)** Redact secrets from logs, streamed output, and audit trails by default.

---

## 18. Policy, Guardrails, Approvals

- **POL18.1 (SHALL)** Policy can control:
  - allow/deny actions by scope/environment
  - require step-up auth (WebAuthn) for high-risk actions
  - require approvals (e.g., terraform apply)
  - tool version pinning and download sources
  - custom actions enablement/signing requirements
  - secret sources/vault allowlists
- **POL18.2 (SHALL)** The Companion enforces policy at execution time (not only UI).
- **POL18.3 (SHOULD)** Team mode supports 4-eyes approvals for high-risk actions (if control service present).

---

## 19. Audit, Logging, Observability

### 19.1 Audit events
- **AUD19.1 (SHALL)** Every action run generates an audit record:
  - actor identity, companion device id
  - actionId, scope, timestamps, outcome
  - policy decision metadata
  - correlationId
- **AUD19.2 (SHALL)** Interactive sessions log start/stop events and targets.
- **AUD19.3 (SHALL)** Audit stores redacted inputs; never raw secret values.

### 19.2 Logging and diagnostics
- **AUD19.4 (SHALL)** The Companion provides structured logs and redacted diagnostic bundles.
- **AUD19.5 (SHOULD)** Team mode supports centralized audit storage and SIEM export.

---

## 20. Data Model & Storage

- **DATA20.1 (SHALL)** Normalize resources into a common schema:
  - `provider`, `type`, `id`, `name`, `location`, `tags`, `status`
  - provider-specific extensions preserved
- **DATA20.2 (SHALL)** Store secret references only; secret values remain in Companion memory/OS keystore.
- **DATA20.3 (SHOULD)** Team mode centralizes policies/audits without storing cloud credentials.

---

## 21. APIs & Protocols (PWA ↔ Companion)

### 21.1 Required endpoints
- **API21.1 (SHALL)** Pairing endpoints for establishing trust.
- **API21.2 (SHALL)** Command catalog endpoint (e.g. `GET /commands`) returning **public** descriptors (schemas + metadata; no CLI implementation fields).
- **API21.3 (SHALL)** Command execution endpoints with **JSON Schema-validated** bodies:
  - start run (`commandId` + typed input)
  - get run status (typed progress/result)
  - cancel run
- **API21.4 (SHALL)** Streaming endpoint (WebSocket) for **typed** progress/result events and interactive PTY streams (interactive commands only).
- **API21.4a (SHALL)** `extension-api` SHALL be the single source of truth for these shapes (OpenAPI or equivalent); UI and provider extensions MUST NOT invent parallel ad hoc protocols.

### 21.2 Security requirements
- **API21.5 (SHALL)** All requests are authenticated and replay-protected.
- **API21.6 (SHALL)** Strict Origin validation for all browser-initiated calls.
- **API21.7 (SHALL)** No secrets in URLs; sensitive fields must be redacted in logs.

---

## 22. Non-Functional Requirements

### 22.1 Security
- **NFR22.1 (SHALL)** Protect against localhost CSRF/drive-by:
  - Origin allowlist
  - signed/authenticated requests
  - anti-replay tokens
- **NFR22.2 (SHALL)** Supply chain security for workspace tools and extension-provided action catalogs.
- **NFR22.3 (SHALL)** Output sanitization and secret redaction.

### 22.2 Reliability
- **NFR22.4 (SHALL)** Runs survive PWA reload; PWA can reattach by runId.
- **NFR22.5 (SHALL)** Streaming supports reconnect/resume semantics where feasible.

### 22.3 Performance
- **NFR22.6 (SHALL)** Handle cloud API throttling with backoff/caching.
- **NFR22.7 (SHALL)** The Companion enforces concurrency limits and CPU/memory bounds (policy-configurable).

### 22.4 Portability
- **NFR22.8 (SHALL)** The Companion is cross-platform and code-signed.
- **NFR22.9 (SHOULD)** Enterprise deployment support (MDM/Jamf/SCCM) and version pinning.

---

## 23. Initial Built-in Action Catalog (MVP)

### 23.1 Kubernetes
**Browser (`extension-k8s` JS API, no Companion):** context/namespace/workload/pod/service/ingress list & describe, events, manifest read, safe apply/delete when supported by API auth.

**Companion commands (`requiresCompanion`):**
- `k8s.logs.follow` *(stream, if not browser-only)*
- `k8s.portForward.start|stop|status`
- `k8s.exec.start|stop` *(interactive, advanced — exec / in-pod code)*

### 23.2 Terraform/OpenTofu (Companion — `requiresCompanion`)
- `iac.bundle.validate`
- `iac.init`
- `iac.plan`
- `iac.plan.showJson`
- `iac.apply` *(requires approval token bound to plan hash)*
- `iac.output.get` *(redacted)*

### 23.3 Portainer (MVP — `extension-portainer` browser API)
**Browser (no Companion):** connect to Portainer instance (URL + API key in session); list endpoints/environments, stacks, containers; container/stack inspect; safe start/stop/restart when policy allows.

**Commands (`portainer.*`):** defer Companion-backed exec until browser API is insufficient.

### 23.4 Deferred cloud connectors (stubs)
- **AWS / Azure / GCP:** packages exist as stubs; not in MVP “Add cloud account” until connection + tree contributors ship (see each `packages/extension-*/README.md`).

### 23.5 Secrets (Companion actions)
- `secrets.1password.testConnection`
- `secrets.resolve` *(internal dependency; typically not exposed directly)*

---

## 24. Out-of-Scope
- **OOS24.1 (OUT)** Creating/vending new cloud accounts/subscriptions.
- **OOS24.2 (OUT)** Remote-hosted Companion operation (v1).
- **OOS24.3 (OUT)** Arbitrary shell command execution via the Companion.

---

## 25. Open Decisions
- **OD25.1** Team mode: will you ship a control service for RBAC/policy/audit, or rely on Git-only distribution?
- **OD25.2** Custom action format: template-based vs DSL; maximum allowed expressiveness.
- **OD25.3** Enterprise restriction: allow PWA-sent Terraform bundles or require Companion-fetched Git only?
- **OD25.4** Signing requirements: do enterprises require signed action packs and/or signed custom actions?

---