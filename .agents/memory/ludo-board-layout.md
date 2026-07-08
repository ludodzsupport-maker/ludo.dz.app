---
name: Ludo DZ board layout
description: Current board layout architecture — corner dice panels, board frame sizing, and critical rendering rules for the CornerDice component.
---

## Current layout (post-overhaul)

**`DicePanel` (52px side columns) was removed.** The board frame now fills the full game-area width.

**`CornerDice`** is the replacement: one panel per player, absolutely positioned at the corners of the board frame (Red=TL, Blue=TR, Yellow=BR, Green=BL). Keyed by `Corner = 'tl'|'tr'|'br'|'bl'`.

### Board frame
```
game area: relative, flex-1, min-h-0, flex items-center justify-center, padding: 6px 8px
board frame (motion.div): position:relative, width:100%, aspectRatio:1, maxHeight:calc(100%-4px), overflow:VISIBLE, padding:6px
inner felt (div): width:100%, height:100%, overflow:hidden → contains BoardSVG
```

`overflow: visible` on the board frame lets CornerDice panels render outside the frame rect without the parent clipping them.

### CornerDice positioning
`CORNER_POS` uses **negative offsets** (`top: -6, left: -6` etc.) so panels sit just outside the board frame corners, framing the corner without being fully inside the board SVG area.

### Critical rendering rules

1. **`pointerEvents: isActive ? 'auto' : 'none'`** — inactive panels MUST not block board clicks on home-zone piece slots below them. HOME_BASES piece slots at SVG col/row 1.5 land at ~43px from the board frame edge; the 72px panel extends to ~66px, overlapping those slots. Without `pointerEvents:none`, covered pieces are unclickable.

2. **`backdropFilter: isActive ? 'blur(10px)' : 'none'`** — backdrop blur on inactive panels blurs the board SVG content showing through them. Must be disabled for inactive panels.

3. **Inactive background opacity** — `rgba(4,12,26,0.42)` (not 0.82) so home pieces are visually visible through the panel. At 0.82 opacity, the pieces behind were hidden.

4. **Board `boxShadow` animation** — 2.6s Framer Motion loop cycling between dim and bright phases. Screenshots may capture either phase; this is expected animation behavior, not a bug.

### HOME_BASES piece slot positions (from ludo-engine.ts)
- Red   TL: [1,1],[1,4],[4,1],[4,4]  → cols 1.5 and 4.5 SVG units from left
- Blue  TR: [1,10],[1,13],[4,10],[4,13]
- Yellow BR: [10,10],[10,13],[13,10],[13,13]
- Green BL: [10,1],[10,4],[13,1],[13,4]

On a ~370px board: SVG unit ≈ 24.5px → col 1.5 slot at ≈43px from board frame left (inside the 72px panel reach). This is a known geometric overlap inherent to a full-width board with 72px corner panels.

**Why:** The old 52px side columns consumed horizontal space and made the board smaller (~276px). Removing them lets the board fill ~374px of available width. The geometric tradeoff is that corner panels now sit over the innermost home-zone piece slot — mitigated by the transparency + pointer-events rules above.
