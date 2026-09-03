---
name: Headless Chromium in this sandbox (npm-only network)
description: How to run a real headless browser for runtime DOM/pixel verification when the Playwright/puppeteer CDNs and apt are blocked but the npm registry works.
---

# Headless Chromium in the Arena sandbox

**Constraint:** `cdn.playwright.dev`, Google's Chrome CDN and `deb.debian.org` are all unreachable (TLS resets), but `registry.npmjs.org` works. `apt-get` cannot install browser deps.

## Recipe that works

```bash
mkdir /tmp/pptr && cd /tmp/pptr && npm init -y
npm install puppeteer-core @sparticuz/chromium   # puppeteer (full) FAILS: its postinstall
                                                 # downloads Chrome from a blocked CDN, so
                                                 # install puppeteer-core and point it at the
                                                 # bundled binary yourself
node -e "require('@sparticuz/chromium').default.executablePath().then(console.log)"  # → /tmp/chromium
# the same package ALSO ships the missing NSS shared libs in bin/al2023.tar.br:
node -e "const fs=require('fs');fs.writeFileSync('/tmp/al2023.tar',require('zlib').brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')))"
mkdir -p /tmp/libs && tar xf /tmp/al2023.tar -C /tmp/libs --strip-components=1  # libnspr4.so, libnss3.so, libnssutil3.so …
# launch with LD_LIBRARY_PATH so chromium finds libnss (set it in-process before launch()):
process.env.LD_LIBRARY_PATH = '/tmp/libs'
puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
  args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'] })
```

**Version drift (verified Sep 2026, @sparticuz/chromium 149):**
- The package exports `{ default, inflate, setupLambdaEnvironment }` — `executablePath()` lives on
  `.default`, NOT on the module object. `require('@sparticuz/chromium').executablePath()` throws
  "not a function".
- `ldd /tmp/chromium` reports exactly 3 missing libs (libnspr4, libnss3, libnssutil3); the al2023
  archive covers all three. No other system lib is missing, so no apt is needed.
- `/tmp` is wiped between turns (only the workspace is snapshotted), so re-run this recipe each
  session that needs a browser. Budget ~1 min.
- The npm registry is the ONLY reachable host (`storage.googleapis.com` and
  `cdn.npmmirror.com` both time out), so anything Chromium-related must come from an npm tarball.

## Driving the Ludo app to a game board

Splash auto-dismisses (~3-4.5s) → welcome ("MULTIJOUEUR" card) → mode select ("Ordinateur") → config overlay. **The "Commencer" button must be clicked twice**: the first click opens the colour picker (`needsColorPicker`), the second launches the game. Click "4" first for a 4-player match. Synthetic `element.click()` works for React handlers; the exit/back buttons often have no text — select by `aria-label`.

Runtime probes that paid off: `getComputedStyle(el).transform` matrix → translateY/rotate/scale; bounding-rect intersection with the clip window → visible fraction; `page.emulateMediaFeatures([{name:'prefers-reduced-motion', value:'reduce'}])` for the reduced-motion path; screenshot + PIL pixel-row analysis as ground truth (beware: the dice card's own box-shadow reads as "art" a few px beyond its edge — check the horizontal extent to tell a compact mascot hint from a card-wide shadow band).

## Profiling correctness rules (learned the hard way, Sep 2026)

1. **Never run tracing and a rAF recorder in the same window** — tracing alone
   collapses the observed frame rate to ~3fps and invalidates the fps number.
   Sequence them: metrics window → frames window → trace window.
2. **Sandbox load drifts a lot inside one session** (a Classic board measured
   95fps early on and 57fps 40 minutes later, same code). A before/after pair is
   only trustworthy if the two variants are measured back to back. Note that a
   *pathologically slow* "before" (e.g. a huge animated blur) is load-insensitive
   because it saturates the raster threads, while the fixed "after" is not — so
   an old "after" number must never be compared with a fresh "before" number.
3. **Report raster per frame, not per window.** With `--disable-frame-rate-limit`
   the frames-per-second figure is really throughput; `rasterMs / frames` is the
   comparable per-frame cost.
4. Navigate with ElementHandle clicks (`button, [role="button"], a`) — raw
   coordinate clicks intermittently miss during entrance animations. Dismiss the
   first-run "En développement / Compris" modal or it swallows the next click.
