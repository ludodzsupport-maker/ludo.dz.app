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

## Cordova project shell

`config.xml` lives here (app id `com.ludodz.app`, name "Ludo DZ", version
`1.0.0`), alongside the `www/` bundle above. It was scaffolded by hand
(rather than `cordova create`, which requires an empty target directory)
plus `cordova platform add android`, which generates `package.json`,
`package-lock.json`, and `platforms/android/`.

- `config.xml` and `package.json`/`package-lock.json` are committed — they
  fully describe the project (app id, name, version, which platforms are
  installed).
- `platforms/`, `plugins/`, `node_modules/`, and `www/` are all gitignored
  build/scaffolding output. `codemagic.yaml` regenerates them on every CI
  run via `pnpm --filter @workspace/ludo-dz run build:cordova` followed by
  `cordova platform add android` and `cordova build android`.
- To reproduce or update the Android platform locally: build the web
  bundle first (see above), then run `npx cordova platform add android`
  and `npx cordova build android` from within this directory. A full
  `cordova build android` needs a JDK + Android SDK, which aren't part of
  this Replit container — Codemagic's build machine provides those.

## Android splash artwork

The native Android splash is intentionally minimal so the system launch window
can hand off to the web app as quickly and cleanly as possible. `config.xml` uses
a near-black background (`#03040B`) that matches the first frame of the web
startup welcome screen, sets the Android splash animation duration to `0`, and
points `AndroidWindowSplashScreenAnimatedIcon` at
`res/splash/android/ludo_dz_splash.xml`. That vector is a 1dp solid-color fill,
not a branded illustration, to avoid the old blue/icon flash before the WebView
content takes over.

The animated premium welcome treatment now lives in the React app and runs as
the first WebView-rendered screen before the unchanged dice loading screen.
