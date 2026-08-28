---
name: Headless Chromium in this sandbox (npm-only network)
description: How to run a real headless browser for runtime DOM/pixel verification when the Playwright/puppeteer CDNs and apt are blocked but the npm registry works.
---

# Headless Chromium in the Arena sandbox

**Constraint:** `cdn.playwright.dev`, Google's Chrome CDN and `deb.debian.org` are all unreachable (TLS resets), but `registry.npmjs.org` works. `apt-get` cannot install browser deps.

## Recipe that works

```bash
mkdir /tmp/pptr && cd /tmp/pptr && npm init -y
npm install puppeteer @sparticuz/chromium   # both from the npm registry
# the chromium binary ships inside the npm tarball; inflate it:
node -e "require('@sparticuz/chromium').default.executablePath().then(console.log)"  # → /tmp/chromium
# the same package ALSO ships the missing NSS shared libs in bin/al2023.tar.br:
node -e "require('zlib').brotliDecompressSync(require('fs').readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))" > /tmp/al2023.tar
mkdir -p /tmp/al2023 && tar xf /tmp/al2023.tar -C /tmp/al2023   # libnspr4.so, libnss3.so, libnssutil3.so …

# launch with LD_LIBRARY_PATH so chromium finds libnss:
LD_LIBRARY_PATH=/tmp/al2023/lib node -e "
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'], headless: 'shell' });
  const p = await b.newPage();
  await p.goto('http://localhost:21341/');
  // …
})();" 
```

## Driving the Ludo app to a game board

Splash auto-dismisses (~3-4.5s) → welcome ("MULTIJOUEUR" card) → mode select ("Ordinateur") → config overlay. **The "Commencer" button must be clicked twice**: the first click opens the colour picker (`needsColorPicker`), the second launches the game. Click "4" first for a 4-player match. Synthetic `element.click()` works for React handlers; the exit/back buttons often have no text — select by `aria-label`.

Runtime probes that paid off: `getComputedStyle(el).transform` matrix → translateY/rotate/scale; bounding-rect intersection with the clip window → visible fraction; `page.emulateMediaFeatures([{name:'prefers-reduced-motion', value:'reduce'}])` for the reduced-motion path; screenshot + PIL pixel-row analysis as ground truth (beware: the dice card's own box-shadow reads as "art" a few px beyond its edge — check the horizontal extent to tell a compact mascot hint from a card-wide shadow band).
