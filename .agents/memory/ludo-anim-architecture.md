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

**Rule:** Each hop step should only animate the axis (X or Y) that actually changes.

**Why:** Animating both X and Y even when only one changes can cause Framer Motion to interpolate diagonally due to easing curves. At corners, this produces drift off the grid path.

**How to apply:**
- `PawnToken` receives `startX/startY` (from `getPieceXY(piece, currentGame.pieces)` — includes stacking offsets).
- The hop loop tracks `prevX/prevY` and builds `moveTarget` with only the changed axis property.
- `baseCtrl.start(moveTarget)` — Framer Motion only animates the properties present in the object.

# State Ownership

- `pieceAnims: Record<string, PieceAnim>` — owned by `GameBoardScreen`, passed as prop to `BoardSVG`
- `shockwave`, `homeImpact`, `homeFinishVFX` — owned by `GameBoardScreen`, passed as props
- `BoardSVG` removed its own `useEffect([pieces])` animation trigger — no longer self-manages animation
- `triggerMove` is a stable `useCallback([])` that reads live values via `gameRef` and `isAnimatingRef`
