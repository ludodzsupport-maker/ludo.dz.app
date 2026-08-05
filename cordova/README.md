# Cordova / Monaca packaging

This directory holds the mobile-packaging concern for Ludo DZ, kept fully
separate from the pnpm workspace so it can never interfere with the live
app's dev server or production deploy.

## How the isolation works

- `artifacts/ludo-dz/vite.cordova.config.ts` is a standalone Vite config
  (sibling to the normal `vite.config.ts`) that builds the same game source
  but with `base: './'` and outputs to `cordova/www` instead of
  `artifacts/ludo-dz/dist/public`.
- Nothing in `.replit`, any workflow, or `artifact.toml` references this
  config or this directory — it only runs when explicitly invoked.
- It reuses the same pnpm-installed dependencies as the rest of the
  monorepo (React, Vite, etc.) — there's no separate npm install step and
  no second `node_modules` tree to keep in sync.

## Building the web bundle

```bash
pnpm --filter @workspace/ludo-dz run build:cordova
```

This produces `cordova/www/` — a static bundle suitable for wrapping in a
Cordova or Monaca shell. `cordova/www` is gitignored since it's build
output, not source.

## Next steps (not yet done)

No actual Cordova/Monaca project has been scaffolded yet — there's no
`config.xml`, `platforms/`, or `plugins/` directory. When you're ready to
package this for app stores, scaffold the Cordova project shell here
(e.g. `cordova create . <id> "Ludo DZ"` run from within this directory, or
via the Monaca CLI/dashboard) so `config.xml` sits alongside `www/` as
Cordova expects.
