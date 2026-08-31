import type { BoardStyle } from '../App';
import type { GameConfig } from '../components/GameConfigOverlay';
import type { GameState } from './ludo-engine';
import { SPEED_MIN, SPEED_MAX, type LegacyAnimSpeed } from './anim-speed';

export const SAVED_GAME_STORAGE_KEY = 'ludo-dz:saved-game';
export const SAVED_GAME_VERSION = 1 as const;

export interface SavedGameSnapshot {
  version: typeof SAVED_GAME_VERSION;
  savedAt: string;
  config: GameConfig;
  boardStyle?: BoardStyle;
  game: GameState;
  lastDice: number[];
  /**
   * Legacy three-mode animation speed from pre-slider builds. Read-only:
   * migrated to speedDice/speedPawns on load (see lib/anim-speed), never
   * written anymore. Kept optional so pre-slider saves still validate.
   */
  animSpeed?: LegacyAnimSpeed;
  /** Continuous dice-roll speed slider (0–100). Absent in pre-slider saves. */
  speedDice?: number;
  /** Continuous pawn-movement speed slider (0–100). Absent in pre-slider saves. */
  speedPawns?: number;
  stats: {
    moveCount: number;
    captureCounts: number[];
    matchDurationMs: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidGameConfig(value: unknown): value is GameConfig {
  if (!isRecord(value)) return false;
  return (value.rule === 'classic' || value.rule === 'quick' || value.rule === 'teamup')
    && typeof value.modeId === 'string'
    && typeof value.players === 'number'
    && Number.isInteger(value.players)
    && value.players >= 2
    && value.players <= 4
    && (value.humanColor === undefined || (typeof value.humanColor === 'number' && Number.isInteger(value.humanColor) && value.humanColor >= 0 && value.humanColor <= 3))
    && (value.excludedColor === undefined || (typeof value.excludedColor === 'number' && Number.isInteger(value.excludedColor) && value.excludedColor >= 0 && value.excludedColor <= 3));
}

function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.pieces) || !Array.isArray(value.playerSlots) || !Array.isArray(value.movable)) return false;
  return Number.isInteger(value.activePlayer)
    && Number.isInteger(value.numPlayers)
    && Number.isInteger(value.dice)
    && typeof value.diceRolled === 'boolean'
    && (value.winner === null || Number.isInteger(value.winner))
    && (value.phase === 'rolling' || value.phase === 'selecting' || value.phase === 'done')
    && Number.isInteger(value.consecutiveSixes)
    && typeof value.lastCapture === 'boolean'
    && typeof value.message === 'string'
    && value.pieces.every(piece => isRecord(piece)
      && Number.isInteger(piece.player)
      && Number.isInteger(piece.index)
      && Number.isInteger(piece.relPos))
    && value.playerSlots.every(slot => Number.isInteger(slot))
    && value.movable.every(id => typeof id === 'string');
}

export function validateSavedGameSnapshot(value: unknown): SavedGameSnapshot | null {
  if (!isRecord(value)) return null;
  if (value.version !== SAVED_GAME_VERSION) return null;
  if (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) return null;
  if (!isValidGameConfig(value.config) || !isValidGameState(value.game)) return null;
  if (value.boardStyle !== undefined && value.boardStyle !== 'neon' && value.boardStyle !== 'classic' && value.boardStyle !== 'dz' && value.boardStyle !== 'normal') return null;
  if (!Array.isArray(value.lastDice) || !value.lastDice.every(die => Number.isInteger(die))) return null;
  // Speed fields: accept the new continuous sliders (0–100), the retired
  // three-mode animSpeed (migrated on load), or neither (defaults) — but
  // never garbage. This is what lets an old Lent/Normal/Rapide save upgrade
  // in place instead of being discarded.
  const isValidSlider = (v: unknown): boolean =>
    typeof v === 'number' && Number.isFinite(v) && v >= SPEED_MIN && v <= SPEED_MAX;
  if (value.animSpeed !== undefined && value.animSpeed !== 'fast' && value.animSpeed !== 'normal' && value.animSpeed !== 'slow') return null;
  if (value.speedDice !== undefined && !isValidSlider(value.speedDice)) return null;
  if (value.speedPawns !== undefined && !isValidSlider(value.speedPawns)) return null;
  if (!isRecord(value.stats)
    || typeof value.stats.matchDurationMs !== 'number'
    || !Number.isFinite(value.stats.matchDurationMs)
    || !Number.isInteger(value.stats.moveCount)
    || !Array.isArray(value.stats.captureCounts)
    || !value.stats.captureCounts.every(count => Number.isInteger(count))) return null;
  return value as unknown as SavedGameSnapshot;
}

export function readSavedGame(): SavedGameSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SAVED_GAME_STORAGE_KEY);
  console.info('[saved-game] startup check', { key: SAVED_GAME_STORAGE_KEY, found: Boolean(raw) });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const snapshot = validateSavedGameSnapshot(parsed);
    if (!snapshot) {
      console.warn('[saved-game] invalid snapshot discarded', { key: SAVED_GAME_STORAGE_KEY });
      clearSavedGame();
      return null;
    }
    console.info('[saved-game] valid snapshot loaded', { key: SAVED_GAME_STORAGE_KEY, savedAt: snapshot.savedAt });
    return snapshot;
  } catch (error) {
    console.warn('[saved-game] unreadable snapshot discarded', { key: SAVED_GAME_STORAGE_KEY, error });
    clearSavedGame();
    return null;
  }
}

export function writeSavedGame(snapshot: SavedGameSnapshot): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(SAVED_GAME_STORAGE_KEY, JSON.stringify(snapshot));
    console.info('[saved-game] snapshot written', { key: SAVED_GAME_STORAGE_KEY, savedAt: snapshot.savedAt });
    return true;
  } catch (error) {
    console.error('[saved-game] snapshot write failed', { key: SAVED_GAME_STORAGE_KEY, error });
    return false;
  }
}

export function clearSavedGame(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
  console.info('[saved-game] snapshot cleared', { key: SAVED_GAME_STORAGE_KEY });
}
