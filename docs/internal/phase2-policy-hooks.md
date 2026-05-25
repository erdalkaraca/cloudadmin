# Phase 2: control-service policy hooks

`extension-cloud` exports `evaluateDirectOperation` from `policy.ts` as a placeholder for future RBAC. Cloud/container/compute **commands** are deferred until we design a proper interaction model.

When adding RBAC:

1. Load policy document from Git or control-service API at app start.
2. Replace personal-mode allow-all in `evaluateDirectOperation`.
3. Audit denials via `extension-cloud` scope UI or a dedicated audit extension.

Do not duplicate policy checks in provider extensions; import policy helpers from `extension-cloud/api` in UI and before privileged Companion operations.
