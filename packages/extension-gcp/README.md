# extension-gcp

**Status:** Stub — **deferred** (post-MVP)

| Constant | Value |
|----------|--------|
| `providerId` | `gcp` |
| Command namespace | `gcp.*` |

## Purpose

Google Cloud project connections; inventory via GCP REST or client libraries in the browser where CORS and auth allow (PROV13.14).

## When to implement

After AWS/Azure patterns exist or when a concrete GCP use case is prioritized.

## Implementation checklist

### 1. Contributors

`CloudConnectionContributor` + `CloudTreeContributor` for `providerId: 'gcp'`.

### 2. Connection flow

- User OAuth (Google Cloud console) or workspace service account **reference** (key file path in workspace, not committed)
- Persist: `projectId`, `region`, display name

### 3. Tree hierarchy

```
connection (project)
  └── location / zone
        └── resource (GCE, GKE, Cloud Run, …)
```

### 4. Browser API

- `googleapis` npm package or REST with OAuth token
- Note: many GCP APIs need proxy or backend for CORS — evaluate PWA feasibility early

### 5. Commands

Register only `gcp.*`.

### 6. Dependencies

```bash
npm install googleapis -w extension-gcp
```

## Requirements references

- PROV13.14 (GCP listed as future provider)
- R2.6 extensibility

## Enable in app

Stub registers extension metadata; omit from MVP “Add account” menu until auth + tree are implemented.
