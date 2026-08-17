import type { BoardStyle } from '../App';
import type { GameConfig } from '../components/GameConfigOverlay';
import type { GameState } from './ludo-engine';

export const SAVED_GAME_STORAGE_KEY = 'ludo-dz:saved-game';
export const SAVED_GAME_VERSION = 1 as const;

export interface SavedGameSnapshot {
  version: typeof SAVED_GAME_VERSION;
  savedAt: string;
  config: GameConfig;
  boardStyle?: BoardStyle;
  game: GameState;
  lastDice: number[];
  animSpeed: 'fast' | 'normal' | 'slow';
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
    && value.players <= 4;
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
  if (value.boardStyle !== undefined && value.boardStyle !== 'neon' && value.boardStyle !== 'classic' && value.boardStyle !== 'dz') return null;
  if (!Array.isArray(value.lastDice) || !value.lastDice.every(die => Number.isInteger(die))) return null;
  if (value.animSpeed !== 'fast' && value.animSpeed !== 'normal' && value.animSpeed !== 'slow') return null;
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
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const snapshot = validateSavedGameSnapshot(parsed);
    if (!snapshot) {
      clearSavedGame();
      return null;
    }
    return snapshot;
  } catch {
    clearSavedGame();
    return null;
  }
}

export function writeSavedGame(snapshot: SavedGameSnapshot): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVED_GAME_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSavedGame(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVED_GAME_STORAGE_KEY);
}
