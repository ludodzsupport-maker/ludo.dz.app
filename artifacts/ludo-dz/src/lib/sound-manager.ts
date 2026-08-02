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
const NEON_PAWN_MIN_INTERVAL_MS = 38;

// Neon board cues are intentionally synthesized rather than fetched audio:
// they start instantly, add no asset/licensing overhead, and stay crisp at any
// display scale. Their master levels are lower than UI button sounds because
// both can repeat several times during a long pawn move.
let neonAudioContext: AudioContext | null = null;
let neonNoiseBuffer: AudioBuffer | null = null;
let lastNeonPawnAt = 0;

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

function getNeonAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  try {
    neonAudioContext ??= new AudioContext();
    // A context created before an interaction can be suspended by the browser.
    // Resume is deliberately non-blocking so the cue stays aligned to the roll
    // or landing event whenever the browser permits playback.
    if (neonAudioContext.state === "suspended") {
      void neonAudioContext.resume().catch(() => {});
    }
    return neonAudioContext;
  } catch {
    return null;
  }
}

function getNeonNoiseBuffer(context: AudioContext): AudioBuffer {
  if (neonNoiseBuffer?.sampleRate === context.sampleRate) return neonNoiseBuffer;
  const duration = 0.24;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    // A lightly correlated signal feels like a controlled digital rattle,
    // rather than harsh white-noise static.
    const previous = i === 0 ? 0 : samples[i - 1] * 0.28;
    samples[i] = previous + (Math.random() * 2 - 1) * 0.72;
  }
  neonNoiseBuffer = buffer;
  return buffer;
}

/**
 * Neon board dice: a compact, filtered electronic rattle that resolves into
 * a descending synth tick. It is separate from the generic UI asset system so
 * Classic and DZ never select or load it.
 */
export function playNeonDiceRoll(): void {
  if (!soundEnabled) return;
  const context = getNeonAudioContext();
  if (!context) return;

  try {
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.115, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    master.connect(context.destination);

    // Filtered noise gives the roll a tactile-but-digital rattle. Three small
    // gain pulses make the cue satisfying without imitating wooden dice.
    const noise = context.createBufferSource();
    noise.buffer = getNeonNoiseBuffer(context);
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1550, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(780, now + 0.2);
    noiseFilter.Q.value = 1.6;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.76, now + 0.018);
    noiseGain.gain.linearRampToValueAtTime(0.26, now + 0.06);
    noiseGain.gain.linearRampToValueAtTime(0.58, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.215);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 0.225);

    // The triangle tone supplies a clean sci-fi "lock-in" as the rattle ends.
    const tone = context.createOscillator();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(1180, now);
    tone.frequency.exponentialRampToValueAtTime(330, now + 0.19);
    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.5, now + 0.018);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    tone.connect(toneGain).connect(master);
    tone.start(now);
    tone.stop(now + 0.21);
  } catch {
    // Audio should never interfere with gameplay if a browser declines a cue.
  }
}

/**
 * Neon board pawn step: a quiet, high-tech blip with a tiny upward charge.
 * The interval guard avoids stacked transients if animation events ever arrive
 * closer together than the normal hop cadence.
 */
export function playNeonPawnMove(): void {
  if (!soundEnabled) return;
  const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
  if (nowMs - lastNeonPawnAt < NEON_PAWN_MIN_INTERVAL_MS) return;
  lastNeonPawnAt = nowMs;

  const context = getNeonAudioContext();
  if (!context) return;

  try {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(720, now);
    oscillator.frequency.exponentialRampToValueAtTime(1080, now + 0.052);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.052, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.085);
  } catch {
    // Audio should never interfere with gameplay if a browser declines a cue.
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
