---
name: Ludo DZ haptics (vibration) system
description: How navigator.vibrate haptics are wired — independent manager, theme-independent trigger points, unlike per-theme SFX.
---

## Architecture (added 2026-08-04)
`src/lib/haptics-manager.ts` mirrors the BGM/SFX pattern in `sound-manager.ts` but is a fully separate system: its own `ludo-dz:haptics-enabled` localStorage key (default ON), its own `isHapticsEnabled`/`setHapticsEnabled` pair, and three trigger functions — `vibrateDiceRoll`, `vibratePawnStep`, `vibrateCaptureOrWin` — each gated on the toggle and on feature-detecting `navigator.vibrate`.

## Key difference from the SFX system: haptics are theme-independent
The per-theme pawn-move/capture SFX in `GameBoardScreen.tsx` are gated per board style (`if (isNeon) playNeonPawnMove(...)`, etc.), and capture SFX historically only existed for Classic (see `ludo-sound-architecture.md`). Haptics deliberately do **not** follow that gating: `vibratePawnStep()` is called unconditionally inside all three of `handleNeonHopLand`/`handleClassicDustStep`/`handleDzSparkleStep` (exactly one fires per physical hop since PawnToken only invokes the active theme's callback), and `vibrateCaptureOrWin()` is called unconditionally in both capture-resolution sites (the zero-step fast path and the animated `onLastHop` path) plus a dedicated `useEffect` keyed on `[game.winner]` for the win case. **Why:** a phone's vibration motor is a single physical affordance the player feels regardless of which visual skin is active — unlike audio cues, which are intentionally distinct per theme as part of that theme's identity. **How to apply:** if a future theme is added, its pawn-step/capture haptic already works for free (no new call site needed) as long as it follows the same `handle*Step`-callback-per-theme convention; only a new SFX cue would need its own function + call site.

## Win-event detection pattern
`game.winner` has no dedicated "just won" transition anywhere else in the file (existing effects only guard against acting *while* a winner exists). The haptic win trigger uses a plain `useEffect(() => { if (game.winner === null) return; vibrateCaptureOrWin(); }, [game.winner])` — fires exactly once per game when the value changes away from `null`. Reuse this pattern for any future "on win" side effect instead of trying to detect it inline at every `setGame` call site.
