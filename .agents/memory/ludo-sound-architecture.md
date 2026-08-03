---
name: Ludo DZ board-theme sound architecture
description: How per-theme sound cues are structured in sound-manager.ts and wired into GameBoardScreen.tsx; what's implemented per theme as of the Classic capture-sound pass.
---

## Where things live
All board-theme audio (distinct from the global UI click sounds) lives in `artifacts/ludo-dz/src/lib/sound-manager.ts`. Neon and Classic cues are synthesized live via the Web Audio API (`playSynthCue` + per-theme functions) rather than static files — zero licensing overhead, instant start, crisp at any scale. The one exception is Classic's dice roll, which plays a real recorded sample (`public/sounds/dice-roll-classic.wav`) trimmed/stretched via `playbackRate`/gain-fade to exactly match the roll animation's computed duration (`getRollDurationMs` mirrors the animation's own timing math so audio and visual can never drift apart).

## Two-layer wiring, same shape as the visual board-theme pattern
Mirrors the wiring pattern in ludo-dz-theme.md but for audio: (1) a per-theme play function exported from sound-manager.ts, (2) a call site inside GameBoardScreen.tsx gated on `isClassic`/`isNeon`/`isDz`. Both must exist for a cue to be reachable in-game — check sound-manager.ts exports AND grep GameBoardScreen.tsx for an actual call, not just one or the other.

## Capture had NO call site for any theme until the 2026-08-03 Classic pass
Unlike dice-roll and pawn-move (which already had trigger call sites for Neon and Classic), capture had zero sound wiring for any theme — only a shared visual shockwave (`setShockwave`, fires for all themes at the same spot, not theme-gated). There are two separate capture-resolution branches inside `triggerMove` (GameBoardScreen.tsx) that both need the same theme-gated sound call: the `steps.length === 0` immediate-resolve branch (piece already at destination, e.g. moving out of base on a 6), and the normal `onLastHop` callback (multi-hop moves). Wiring only one leaves captures silent on some moves but not others.

## Per-theme material identity, and a direction change worth knowing about
Neon = fully synthesized digital/sci-fi (filtered noise sweeps + oscillator tones). Classic = "wood family" built on a shared `scheduleWoodKnock` helper (filtered noise "chk" + decaying triangle "thock"), reused across click/pawn-move/capture with different amp/freq/decay per cue so all Classic cues read as one coherent material. Classic's pawn-move was originally a deliberate "polished marble" design (explicitly *not* using scheduleWoodKnock, per the old code comment) — overridden to join the wood family in the 2026-08-03 pass because the user's brief explicitly asked for "wooden pawns." If a future request revisits Classic pawn sound, wood-family (not marble/stone) is the current intended direction unless told otherwise.

## DZ theme has no dedicated sound identity yet
As of 2026-08-03, the DZ board falls through to whatever the call site defaults to for dice/pawn/capture — no `isDz`-specific sound functions exist yet in sound-manager.ts. This mirrors Phase-1-era DZ visuals (see ludo-dz-theme.md) where a theme can be visually wired well before its sound identity is designed — DZ silence is "not yet scoped," not a bug.
