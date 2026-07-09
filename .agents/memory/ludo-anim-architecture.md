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

# State Ownership

- `pieceAnims: Record<string, PieceAnim>` — owned by `GameBoardScreen`, passed as prop to `BoardSVG`
- `shockwave`, `homeImpact`, `homeFinishVFX` — owned by `GameBoardScreen`, passed as props
- `BoardSVG` removed its own `useEffect([pieces])` animation trigger — no longer self-manages animation
- `triggerMove` is a stable `useCallback([])` that reads live values via `gameRef` and `isAnimatingRef`
