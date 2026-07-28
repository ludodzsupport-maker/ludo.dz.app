---
name: Ludo DZ "DZ" board theme (Algerian palette) rollout status
description: Phase boundaries, wiring pattern, and gotchas for the third board theme (board-theme-dz.ts) alongside Classic/Neon.
---

## Wiring pattern for a new `boardStyle` variant
`BoardStyle` (App.tsx) is a plain union type; adding a value doesn't auto-expose it. Three independent places must all agree before a theme is player-reachable:
1. Color constants file (`lib/board-theme-dz.ts` for DZ) — pure data, no JSX.
2. Rendering branches in `GameBoardScreen.tsx` (`isDz`/`isClassic` conditionals scattered through the SVG) — this can be fully built while still unreachable by players.
3. The picker UI in `SettingsScreen.tsx` (badge ternary + a button per option, all wired to `setBoardStyle`) — this is what actually makes it reachable. A theme can be 100% rendered and still invisible to users if this step is skipped.

Check all three independently before assuming a theme is "done" or "not started" — they can be at different completion stages (seen firsthand: DZ had #1 and #2 fully built, #3 untouched).

## Phase 1 scope (base colors/layout only)
DZ Phase 1 intentionally omits: star/safe-cell decoration (`if (isDz) return null`), center triangles (flat gold field instead), and any CornerDice (dice panel) theming — DZ falls through to the neon-style default for dice panels since `CornerDice`/`PlayerChip` only branch on `isClassic`, never `isDz`. That's expected for Phase 1, not a bug — don't "fix" it without confirming a later phase actually calls for it.

## Corner-label gotcha
The engine's corner assignment is fixed: player index 0=TL, 1=TR, 2=BR, 3=BL (see ludo-path-corners.md). Specs/briefs describing colors as "Player 3 (bottom-left)" etc. sometimes use reading-order corner names (TL,TR,BL,BR) instead of the engine's actual clockwise order (TL,TR,BR,BL) — a prose mismatch, not a color error. What matters is the color value at each player *index*; verify against classifyCell's home-zone assignment, not the English corner name in the request.

## Status as of 2026-07-28
Phase 1 complete: colors verified against spec, selector wired in SettingsScreen.tsx (badge + button, both locales), board renders correctly (verified via flattened static-SVG rasterization since the artifact wasn't registered for live Screenshot — see artifact-preview-fallback.md). Classic/Neon untouched. Next phases (if requested): decoration/ornamentation pass, CornerDice DZ styling.
