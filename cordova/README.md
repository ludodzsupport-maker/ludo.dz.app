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

The Android 12+ system splash shows `AndroidWindowSplashScreenAnimatedIcon`
scaled into a 288dp box and masks everything outside its central 192dp circle,
so a full-bleed square app icon would be zoomed in and cropped. The splash
icon therefore ships as a pre-padded PNG:
`res/splash/ludo-dz-splash-icon.png` is a 1152×1152 transparent canvas with
the complete 576×576 logo (from `artifacts/ludo-dz/public/ludo-logo.png`,
the same asset the in-app screens use) centered at exactly 50% of the canvas,
so the whole logo lands inside the unmasked two-thirds circle (measured
content radius ≈ 0.31 of the canvas vs. the 0.333 mask radius).

To regenerate it after the logo changes:

```bash
convert artifacts/ludo-dz/public/ludo-logo.png -resize 576x576 \
  -background none -gravity center -extent 1152x1152 \
  cordova/res/splash/ludo-dz-splash-icon.png
```

`config.xml` points `AndroidWindowSplashScreenAnimatedIcon` at that PNG. The
older line-art concept (`res/splash/ludo-dz-splash.svg` +
`res/splash/android/ludo_dz_splash.xml`) is kept for reference but is no
longer referenced by the build; if it is ever reintroduced, note that the
vector must keep the full logo inside the central 192/288 of its viewport or
it will be circle-masked again. If an older splash mechanism is reintroduced
that only accepts PNG files, rasterize the SVG outside the repository into
the required ldpi, mdpi, hdpi, xhdpi, xxhdpi, and xxxhdpi assets and upload
those binary files separately.
