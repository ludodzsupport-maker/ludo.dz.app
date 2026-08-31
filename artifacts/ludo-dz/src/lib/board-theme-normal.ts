// ─── Normal board theme — flat, simple, high-contrast "standard Ludo" skin ──
// This theme is deliberately the opposite of Classic / DZ / Neon: solid flat
// fills only, no gradients, no texture/pattern overlays, no gloss or ornaments.
//
// Player index → corner mapping matches the existing engine corner assignment
// (see classifyCell() in GameBoardScreen.tsx): 0=Red/TL, 1=Blue/TR, 2=Yellow/BR,
// 3=Green/BL — the same layout the user confirmed for this theme.
//
// Colours were confirmed with the user: fully saturated standard Ludo hues.

export const HOME_COLORS = [
  '#E53935', // Player 1 (index 0, TL corner) — pure red
  '#1E88E5', // Player 2 (index 1, TR corner) — pure blue
  '#FDD835', // Player 3 (index 2, BR corner) — pure yellow
  '#43A047', // Player 4 (index 3, BL corner) — pure green
] as const;

// Neutral white path background — the whole cross-shaped track reads as a
// plain white board, exactly like a standard printed Ludo board.
export const PATH_WHITE = '#FFFFFF';

// Per-player home-column lane ("homecol" cells) — reuses the same 4 flat
// colours as the home bases, matching the existing theme convention.
export const STRIP_COLORS = HOME_COLORS;

// Flat hairline between neutral path/strip cells (light grey, high contrast
// against white without reading as an ornament).
export const PATH_HAIRLINE = 'rgba(0, 0, 0, 0.14)';

// Flat board border.
export const BORDER_DARK = '#333333';

// ─── Dice-card tokens ────────────────────────────────────────────────────────
// Two-tone flat card (confirmed with the user): a medium/mid blue outer frame
// and a lighter dusty pink/mauve panel in the centre where the dice face sits.
// The panel is deliberately light so the blue frame reads as a clearly
// distinct outer tone on every card, active or not.
export const DICE_FRAME = '#4472C4'; // medium blue outer frame
export const DICE_PANEL = '#F0D8E0'; // light dusty pink/mauve centre panel
export const DICE_INK   = '#3A3A3A'; // dark pips / label ink on the card

// Directional-arrow ink for each player's start square. Red / blue / green are
// dark enough for a white arrow; yellow needs a dark arrow for contrast.
export const ARROW_INKS = [
  '#FFFFFF', // Red   — white arrow
  '#FFFFFF', // Blue  — white arrow
  '#5A4A00', // Yellow — dark arrow
  '#FFFFFF', // Green — white arrow
] as const;

// Flat safe-square star marker (neutral dark grey so it reads on white cells
// without being mistaken for a player colour).
export const STAR_INK = '#4A4A4A';
