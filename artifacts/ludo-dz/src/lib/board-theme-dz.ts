// ─── DZ board theme — Phase 1: structure + base colors only ──────────────────
// Algerian-inspired palette. No patterns/decorations yet, and no theme-selector
// wiring yet — BoardStyle in App.tsx only exposes this as a value, GameBoardScreen's
// `isDz` branches render it, nothing lets a player pick it in the UI yet.
//
// Player index → corner mapping matches the existing engine corner assignment
// (see classifyCell() in GameBoardScreen.tsx): 0=Red/TL, 1=Blue/TR, 2=Yellow/BR, 3=Green/BL.
// The design spec labels these "Player 1..4" in that same positional order.

export const BOARD_BG = '#006233'; // deep Algerian green — overall board background

export const HOME_COLORS = [
  '#D4A017', // Player 1 (index 0, TL corner) — saffron gold
  '#006994', // Player 2 (index 1, TR corner) — Mediterranean blue
  '#C2703A', // Player 3 (index 2, BR corner) — Saharan terracotta
  '#F5E6C8', // Player 4 (index 3, BL corner) — ivory cream
] as const;

export const PATH_CREAM = '#FDF3E3'; // warm cream — neutral path cells

// "Path colored strips" = the per-player home-column lane (the codebase's
// `homecol` cell kind — the only lane that's actually colored in Classic/Neon
// too; the `strip` cell kind stays neutral in all themes, same as `path`).
// Reuses the same 4 Algerian colors as the home bases.
export const STRIP_COLORS = HOME_COLORS;

export const BORDER_DEEP = '#004d26'; // deep green board border
export const BORDER_GOLD = '#C9A227'; // thin gold accent line on the border

export const CENTER_GOLD = '#C9A227'; // center area — flat gold field
