---
name: Ludo DZ selectable-piece indicator ("Ready lift")
description: Why the Classic/DZ/Neon movable-piece glow was replaced by a lift + socket ring + broadened shadow, the exact wiring constraints inside PawnToken, and how to verify it headlessly.
---

# Selectable-piece indicator: "Ready lift" (Classic / DZ / Neon)

## What shipped (Sep 2026, supersedes the gold-halo / neon-pulse / tile-wash)

One interaction concept, expressed in each theme's own visual language:

| Part | What it does | Where it lives in `PawnToken` |
|---|---|---|
| Lift | body rises `READY_LIFT = -0.125` units, `scale 1.06`, on a spring, then breathes ±0.05 over 1.9s | dedicated `motion.g` (`animate={liftCtrl}`) wrapping only the theme bodies |
| Socket ring | crisp single-weight outline left on the ground, silhouette = theme geometry | sibling `motion.g` inside `AnimatePresence`, BEFORE the lift group |
| Contact shadow | `rx/ry × READY_SHADOW_LIFT (1.10)`, `opacity → 0.72` | the existing ground `motion.ellipse` |

Theme language (all constants in `GameBoardScreen.tsx`):
- Classic → plain ellipse at the pedestal (`baseCY/baseRX/baseRY` + 0.078/0.058), `#D9A400`, sw 0.036
- DZ → octagon (`ringPts(..., 8, π/8)`) at `dzBaseCY + 0.01`, `DZ.BORDER_GOLD`, sw 0.036
- Neon → pointy-top hexagon (`ringPts(..., 6, -π/2)`), `E.PLAYER_NEONS[player]`, sw 0.036
- **Normal → untouched**: keeps its pin ring and the per-cell `movableHighlights` tile wash
  (`movableHighlights` early-returns `[]` unless `isNormal`).

## Why elevation, not more glow

Every other board effect is a *glow* (capture echoes, threat beacons, escape puffs, safe-star
badges, the Neon bloom, and previously the tile wash). A glow can therefore never mean
"tappable" unambiguously, and a wash on the cell can't say *which* pawn it means when two share
a cell. Elevation was the one free channel: nothing else on the board lifts a piece off the
ground, so the cue is unmistakable, survives colour-blindness and low-quality screens, and needs
no pulsing brightness. Practically it also removed the two most expensive things in the old cue:
the `tile-glow` blurred rects and Neon's `pglow` Gaussian filter on the body.

## Wiring constraints (do not break)

- Group nesting is: outer `motion.g` (tile x/y) → stack-scale `motion.g` (`scaleCtrl`) → arc
  `motion.g` (`arcCtrl`, hop + squash) → **lift `motion.g` (`liftCtrl`)** → theme bodies.
  The lift must stay its own group: putting a lift on the arc or stack group fights the hop and
  the landing squash.
- The socket ring sits inside the arc group but OUTSIDE the lift group, so it reads as the
  socket the piece was lifted out of.
- `ready = !!isMovable && !isNormal` is the single gate for all three parts; the lift effect
  depends on `[ready, pulseReduced]` and sets `stale = true` on cleanup so a fast
  select→deselect can't leave a float loop running.
- Reduced motion keeps the lift (position *is* the cue) and drops the float — verified: `y`
  holds at exactly -0.125 across 3.2s.
- `liftCtrl.stop()` was added to the unmount cleanup alongside the other three controls.

## Headless verification recipe (see sandbox-headless-chromium.md for the browser)

Deterministic board: seed `localStorage['ludo-dz:saved-game']` with a v1 snapshot
(`config.modeId: 'computer'`, `humanColor: 0`, 4 players, `phase: 'rolling'`, `activePlayer: 0`),
set `localStorage['ludo-dz:board-style']`, reload, then walk
splash (click 195,500) → MULTIJOUEUR → Ordinateur → **Reprendre**.
Navigation notes: wait for text markers, not fixed sleeps; click the *smallest* matching element
(container centres can land between hit targets); framer-motion animations can appear to stall
~2s in this software-rendered sandbox — sample for ≥6s before concluding anything is broken.
Useful probes: `getComputedStyle(g).transform` matrix → `sx≈1.06` identifies the lift group;
`ellipse[stroke="#D9A400"] / polygon[stroke="#C9A227"] / polygon[stroke-width="0.036"]` count the
rings; `rect[filter="url(#tile-glow)"]` counts the (Normal-only) tile wash.
Measured end state: 4 rings / 4 lifted / 0 mismatches on Classic, DZ and Neon; Normal 4 pin rings,
0 lifts, shadow rx unchanged; tile wash 0 / 0 / 0 / 4 (classic / dz / neon / normal).
