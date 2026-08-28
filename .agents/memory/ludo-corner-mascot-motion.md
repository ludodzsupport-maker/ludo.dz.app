---
name: Ludo corner mascot hide/peek/retreat model
description: How CornerMascot hides behind the dice cards, the exact clip-window geometry, the idle head-peek hint, and the mood gesture layers — plus the invariants that must not break.
---

# CornerMascot motion model (hide → climb to peek → retreat)

**File:** `artifacts/ludo-dz/src/components/CornerMascot.tsx`

## Geometry (the part that broke once — keep these invariants)

The character lives in a clip window (`overflow: hidden`) glued to the card's board-facing edge:
- Top panels (gaze `"down"`): window ABOVE the card, `bottom: panelH` on the panel wrapper.
- Bottom panels (gaze `"up"`): window BELOW the card, `top: panelH`.
- Window height = `mascotH + HEADROOM(8)`; the climb layer is `mascotH` tall anchored to the **card-adjacent edge** (`bottom: 0` for gaze down, `top: 0` for gaze up).
- `yHidden = winH + 2` — one uniform DOWNWARD travel for all four corners. Both orientations hide **downward** (behind the card for top panels, below the window for bottom panels) and climb **upward**. Never reintroduce per-gaze hide directions: the old bug hid top-panel mascots by translating UP, which left a floating feet-sliver detached in mid-air ~50px from the card ("characters fully visible at all times").

## Idle hint

A separate tiny element (`data-mascot-hint`) shows only the top `hintH = max(5, 14% of mascotH)` px of the same artwork, flush against the card's edge (bottom strip of the window for top panels, top strip for bottom panels). It fades out fast (0.12s) when the character becomes visible and back in after 0.3s. Because the climbing character's head passes through the exact same strip with the same art, the crossfade is pixel-identical. Yellow's hint is its trophy/arm tip (its art leans left at the top) — expected, not a bug.

## Gestures

State machine: `hidden → greet (1s, on active's false→true edge) → joy | sad | roll | anticipate | idle`, all transform-only on nested layers each with `transformOrigin: 50% 100%` (pivot at the card edge). Bottom panels must keep hop amplitudes small (≤ ~2px + stretch): their clip edge on the head side IS the card edge, so a big hop hides the head mid-jump. Reduced motion / Neon pause (`still`): fade-based climb, no loops, static hint.

**Layered motion model (2026-08-28):** stage (climb/retreat) → landing (one-shot squash on each rise) → base-life (permanent breath/sway while visible, per-property periods 3.7/4.6/6.3s so the composite is quasi-aperiodic) → gesture (mood expression) → glow (filter) → art. Rules that matter:
- Every gesture keyframe track must START and END at the same neutral pose. Framer starts keyframe tracks at `keyframes[0]`, NOT at the current value, so a held pose that never returns to neutral hard-cuts when the next mood takes over. The sad droop is a self-contained envelope `[0, 2.6, 2.6, 0]` over 1.5s that ends at rest BEFORE the 1.6s mood override expires.
- Never put `initial={false}` on a layer whose animate is a looping keyframe track mounted while visible: framer then sets keyframes[0] and never runs the loop (frozen base-life). Omit `initial` — mount values are neutral anyway.
- Retreat = `y: [0, -2.5, yHidden]` (duck anticipation) with `times [0, 0.2, 1]`, ease `["easeOut", "easeIn"]`.

## Mascot event plumbing (the "never hides" bug, fixed 2026-08-28)

Root cause was NEVER geometry: `mascotEvent` was ONE shared state slot. On a capture, `raiseMascotEvent(captor,'capture')` then `raiseMascotEvent(victim,'captured')` fire in the same tick → the victim's event instantly replaces the captor's (captor's celebration never rendered). Worse, the victim's 1.6s consolation timer lived in a `useEffect([event])` CLEANUP: any other corner's event (next player's six, another capture) superseding it turned this corner's prop non-null→null, the cleanup cleared the pending timeout, the new run early-returned on `!event` → `overrideMood` stuck at `"sad"` FOREVER → `visible = active || overrideMood === "sad"` → that mascot peeked and never retreated again. Any corner could be hit; the user saw Green/Yellow (bottom) simply because those were the capture victims in their game.

Fix (both parts needed):
1. `CornerMascot`: mood timer in a `useRef`, cleared only by the same corner's next event or unmount — never by the effect cleanup.
2. `GameBoardScreen`: `mascotEvents: Record<number, MascotEvent>` (one slot per corner); `raiseMascotEvent` merges into the player's own slot; the four CornerDice call sites pass `mascotEvents[p] ?? null`. Now the captor celebrates AND the victim consoles, independently.

## DOM hooks for testing

`data-mascot={player}` (window), `data-mascot-mood={mood}` (window attr), `data-mascot-stage` (climb layer), `data-mascot-hint`. Layer chain inside the stage: `children[0]` landing → `children[0]` base-life → `children[0]` gesture → `children[0]` glow. The active panel is detectable by card width (active card scales to 1.08 vs 0.88). Sad mood = inline `saturate(0.55)` filter on the mascot `<img>`.

## Verification recipes that worked (fresh sandbox)

Puppeteer harness: `/tmp/pptr` (npm i puppeteer @sparticuz/chromium), binary at `/tmp/chromium`, libs at `/tmp/al2023/lib` (extract `node_modules/@sparticuz/chromium/bin/al2023.tar.br` via `zlib.brotliDecompressSync` → tar), run with `LD_LIBRARY_PATH=/tmp/al2023/lib`. Gotchas: puppeteer 25 lacks `page.addInitScript` (use `evaluateOnNewDocument`); passing a predicate into `page.evaluate` via `new Function('e','return '+src)` returns the arrow (always truthy) — use `new Function('return ('+src+')')()`; `matchMedia` change events do NOT fire under `emulateMediaFeatures` in headless shell, so `useReducedMotion` can't be flipped dynamically — load a fresh page with the media pre-set instead. Nav flow: wait for MULTIJOUEUR → click the MULTIJOUEUR card button → "Ordinateur" card → "4" → "Commencer" (opens colour picker) → "Commencer" again; select visible buttons only (getBoundingClientRect > 10px, AnimatePresence keeps stale screens mounted). Component-level rig: a temp root HTML + `src/components/__MascotRepro.tsx` importing the real CornerMascot, exposing `window.__fire(player, kind)` / `window.__setActive(p)` — lets you replay exact game event sequences deterministically (natural captures are ~1 per 4 min in-game; don't wait for luck).
