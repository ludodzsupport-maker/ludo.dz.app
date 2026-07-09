---
name: Ludo DZ path-corner alignment
description: Why HOME_BASES corners must match MAIN_PATH start positions, and which player goes where.
---

## Rule
HOME_BASES, classifyCell home zones, HOME_COLS, and PLAYER_STARTS must all use the same corner assignment:
- Player 0 Red:    TOP-LEFT  — starts MAIN_PATH[0]=[6,1],   HOME_BASES rows 0-5  cols 0-5
- Player 1 Blue:   TOP-RIGHT — starts MAIN_PATH[13]=[1,8],  HOME_BASES rows 0-5  cols 9-14
- Player 2 Yellow: BOT-RIGHT — starts MAIN_PATH[26]=[8,13], HOME_BASES rows 9-14 cols 9-14
- Player 3 Green:  BOT-LEFT  — starts MAIN_PATH[39]=[13,6], HOME_BASES rows 9-14 cols 0-5

**Why:** The path start position determines which corner each player "belongs to". If HOME_BASES use a different corner assignment, pawns teleport visually (e.g., Red pawn exits bottom-left home but appears at top-left of the board). Was the bug in the original codebase.

**How to apply:** Any time HOME_BASES, classifyCell, or HOME_COLS are touched, verify all four are consistent with the above mapping. The MAIN_PATH and HOME_COLS themselves are correct and do not need changing.

## TRACK_SIZE / home-entry threshold
TRACK_SIZE = 51 (not 52). This means:
- relPos 0–50  → main track (MAIN_PATH indices 0–50 only; MAIN_PATH[51]=[6,0] is never visited)
- relPos 51    → HOME_COLS[player][0] (entry into home column)
- FINISHED_POS = 57 (= 51 + 6)

**Why:** With PLAYER_STARTS=[0,13,26,39], relPos 50 lands each player exactly on their axis-aligned star (e.g. Red→[7,0], Blue→[0,7]), giving a clean straight-line home entry. relPos 51 would land on [6,0] (Red) which is NOT axis-aligned, so TRACK_SIZE=51 skips that tile entirely and goes straight into HOME_COLS.

SAFE_SET uses absolute MAIN_PATH indices: {0, 11, 13, 24, 26, 37, 39, 50} — player starts + mid-path stars.
