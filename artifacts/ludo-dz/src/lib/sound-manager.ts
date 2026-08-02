// ─── UI Sound Manager ───────────────────────────────────────────────────────
// Small, extensible trigger system for short UI click/tap sound effects.
//
// Every interactive control uses one of the categories below. This keeps the
// sound language cohesive and makes asset swaps a one-line change.
// To add a new trigger later:
//   1. Drop a short (<150ms ideally) .mp3 into `public/sounds/`.
//   2. Add an entry to `SOUND_FILES` below with a new `UiSoundName`.
//   3. Export a small convenience function (e.g. `playPawnMove`) and call it
//      from the interaction site — no other changes needed.
//
// Every sound goes through `playUiSound`, which is the single place that
// gates playback on the "Sound Effects" setting, so new triggers automatically
// respect it.

export type UiSoundName =
  | "primary-action"
  | "icon-tap"
  | "nav-back"
  | "selection"
  | "language-change"
  | "toggle-on"
  | "toggle-off";

/** Category → file mapping. All cues are intentionally brief (about 150ms). */
const SOUND_FILES: Record<UiSoundName, string> = {
  "primary-action": "sounds/primary-action.ogg",
  "icon-tap": "sounds/icon-tap.ogg",
  "nav-back": "sounds/nav-back.ogg",
  "selection": "sounds/selection.ogg",
  "language-change": "sounds/language-change.ogg",
  "toggle-on": "sounds/toggle-on.ogg",
  "toggle-off": "sounds/toggle-off.ogg",
};

const DEFAULT_VOLUME = 0.55;
const STORAGE_KEY = "ludo-dz:sound-effects-enabled";

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

let soundEnabled = readStoredPreference();
const audioCache = new Map<UiSoundName, HTMLAudioElement>();

/** Current on/off state of the "Sound Effects" setting (persisted across reloads). */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Update the global "Sound Effects" setting used to gate every UI sound.
 * Call this from the Settings screen when the sound-effects toggle changes.
 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

function getAudio(name: UiSoundName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let audio = audioCache.get(name);
  if (!audio) {
    const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
    audio = new Audio(`${base}${SOUND_FILES[name]}`);
    audio.preload = "auto";
    audio.volume = DEFAULT_VOLUME;
    audioCache.set(name, audio);
  }
  return audio;
}

/**
 * Play a short UI click/tap sound by name. Silently does nothing when the
 * "Sound Effects" setting is off, when `<audio>` isn't available, or if
 * playback is rejected (e.g. autoplay restrictions before a user gesture).
 */
export function playUiSound(name: UiSoundName): void {
  if (!soundEnabled) return;
  const audio = getAudio(name);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch {
    // ignore playback errors
  }
}

// ─── Category helpers ─────────────────────────────────────────────────────────
/** Primary/confirm actions: play and start game. */
export const playPrimaryAction = () => playUiSound("primary-action");
/** Secondary actions and icon-only controls: settings and close. */
export const playIconTap = () => playUiSound("icon-tap");
/** Back, dismiss, and exit navigation. */
export const playNavBack = () => playUiSound("nav-back");
/** Cards, selectors, player counts, board styles, and animation speeds. */
export const playSelection = () => playUiSound("selection");
/** Confirming a language choice. */
export const playLanguageChange = () => playUiSound("language-change");
export const playToggleOn = () => playUiSound("toggle-on");
export const playToggleOff = () => playUiSound("toggle-off");
/** Plays the on/off toggle click for the given resulting value. */
export const playToggleClick = (turningOn: boolean) => playUiSound(turningOn ? "toggle-on" : "toggle-off");
/** @deprecated Use playPrimaryAction for new primary actions. */
export const playStartPress = playPrimaryAction;
/** @deprecated Use playSelection for selectable cards and options. */
export const playModeSelect = playSelection;
