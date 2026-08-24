// ─── Animation speed — continuous slider model ─────────────────────────────
// Replaces the former three-mode preset system (Lent / Normal / Rapide).
// Two independent 0–100 sliders — dice-roll speed and pawn-movement speed —
// each interpolate linearly between the former Slow (slider 0) and Fast
// (slider 100) preset values, so the extremes behave exactly like the old
// presets did:
//   slow: { cycles:16, baseMs:80, stepMs:42 | stiffness:180, damping:22, mass:1.20, hopMs:240 }
//   fast: { cycles: 8, baseMs:32, stepMs:15 | stiffness:520, damping:32, mass:0.60, hopMs: 90 }
// Values in between are new continuous territory; the old Normal preset sat
// at ≈65 on this scale (LEGACY_SPEED_NORMAL below).

export const SPEED_MIN  = 0;
export const SPEED_MAX  = 100;
export const SPEED_STEP = 5;

// Default slider position: slightly faster than the old Normal preset
// (≈1222 ms → ≈943 ms dice roll, 150 ms → 135 ms hops) without jumping all
// the way to the old Rapide feel (≈481 ms / 90 ms).
export const DEFAULT_SPEED = 70;

// Where each retired mode lands on the new 0–100 scale. Old Slow/Fast map to
// their exact former anchor values; old Normal maps to its interpolated seat
// so upgraded users keep the pace they had.
export const LEGACY_SPEED_SLOW   = SPEED_MIN;
export const LEGACY_SPEED_NORMAL = 65;
export const LEGACY_SPEED_FAST   = SPEED_MAX;

/** The retired three-mode setting, as stored in pre-slider saved games. */
export type LegacyAnimSpeed = 'fast' | 'normal' | 'slow';

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEED;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

/** Map a saved legacy mode to its slider value. Returns null when absent. */
export function migrateLegacyAnimSpeed(legacy: LegacyAnimSpeed | undefined | null): number | null {
  if (legacy === 'slow')   return LEGACY_SPEED_SLOW;
  if (legacy === 'normal') return LEGACY_SPEED_NORMAL;
  if (legacy === 'fast')   return LEGACY_SPEED_FAST;
  return null;
}

/**
 * Resolve the slider value for a loaded save: prefer the save's own slider
 * value, fall back to the migrated legacy mode, then the default. Never
 * throws — out-of-range numbers are clamped, garbage falls back safely.
 */
export function resolveSpeedSlider(preferred: number | undefined, legacy: LegacyAnimSpeed | undefined): number {
  if (typeof preferred === 'number') return clampSpeed(preferred);
  const migrated = migrateLegacyAnimSpeed(legacy);
  return migrated === null ? DEFAULT_SPEED : migrated;
}

// ── Timing curves ───────────────────────────────────────────────────────────
export interface DiceTiming { cycles: number; baseMs: number; stepMs: number }
export interface PawnTiming { stiffness: number; damping: number; mass: number; hopMs: number }

// Former ANIM anchors (retired presets), kept verbatim as interpolation ends.
const DICE_SLOW: DiceTiming = { cycles: 16, baseMs: 80, stepMs: 42 };
const DICE_FAST: DiceTiming = { cycles: 8,  baseMs: 32, stepMs: 15 };
const PAWN_SLOW: PawnTiming = { stiffness: 180, damping: 22, mass: 1.20, hopMs: 240 };
const PAWN_FAST: PawnTiming = { stiffness: 520, damping: 32, mass: 0.60, hopMs:  90 };

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Dice tumble timing for a 0–100 dice-roll speed slider value. */
export function diceTimingFor(speed: number): DiceTiming {
  const t = clampSpeed(speed) / SPEED_MAX;
  return {
    cycles: Math.round(lerp(DICE_SLOW.cycles, DICE_FAST.cycles, t)),
    baseMs:  Math.round(lerp(DICE_SLOW.baseMs,  DICE_FAST.baseMs,  t)),
    stepMs:  Math.round(lerp(DICE_SLOW.stepMs,  DICE_FAST.stepMs,  t)),
  };
}

/** Pawn hop physics for a 0–100 pawn-movement speed slider value. */
export function pawnTimingFor(speed: number): PawnTiming {
  const t = clampSpeed(speed) / SPEED_MAX;
  return {
    stiffness: Math.round(lerp(PAWN_SLOW.stiffness, PAWN_FAST.stiffness, t)),
    damping:   Math.round(lerp(PAWN_SLOW.damping,   PAWN_FAST.damping,   t)),
    mass:      Math.round(lerp(PAWN_SLOW.mass,      PAWN_FAST.mass,      t) * 100) / 100,
    hopMs:     Math.round(lerp(PAWN_SLOW.hopMs,     PAWN_FAST.hopMs,     t)),
  };
}
