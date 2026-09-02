- [Ludo dice-roll + movable-glow measurements](ludo-dice-glow-measurements.md) — how to profile the Classic dice roll in the sandbox, which causes were falsified, and the values that shipped.

# Dice-roll stutter & movable-glow: measured findings (2026-09)

Measured with a Puppeteer + headless-Chromium harness that forces a deterministic
Classic 4-player board (seed `localStorage['ludo-dz:saved-game']` with a v1
snapshot → splash → MULTIJOUEUR → Ordinateur → **Reprendre**), then taps the
`TAP` span's clickable ancestor. Scripts lived in `/tmp/pptr` (not committed):
`lib.js`, `snapshot.js`, `pace3.js` (frame pacing), `measure-metrics.js`
(CDP `Performance.getMetrics`), `measure-glow.js`, `glow-pixels.js`.

## Instrumentation traps (cost hours — read before profiling again)
- **Never touch the DOM inside the rAF recorder.** `querySelectorAll` +
  `getComputedStyle` per frame cost ~10 fps: it made an idle board read 50 fps.
  `pace3.js` records timestamps only; read element state after the window.
- Frame pacing in this sandbox is **software-rasterization bound** (`--disable-gpu`,
  `SoftwareRenderer::DoDrawQuad`, 350-580 ms of raster per roll). Identical code
  varies 31-61 fps roll-to-roll, so <5 fps differences are unmeasurable. Use
  `Performance.getMetrics` deltas (ScriptDuration / TaskDuration) for low-noise
  main-thread attribution, and `Emulation.setCPUThrottlingRate(4)` to make the
  main thread the bottleneck.
- `/tmp/GameBoardScreen.orig.tsx` trick: copy the file aside, patch, measure,
  restore — Vite HMR picks up swaps in ~1 s.

## Dice roll (Classic, slider 70 → 943 ms roll, 10 cadence ticks)
Falsified as causes (each tested by disabling it, 5-10 rolls each, no fps gain):
corner-panel box-shadow loop, the tumble's animated `scale`, the tumble itself
(die unmounted → same fps), the roll audio, the cadence timers.

Confirmed + shipped: every cadence tick called `setAnimDice(random)`, and
`animDice` is only read for the *landing* orientation — `DieFace` renders all six
cube faces, so the face visible mid-tumble is decided by rotation. That was
~9-10 whole-screen React commits per roll buying nothing:
ScriptDuration/roll 157.7 → 117.9 ms (-25%), TaskDuration 368.8 → 337.8 ms (-8%).
Roll duration/tick schedule untouched (deliberate design).

## Movable-piece glow (Classic), before → after
Tile wash `rect[filter="tile-glow"]`: opacity `[0.06,0.24,0.06]` 880 ms
`easeInOut` with **per-tile delay 0/140/280/420 ms** → `[0.10,0.17,0.10]`,
**delay 0**. Pawn halo `circle[stroke="#D9A400"]`: `[0.28,0.88,0.28]` 1000 ms →
`[0.42,0.70,0.42]`. Time for the last tile to reach 90% of its own peak:
905 → 428 ms; spread across tiles 416 → 0 ms. Pixel check (mean ΔRGB vs. the
same tile with the rect hidden): floor 7.2 → 13.2, peak 34.5 → 24.1, swing
27.5 → 11.0 — dimmer flash, brighter resting state, all four tiles identical.
Both changes are guarded so DZ/Neon/Normal keep their tuned values.
