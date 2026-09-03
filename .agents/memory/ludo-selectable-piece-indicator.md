---
name: Ludo DZ selectable-piece indicator ("Ready lift", v2)
description: The per-theme selectable-piece marker for Classic/DZ/Neon — one behaviour, three visual languages — plus the measured cost that forced the marker motion to be a one-shot entrance.
---

# Selectable-piece indicator (Classic / DZ / Neon)

Replaced the old glow family (breathing halo, Neon pulse + `pglow` filter, per-cell
tile wash). **Normal is untouched**: its pin ring and its `movableHighlights` tile
wash keep their exact previous behaviour (`ready = isMovable && !isNormal`, and
`movableHighlights` returns `[]` unless `isNormal`).

## The design: one behaviour, three languages

Behaviour (shared): the piece rises (`READY_LIFT -0.125`, `scale 1.06`, spring),
leaves a ground marker behind it, and its contact shadow broadens ×1.10 and
lightens to 0.72. Elevation is the only state channel nothing else on the board
touches — capture echoes, threat beacons, escape puffs, safe-star badges and the
Neon bloom are all glows, and a wash on the cell cannot say *which* pawn it means
when two share a cell.

| Theme | Ground marker | Extra material cue |
|---|---|---|
| Classic | brass double inlay: outer ellipse (`baseRX+0.092`, sw 0.024) + inner (`baseRX+0.040`, sw 0.014, 45% opacity) | warm specular catch-light arc on the dome (`arcPath(0, domeCY, domeR-0.014, 152°, 214°)`, `#FFF6DE`), inside the lift group |
| DZ | gold **khatem** — `starPoints(0, dzBaseCY+0.01, r, r*0.62, 8)`, `DZ.BORDER_GOLD`, sw 0.026 | turns −30° → 0° over 0.55s as it appears |
| Neon | **HUD target-lock brackets** — `bracketPath(±(HR+0.115), -(HR+0.075), HR+0.095, 0.10)`, `neon`, sw 0.030, butt caps | snaps 1.18 → 1 over 0.22s |

## Why the marker motion is a one-shot entrance

The full lift breath is the only loop on a selectable pawn. An endless second loop
on the marker (a continuously rotating DZ star, a breathing Neon reticle) measured
**~1ms more per frame** on both themes in this software-rasterized sandbox:

| p50 frame-time delta, marker on vs. off | previous impl | with 2 loops | shipped (one-shot) |
|---|---|---|---|
| Classic | +0.3ms | +0.2ms | **+0.2ms** |
| DZ | +0.4ms | +1.3ms | **+0.4ms** |
| Neon | −0.5ms | +0.7ms | **+0.2ms** |

One-shot entrances keep the per-theme motion signature (the star turns into its
seat, the reticle snaps shut) at the cost of the previous implementation. Reduced
motion skips both entrances and the breath; the raised position still carries the
state.

## Wiring (do not break)

- Nesting: outer `motion.g` (tile x/y) → stack-scale `motion.g` (`scaleCtrl`) →
  arc `motion.g` (`arcCtrl`) → **lift `motion.g` (`liftCtrl`)** → theme bodies.
  The ground marker sits inside the arc group but **outside** the lift group.
- `ready` gates marker + lift + catch-light + shadow; the lift effect is
  stale-guarded and `liftCtrl.stop()` is in the unmount cleanup.
- Everything is stroke-only geometry with transform-only motion: no filters, no
  per-cell wash, no opacity loops.
- Helpers live next to `starPoints`: `arcPath()` and `bracketPath()`.

## Verification recipe

See `sandbox-headless-chromium.md` for the browser. Seed a v1 saved game, resume,
roll, then count markers per theme: `ellipse[stroke-width="0.024"]` (Classic),
`polygon[stroke-width="0.026"]` (DZ, scoped inside the pawn group — the board has
other gold polygons), `path[stroke-width="0.030"]` (Neon). Expect 4 marked /
4 lifted / 0 mismatches on all three, and 0 lifted with an unchanged shadow
(rx 0.30, opacity 1) on Normal. Framer Motion can stall ~2s in this sandbox —
sample for ≥6s before concluding anything is broken.
