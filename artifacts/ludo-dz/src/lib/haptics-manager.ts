// ─── Haptics (Vibration) Manager ────────────────────────────────────────────
// Small, self-contained trigger system for tactile feedback, mirroring the
// "Sound Effects" / "Background Music" pattern in sound-manager.ts: its own
// persisted toggle, its own storage key, completely independent of audio.
//
// Every trigger goes through `fireVibration`, which is the single place that
// gates playback on the "Vibrations" setting and feature-detects
// `navigator.vibrate` — so new triggers automatically respect both, and
// desktop browsers / iOS Safari (neither expose the Vibration API) simply
// no-op instead of throwing.

const HAPTICS_STORAGE_KEY = "ludo-dz:haptics-enabled";

function readStoredHapticsPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
    return raw === null ? true : raw === "1"; // unset → default ON
  } catch {
    return true;
  }
}

let hapticsEnabled = readStoredHapticsPreference();

/** Current on/off state of the "Vibrations" setting (persisted across reloads). */
export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

/**
 * Update the global "Vibrations" setting used to gate every haptic trigger.
 * Call this from the Settings screen when the vibration toggle changes.
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Fires a raw vibration pattern, gated on the persisted toggle and safely
 * feature-detected. `navigator.vibrate` is fire-and-forget (synchronous,
 * non-blocking, no promise), and this never throws: some browsers (notably
 * iOS Safari) don't implement the Vibration API at all, and some
 * environments reject the call outside a trusted gesture — both are
 * silently absorbed since haptics are a nice-to-have that must never be able
 * to break gameplay.
 */
function fireVibration(pattern: number | number[]): void {
  if (!hapticsEnabled || !supportsVibration()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // no-op — unsupported/blocked environments must never throw into game logic
  }
}

/** Dice roll: a dynamic, subtle rolling pulse mirroring the dice's clatter. */
export function vibrateDiceRoll(): void {
  fireVibration([30, 40, 30, 40]);
}

/** Pawn step/jump: an ultra-short, crisp tap on every single hop across the board. */
export function vibratePawnStep(): void {
  fireVibration([15]);
}

/** Capture / win: a more satisfying, celebratory dual-pulse. */
export function vibrateCaptureOrWin(): void {
  fireVibration([50, 80, 50]);
}
