// ─── DZ board theme — Algerian palette + decorative pass ─────────────────────
// Phase 1 (base colors/layout) is complete and selectable in Settings.
// Phase 2 (this pass) layers on ornamentation: crescent-and-star safe-square
// markers, a rosette + crescent-and-star center medallion, a faint star-lattice
// texture on the home corners, a faint zellige tracery on the board felt, and a
// warm hairline between neutral cells.
// Phase 3 (readability pass): the four house colours are re-spaced for clear
// quadrant differentiation, the corner/felt tracery is pulled back to engraving
// strength so pieces sit cleanly on top of it, and each home base gains its own
// ornament set (vignette, keyline frames, finials and a mini crescent crest)
// built from the same motifs below — see HOME_COLORS and the DZ home-zone
// block in GameBoardScreen.
//
// Player index → corner mapping matches the existing engine corner assignment
// (see classifyCell() in GameBoardScreen.tsx): 0=Red/TL, 1=Blue/TR, 2=Yellow/BR, 3=Green/BL.
// The design spec labels these "Player 1..4" in that same positional order.

export const BOARD_BG = '#006233'; // deep Algerian green — overall board background

// Phase 3 (contrast pass): the four house colours are now spread across the
// dial so no two corners read as siblings during play. The old trio gold
// #D4A017 / terracotta #C2703A / ivory #F5E6C8 sat within ~18° of hue of each
// other, and ivory sat within a few % of the neutral path cream — the board
// read as "warm, warm, warm, blue". Gold is now a purer saffron (less orange),
// terracotta is now a deep henna brown (enough hue distance AND a clear
// lightness step below gold), and cream is a warm sand (a real plateau below
// the near-white path cells). Blue already stood alone and is unchanged.
export const HOME_COLORS = [
  '#E0A300', // Player 1 (index 0, TL corner) — pure saffron yellow
  '#006994', // Player 2 (index 1, TR corner) — Mediterranean blue
  '#8A4A28', // Player 3 (index 2, BR corner) — deep henna brown
  '#E8D4A6', // Player 4 (index 3, BL corner) — warm sand cream
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

// ─── Phase 2 decorative tokens ────────────────────────────────────────────────
export const PATH_HAIRLINE = 'rgba(0, 77, 38, 0.35)'; // deep-green hairline between neutral path/strip cells

// Gate and victory-lane accents stay in each player's palette, but are lifted
// above the lane/base fill so the framing remains legible at board scale.
export const PLAYER_ACCENT_COLORS = [
  '#F6CF58', // saffron gold
  '#55BDE0', // Mediterranean blue
  '#E4A574', // sun-warmed clay (lifts above henna brown)
  '#FFF8E8', // ivory cream (lifts above sand cream)
] as const;

// DZ home-lane keylines are tuned separately from the player fills. The dark
// line defines the lane edge while the lighter companion line carries the fine
// zellige detail, preserving contrast for every one of the four palettes.
// Phase 3: the brown keyline deepened in step with the new henna base.
export const PLAYER_LANE_KEYLINE_COLORS = [
  '#7D5700', // rich brass against saffron
  '#004A69', // deep Atlantic blue against Mediterranean blue
  '#5A2C14', // dark mahogany against henna brown
  '#7A6035', // warm umber against sand cream
] as const;

export const PLAYER_LANE_HIGHLIGHT_COLORS = [
  '#FFE49A', // gilt highlight
  '#9EDFF2', // pale sea-glass highlight
  '#F3C296', // sun-warmed clay highlight
  '#FFF9E9', // porcelain highlight
] as const;

// High-contrast ink for the directional gate mark and its small crescent-star.
// Cream/gold need deep green; blue/terracotta need warm ivory.
export const PLAYER_GATE_INKS = [
  BORDER_DEEP,
  PATH_CREAM,
  PATH_CREAM,
  BORDER_DEEP,
] as const;
