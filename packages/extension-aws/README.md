# extension-aws

**Status:** Stub — **deferred** (post-MVP)

| Constant | Value |
|----------|--------|
| `providerId` | `aws` |
| Command namespace | `aws.*` |

## Purpose

AWS account/profile connections; inventory and read-heavy operations via **AWS SDK for JavaScript v3** in the browser (PROV13.1, §14.1).

## When to implement

After `extension-cloud`, `extension-k8s`, and `extension-portainer` MVP slices are stable.

## Implementation checklist

### 1. Contributors

Register `CloudConnectionContributor` + `CloudTreeContributor` for `providerId: 'aws'`.

### 2. Connection flow

- SSO / named profile / AssumeRole (§14.1 AWS14.1)
- Persist: account alias, `profileName`, default `region` — not access keys in `connections.json`
- Credentials via existing AWS credential chain in browser (Cognito/SSO plugin TBD)

### 3. Tree hierarchy

```
connection (account/profile)
  └── region
        └── service grouping (EC2, S3, EKS, …)
              └── resource
```

### 4. Browser API

- `@aws-sdk/client-ec2`, `client-s3`, `client-eks`, `client-cloudwatch`, IAM read-only clients
- Throttling/backoff (NFR22.6)

### 5. Commands

Register only `aws.*`. Companion only where CLI is unavoidable (rare for inventory).

### 6. Dependencies

```bash
npm install @aws-sdk/client-ec2 @aws-sdk/client-s3 -w extension-aws
```

## Requirements references

- §14.1 AWS14.1–14.x
- PROV13.10 AWS hierarchy

## Enable in app

Add `extension-aws` to `packages/app/package.json` dependencies (already listed) and ensure it stays **disabled in marketplace** or hidden from “Add account” until `connect` is implemented.
