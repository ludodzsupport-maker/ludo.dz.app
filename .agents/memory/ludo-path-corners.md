---
name: Ludo DZ path-corner alignment
description: Why HOME_BASES corners must match MAIN_PATH start positions, and which player goes where.
---

## Corner assignment
HOME_BASES, classifyCell home zones, HOME_COLS, and PLAYER_STARTS must all use the same corner assignment:
- Player 0 Red:    TOP-LEFT  — starts MAIN_PATH[0]=[6,1],   HOME_BASES rows 0-5  cols 0-5
- Player 1 Blue:   TOP-RIGHT — starts MAIN_PATH[13]=[1,8],  HOME_BASES rows 0-5  cols 9-14
- Player 2 Yellow: BOT-RIGHT — starts MAIN_PATH[26]=[8,13], HOME_BASES rows 9-14 cols 9-14
- Player 3 Green:  BOT-LEFT  — starts MAIN_PATH[39]=[13,6], HOME_BASES rows 9-14 cols 0-5

**Why:** The path start position determines which corner each player "belongs to". If HOME_BASES use a different corner assignment, pawns teleport visually (e.g., Red pawn exits bottom-left home but appears at top-left of the board). Was the bug in the original codebase.

**How to apply:** Any time HOME_BASES, classifyCell, or HOME_COLS are touched, verify all four are consistent with the above mapping.

## TRACK_SIZE vs MAIN_PATH_SIZE — CRITICAL DISTINCTION

MAIN_PATH has 52 entries (indices 0–51). Two separate constants govern path logic:

- `MAIN_PATH_SIZE = 52` — used as the modulo in ALL abs-position calculations:
  `abs = (PLAYER_STARTS[player] + relPos) % MAIN_PATH_SIZE`
- `TRACK_SIZE = 51` — the home-entry threshold: relPos ≥ 51 → HOME_COLS
- `FINISHED_POS = 57` (= 51 + 6)

**Why two constants:** With PLAYER_STARTS=[0,13,26,39] and the home-entry threshold at 51, each player's relPos 50 must land on their axis-aligned star square (abs 50, 11, 24, 37 respectively). This only works if the modulo is 52 (full path). Using TRACK_SIZE=51 as the modulo shifts Blue/Yellow/Green one step off their star and breaks home entry alignment.

**How to apply:** Every `(PLAYER_STARTS[p] + relPos) % X` must use `% MAIN_PATH_SIZE` (52). The `< TRACK_SIZE` and `>= TRACK_SIZE` comparisons on relPos are correct as-is (they gate home-col vs main-track).

## Star alignment at home entry (relPos 50, mod 52)
- Red    (start=0):  (0+50)%52 = 50 → MAIN_PATH[50]=[7,0]  → HOME_COLS[0][0]=[7,1]  (same row 7) ✓
- Blue   (start=13): (13+50)%52 = 11 → MAIN_PATH[11]=[0,7]  → HOME_COLS[1][0]=[1,7]  (same col 7) ✓
- Yellow (start=26): (26+50)%52 = 24 → MAIN_PATH[24]=[7,14] → HOME_COLS[2][0]=[7,13] (same row 7) ✓
- Green  (start=39): (39+50)%52 = 37 → MAIN_PATH[37]=[14,7] → HOME_COLS[3][0]=[13,7] (same col 7) ✓

SAFE_SET = {0, 11, 13, 24, 26, 37, 39, 50} — player starts + mid-path stars (absolute MAIN_PATH indices).
