---
name: Ludo DZ path-corner alignment
description: Why HOME_BASES corners must match MAIN_PATH start positions, and which player goes where.
---

## Rule
HOME_BASES, classifyCell home zones, HOME_COLS, and PLAYER_STARTS must all use the same corner assignment:
- Player 0 Red:    TOP-LEFT  — starts MAIN_PATH[0]=[6,1],  HOME_BASES rows 0-5  cols 0-5
- Player 1 Blue:   TOP-RIGHT — starts MAIN_PATH[13]=[1,8], HOME_BASES rows 0-5  cols 9-14
- Player 2 Yellow: BOT-RIGHT — starts MAIN_PATH[26]=[8,13],HOME_BASES rows 9-14 cols 9-14
- Player 3 Green:  BOT-LEFT  — starts MAIN_PATH[39]=[13,6],HOME_BASES rows 9-14 cols 0-5

**Why:** The path start position determines which corner each player "belongs to". If HOME_BASES use a different corner assignment, pawns teleport visually (e.g., Red pawn exits bottom-left home but appears at top-left of the board). Was the bug in the original codebase.

**How to apply:** Any time HOME_BASES, classifyCell, or HOME_COLS are touched, verify all four are consistent with the above mapping. The MAIN_PATH and HOME_COLS themselves are correct and do not need changing.
