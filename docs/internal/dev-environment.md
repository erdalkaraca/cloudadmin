# Dev environment

## Node.js

**Vite 8** (required by `@eclipse-docks/core`) needs **Node `>=20.19`** or **`>=22.12`**.

Use the repo `.nvmrc` (Node 22):

```bash
nvm install   # reads .nvmrc (22)
npm run install:deps
npm run dev
```

`npm run dev` uses `scripts/with-node.sh` so the app runs with **`.nvmrc` Node**, not the older Node some IDEs (e.g. Cursor) put first on `PATH`.

On **Node 20.18.x**, `npm` may skip Rolldown native bindings and `vite` fails with `Cannot find native binding`. `@rolldown/binding-linux-x64-gnu` is a **devDependency** (not optional) so `npm install` always installs it when using a supported Node.

## If dev still fails after upgrading Node

```bash
rm -rf node_modules packages/*/node_modules package-lock.json
npm install
npm run dev
```
