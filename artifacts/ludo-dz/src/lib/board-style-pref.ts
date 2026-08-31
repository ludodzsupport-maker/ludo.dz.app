import type { BoardStyle } from '../App';

// ─── Board-style preference — the single source of truth for the board skin ──
//
// The BoardStyle the player picked (Settings sheet or the pre-match config
// sheet) is persisted under its own localStorage key, following the same
// pattern as the sound / BGM / haptics managers. App state is seeded from
// here at boot and every explicit pick writes straight back, so the theme
// survives restarts and stays in sync no matter which surface changed it.
//
// The app default for a fresh install (no stored preference) is 'normal'.

export const BOARD_STYLE_STORAGE_KEY = 'ludo-dz:board-style';

export const DEFAULT_BOARD_STYLE: BoardStyle = 'normal';

/** All board styles, in the order the pickers present them (Settings + pre-match switcher). */
export const BOARD_STYLES: readonly BoardStyle[] = ['neon', 'classic', 'dz', 'normal'];

export function isBoardStyle(value: unknown): value is BoardStyle {
  return typeof value === 'string' && (BOARD_STYLES as readonly string[]).includes(value);
}

/**
 * Read the stored board style. Returns null when nothing (or something
 * invalid) is stored, so the caller can fall back to DEFAULT_BOARD_STYLE.
 */
export function readStoredBoardStyle(): BoardStyle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOARD_STYLE_STORAGE_KEY);
    if (!raw) return null;
    if (!isBoardStyle(raw)) {
      console.warn('[board-style] invalid stored value discarded', { key: BOARD_STYLE_STORAGE_KEY, raw });
      return null;
    }
    return raw;
  } catch (error) {
    console.warn('[board-style] read failed', { key: BOARD_STYLE_STORAGE_KEY, error });
    return null;
  }
}

/** Persist a board-style pick. Failures are logged and ignored (private mode, quota…). */
export function writeStoredBoardStyle(style: BoardStyle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOARD_STYLE_STORAGE_KEY, style);
  } catch (error) {
    console.warn('[board-style] write failed', { key: BOARD_STYLE_STORAGE_KEY, style, error });
  }
}
