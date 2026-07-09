---
name: Ludo DZ animation architecture
description: How pawn movement animation is decoupled from game state resolution to prevent premature capture and multi-step glitching.
---

# Animation-State Decoupling Pattern

**Rule:** `E.doMove()` must NOT be called until the moving pawn's final hop animation completes.

**Why:** Calling `doMove` immediately updates `piece.relPos` for the captured piece to -1, which makes `getPieceXY` return the home-base position. This causes the captured piece to visually teleport home (or start a defeat arc) while the captor pawn is still mid-journey.

**How to apply:**
- `triggerMove(pid)` in `GameBoardScreen` pre-computes `nextState = E.doMove(game, pid)` but does NOT call `setGame(nextState)` immediately.
- Animation state (`pieceAnims`, VFX) is owned in `GameBoardScreen`, NOT in `BoardSVG`.
- The moving piece's `PieceAnim.steps` is set to the hop path; all others (including the captured piece) get `steps: null` so they hold at their current rendered positions.
- `onLastHop` fires from `PawnToken` when the captor's final hop lands. THEN: fire VFX, call `setGame(nextState)`, and only then set the captured piece to `steps: 'defeat'`.
- `isAnimatingRef.current` is set synchronously to `true` at the top of `triggerMove` (atomic lock) before any React state updates, preventing double-dispatch on rapid clicks.
- If `steps.length === 0` (e.g. a 6-roll from base that lands on the start tile immediately): apply state directly and unlock without animation.

# Axis-Diff Hop Loop (Corner Drift Fix)

**Rule:** Each hop step only includes the axis properties that actually change in `moveTarget`. For the 4 inner-corner hops both axes change (diagonal), which is intentional — one smooth diagonal hop per corner turn.

**Why:** The 4 inner corners of the MAIN_PATH (e.g. Red relPos 4→5: [6,5]→[5,6]) are genuinely diagonal in grid space — both row and col change simultaneously. No pivot waypoints should be inserted between them; doing so adds a ghost cell not on the track, creating a visible extra step.

**How to apply:**
- `buildHopPath` returns raw MAIN_PATH positions only — one step per die pip, no inserted waypoints.
- `PawnToken` receives `startX/startY` (from `getPieceXY` — includes stacking offsets).
- The hop loop tracks `prevX/prevY`; if only X changes, only `x` is in `moveTarget` (prevents Framer Motion from touching Y). If both change (corner), both are included — the pawn hops diagonally in one step.

# PLAYER_STARTS — Home Stretch Entry Fix

**Rule:** `PLAYER_STARTS = [51, 12, 25, 38]` (NOT the intuitive [0,13,26,39]).

**Why:** The four ★ star tiles in MAIN_PATH (abs 50=[7,0], 11=[0,7], 24=[7,14], 37=[14,7]) are axis-aligned to HOME_COLS[p][0] for each player. For relPos 51 to land on the star (clean straight entry), PLAYER_STARTS must be shifted back by 1. With the old [0,13,26,39], relPos 51 landed one cell PAST the star, causing the pawn to overshoot the home entry and jump back diagonally to relPos 52.

**How to apply:** `PLAYER_STARTS = [51, 12, 25, 38]` and `SAFE_SET = new Set([8, 12, 21, 25, 34, 38, 47, 51])` (new starts replace old starts; mid-path safes 8,21,34,47 unchanged).

# State Ownership

- `pieceAnims: Record<string, PieceAnim>` — owned by `GameBoardScreen`, passed as prop to `BoardSVG`
- `shockwave`, `homeImpact`, `homeFinishVFX` — owned by `GameBoardScreen`, passed as props
- `BoardSVG` removed its own `useEffect([pieces])` animation trigger — no longer self-manages animation
- `triggerMove` is a stable `useCallback([])` that reads live values via `gameRef` and `isAnimatingRef`
