---
name: Ludo DZ Cordova/Android blank-screen debugging
description: State of the blank-screen-on-device investigation for the Cordova/Android build, and Vite/cordova-android facts that bear on it.
---

Ludo DZ ships an Android build via a separate Cordova pipeline (`cordova/`,
`artifacts/ludo-dz/vite.cordova.config.ts`, built in CI by `codemagic.yaml`,
not locally in the Replit workspace — there is no `cordova/platforms/`
checked in). It has shown a blank blue screen on a real device with no
console access to diagnose it live.

**Vite always emits `<script type="module" crossorigin>` for a normal app
build.** Confirmed by reading `node_modules/vite/dist/node/chunks/config.js`
(the `toScriptTag`/`toPreloadTag`/stylesheet-tag helpers hardcode
`crossorigin: true` unconditionally) and by diffing actual `build:cordova`
output. Setting `build.target` (e.g. to `es2015`) only lowers JS *syntax* for
older engines — it does not remove `type="module"` or `crossorigin`. The only
way to get a non-module/`nomodule` fallback bundle is `@vitejs/plugin-legacy`,
which is not installed in this project.

**cordova-android (this project pins `^15.1.0`) defaults to serving app
content over `https://localhost`, not `file://`.** Verified against Cordova's
own config reference docs: `AndroidInsecureFileModeEnabled` defaults to
`false` (the flag that would force legacy `file://` loading), and `scheme`/
`hostname` default to `https`/`localhost`. `cordova/config.xml` does not
override any of these. So the "crossorigin fails under `file://`" failure
mode — a very common Capacitor/Cordova gotcha — is less likely to be the
actual cause here than it would be for an app that forces file:// mode.

**Why this matters:** a 2026-08-06 best-effort fix round (no device access)
deliberately set `vite.cordova.config.ts`'s `build.target` to `'es2015'` and
added global `window.onerror` / `unhandledrejection` / capturing `error`
listeners plus a try/catch around the root render in `main.tsx`, rendering a
full-screen overlay with the error text on any uncaught failure. This was
scoped to touch only `vite.cordova.config.ts`, `main.tsx`, and `config.xml`
(no new dependency), so `@vitejs/plugin-legacy` was intentionally not added
even though it would more directly address the `type="module"` question.

**How to apply:** If the blank screen persists after this change:
- If the overlay now shows an actual error on-device, that confirms the
  failure is a runtime error *after* the bundle started executing (React
  render or later) — the overlay's message/stack is the next real lead.
- If it's still fully blank with no overlay at all, that points at the
  bundle failing to load or parse before any of `main.tsx` can run (the
  overlay code can't help with that, by construction — it's bundled inside
  the very file that would be failing to load). At that point,
  `@vitejs/plugin-legacy` (needs installing, touches `package.json`) is the
  logical next escalation, or getting real `adb logcat`/remote-debugging
  access to see the actual browser-level error.

**2026-08-06 root cause found (pending on-device confirmation):** a later
round added a progressive diagnostic overlay (stage text in a fixed bar,
independent of the fatal-error overlay above) and confirmed on-device that
"App rendered" fires normally — ruling out load/parse/JS-error failures
entirely. The real cause: `App.tsx`'s full-screen containers were sized with
the `dvh` unit (`min-h-[100dvh]`, `h-[100dvh]`), which the built Cordova CSS
shipped with no fallback. See
[css-dvh-fallback-pattern.md](css-dvh-fallback-pattern.md) for why that
collapses all visible content to zero height while React still mounts
everything, and for the general fix pattern (`@supports`, not a stacked
`vh`/`dvh` declaration — the latter gets stripped by this project's CSS
minifier). Fix applied to all `dvh` usages in `App.tsx`, `GameBoardScreen.tsx`,
`GameConfigOverlay.tsx`, `VictoryScreen.tsx` and verified against the actual
minified `build:cordova` output, but not yet
confirmed on the physical device that originally showed the bug — if it
recurs, confirm the fix actually reached the device build before assuming a
new cause.
