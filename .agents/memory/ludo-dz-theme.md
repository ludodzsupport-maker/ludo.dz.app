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
Phase 1 complete: colors verified against spec, selector wired in SettingsScreen.tsx (badge + button, both locales), board renders correctly (verified via flattened static-SVG rasterization since the artifact wasn't registered for live Screenshot — see artifact-preview-fallback.md). Classic/Neon untouched.

Phase 2 (decoration pass — corner star-lattice, center rosette, board-wide zellige overlay, safe-square crescent-and-star) complete same day, refined to a second pass after the first pass read as "bubbly"/unbalanced.

Phase 3 (2026-07-29): pawns + CornerDice (player/dice cards) restyled for DZ — onion-dome/lantern pawn silhouette (reuses Classic dome's base-pedestal footprint) with gold trim and star finial; CornerDice given a gold/brass frame, deep-green glass tinted per player, gold corner star accents, Cairo-font label (vs Rajdhani elsewhere). Of the components that render a "player card" in this file, only `CornerDice` is actually mounted on the board — `PlayerChip`/`ClassicScoreStrip` exist in the file but have zero call sites, so theming them would be dead work; confirm live call sites (not just component existence) before scoping a "restyle the player card" request here.

Phase 4 (2026-07-29): page background (the area outside/behind the board) restyled for DZ — deep emerald-black base, soft central gold spotlight, four faint per-corner colour blooms echoing each player's home colour under their dice card, and a whisper-faint gold diamond-lattice echoing the board's najma/zellige motif. DZ is now visually complete end-to-end (board, decoration, pawns, dice cards, page background) with zero remaining neon-styled elements.

**Two different "background" properties, don't conflate them:** the outer `motion.div` (screen root, holds the header/board/status-bar layout) sets its own `background` for the full-bleed page backdrop — this is "outside/behind the board." Separately, the board-frame `motion.div` that directly wraps `<BoardSVG>` has its *own* `background`/`border`, already `transparent`/`none` for both `isClassic` and `isDz` so the SVG's own drawn border shows through cleanly. A request to theme "the background" almost always means the first (page root), not the second (board frame) — check which one you're editing.

Re-verified same day after a "session ended before changes were pushed, UI shows old version" report: false alarm. All 4 Phase 2 elements were already present in GameBoardScreen.tsx AND already committed (`git status` clean) — nothing was lost. **This project's dev workflow (Vite) serves source directly with no separate build/push step**, so "is it live" only ever needs: `git status`/`grep` for the code, `tsc --noEmit` for correctness, and a workflow restart to clear any stale process — never a git push. Only real risks to "changes not showing" here are uncommitted-and-then-reverted edits, or browser-side HMR/cache staleness (hard refresh fixes that).

## Two-circle crescent + star: same-color shapes must not just avoid overlap, they need a visible gap
A crescent (circle minus circle) and a star drawn in the same gold fill will visually fuse into one blob wherever they're even close, since there's no stroke/seam between same-color shapes. Checking only "does the star's nearest vertex clear the crescent's horn-tip x-coordinate" is NOT sufficient — the crescent's cut-circle bulges further toward the star than the horn tips suggest. The reliable check: keep the star's bounding circle (center ± outer radius) entirely clear of the crescent's full *outer* circle (not just the visible sliver) plus a small margin; then confirm by rendering, not hand algebra alone. Hit this bug twice in the same session (center rosette + safe-square marker) with near-identical params, so it's a pattern to check first, not just at review time, whenever placing a star next to a crescent at any scale in this file.

## A single decorative stroke color across all 4 corners can silently fail on 2 of them
The Phase 2 corner star-lattice (`dz-corner-motif` pattern) used one stroke color (`BORDER_DEEP`, deep green) for all 4 home-zone corners. It read fine on Gold/Cream (WCAG contrast ~4.2/~8.1) but was nearly invisible on Blue/Terracotta (~1.6/~2.7) — `HOME_COLORS` spans a wide luminance range, so a decoration color tuned/eyeballed against one or two corners is not safe to assume for the others. Fixed (2026-07-29) by adding a second pattern (`dz-corner-motif-light`, stroked in `PATH_CREAM`) used only for player index 1 (Blue/TR) and 2 (Terracotta/BR), selected via a `motifId` ternary at the home-zone render site. **Why:** computing actual WCAG relative-luminance contrast per corner (not eyeballing one screenshot) is what caught this — cheap to do in a CodeExecution scratch calc before picking a replacement color. **How to apply:** any future full-board or per-corner decorative overlay in this file that uses one hardcoded stroke/fill color needs its contrast checked against all 4 `HOME_COLORS` individually, not just visually spot-checked on whichever corner is on screen.

## Decorative overlay rects must be drawn AFTER opaque content to actually be visible
`GameBoardScreen.tsx`'s DZ background/zellige-pattern rect was originally drawn once at the very start of the SVG (right after the base background fill), before home zones and path cells. Since the classic Ludo board's home+path+center cells fully tile the entire 15×15 grid with no gaps, and those cells all render at ~0.9-1.0 fill opacity, that early rect was 100% hidden — a "faint texture" that was actually rendering at 0% visible coverage. Any full-board decorative overlay in this file must be drawn in the pieces-adjacent layer near the end (after all cell rendering, before pieces), not in the early "Background" section, or it silently does nothing.
