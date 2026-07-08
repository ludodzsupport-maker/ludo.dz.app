---
name: Ludo DZ board layout
description: Final board layout decisions — side dice columns, color-lane rules, animation speed.
---

## Layout
Board SVG is flanked by two 52px dice columns in a flex-row:
- Left col: player 0 (Red, top-half) + player 3 (Green, bottom-half)
- Right col: player 1 (Blue, top-half) + player 2 (Yellow, bottom-half)
Each DicePanel section has the accent border on the board-facing side.

## Color lane rule
Only `homecol` cells (the TRUE middle row/col of each arm) receive player color.
`strip` cells (outer rows of each arm, where pieces first enter the board) render neutral dark (#0d1f38).
This gives clean high-contrast look: colored lane only visible in the home-column approach.

## Animation speed
Three presets wired to `ANIM` constant: fast/normal/slow.
Each preset controls: roll cycle count, base/step delay for deceleration curve, and piece spring stiffness/damping/mass.
The `animSpeed` state feeds into `handleRoll` timing AND `springCfg` passed to `BoardSVG`.

**Why:** User explicitly requested animation speed control as a settings feature.
