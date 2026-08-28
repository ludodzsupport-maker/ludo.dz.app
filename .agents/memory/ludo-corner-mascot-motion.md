---
name: Mascot characters — presentation component and placements
description: Where the four illustrated characters live now (MascotCharacter.tsx), the layered motion model invariants, and why the board-side CornerMascot was removed entirely.
---

# Mascot characters (MascotCharacter.tsx)

**History:** the characters used to live on the gameplay board as `CornerMascot` (hide/peek/retreat behind the dice cards with one-shot mood events). Removed from the board on 2026-08-28 by product decision; `CornerMascot.tsx` is deleted. The artwork, per-colour theming and gesture/motion work were extracted into `src/components/MascotCharacter.tsx`, a standalone presentation component.

## Current placements

1. **Colour picker** (`GameConfigOverlay.tsx`, the `showColorPicker` section): a hero mascot (58px, neon glow) in the glowing 78×78 tile of the selected colour — `greetKey={humanColor}` replays the wave on every pick — plus a 30px mascot in each of the 2×2 colour-option buttons (replacing the old PawnSilhouettes there; the exclude grid keeps pawn silhouettes deliberately).
2. **Victory screen** (`VictoryScreen.tsx`): the winner's character (88px) in `mood="joy"` where the lucide Trophy used to be, themed to the match's boardStyle (isClassic/isDz/isNeon → gold for DZ). Sparkles accent kept for Classic/DZ. Non-winners are NOT shown (kept simple).

## Component contract

`<MascotCharacter player mood size isClassic isDz isNeon greetKey />` — mood: "alert" | "excited" | "joy" | "sad"; size = height px (width = height × 0.558); greetKey change replays the one-shot wave. DOM hooks: `data-mascot-character={player}`, `data-mascot-character-mood={mood}`. Character↔player mapping is index-based (0 Red, 1 Blue, 2 Yellow, 3 Green pawn-character); DZ theme reskins colours but the characters stay index-mapped (pre-existing convention from the board).

## Layered motion model (invariants — keep these)

Layers (outer→in): container → landing (one-shot squash [0.955, 1.012, 1] on mount) → base-life (permanent breath/sway while mounted; per-property periods 3.7/4.6/6.3s desynchronised so the composite is quasi-aperiodic) → gesture (mood) → glow (filter) → art. All transform layers `transformOrigin: 50% 100%`.

- **Neutral-anchored keyframes:** framer starts keyframe tracks at `keyframes[0]`, NOT the current value. Every LOOPING gesture must start and end at the same neutral pose so mood switches cross-fade through rest. HELD poses (sad) must use single-value targets (those blend both in and out).
- Never put `initial={false}` on a layer whose animate is a looping keyframe track mounted mid-state: framer freezes it at keyframes[0]. Omit `initial` when mount values are neutral.
- Reduced motion (`useReducedMotion`): all layers static neutral, no FX, glow static.
- Joy loops with `repeat: Infinity, repeatDelay: 0.55` in presentation contexts (sustained celebration); base-life fills the pauses.

## Verification recipes (fresh sandbox)

Harness: `/tmp/pptr` (npm i puppeteer @sparticuz/chromium), binary `/tmp/chromium`, libs `/tmp/al2023/lib`, run with `LD_LIBRARY_PATH=/tmp/al2023/lib`. Gotchas: puppeteer 25 lacks `page.addInitScript` (use `evaluateOnNewDocument`); pass predicates as source strings and rebuild with `new Function('return ('+src+')')()` (NOT `new Function('e','return '+src)` — that returns the arrow and matches everything); matchMedia change events never fire under `emulateMediaFeatures` in headless shell; select only VISIBLE buttons (AnimatePresence keeps stale screens mounted). Nav: wait MULTIJOUEUR → MULTIJOUEUR card → "Ordinateur" → "4" → "Commencer" (opens picker; verify mascots here) → "Commencer". Auto-roll on the mascot-free board: find absolutely-positioned card-sized panel wrappers (40–90 × 60–120px), click each wrapper's lastElementChild when its width/panelWidth > 0.95 (active scales 1.08 vs 0.88). Rig pages (temp HTML importing real components from the Vite dev server) work well for screens hard to reach in-game (e.g. VictoryScreen with a synthetic finished GameState). Board mascot absence: `document.querySelectorAll('[data-mascot-character], [data-mascot], [data-mascot-stage]').length === 0` while a MutationObserver confirms the game is actually progressing.
