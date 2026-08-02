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
const CLASSIC_PAWN_MIN_INTERVAL_MS = 46;

// Neon and Classic board cues are intentionally synthesized rather than
// fetched audio: they start instantly, add no asset/licensing overhead, and
// stay crisp at any display scale. Their master levels are lower than UI
// button sounds because both can repeat several times during a long pawn
// move. Both themes share one AudioContext and scheduler (below); each keeps
// its own noise buffer so their timbres never bleed into one another.
let synthAudioContext: AudioContext | null = null;
let neonNoiseBuffer: AudioBuffer | null = null;
let woodNoiseBuffer: AudioBuffer | null = null;
let lastNeonPawnAt = 0;
let lastClassicPawnAt = 0;

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

type AudioContextConstructor = new () => AudioContext;

function getSynthAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    // Safari exposes the constructor under its prefixed name. Supporting both
    // prevents a no-op synthesized soundtrack on otherwise capable mobile
    // browsers.
    const AudioContextClass = (
      window.AudioContext
      ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
    ) as AudioContextConstructor | undefined;
    if (!AudioContextClass) return null;
    synthAudioContext ??= new AudioContextClass();
    return synthAudioContext;
  } catch {
    return null;
  }
}

/**
 * Schedule a synthesized cue (Neon or Classic) only after the Web Audio
 * context is actually running. `resume()` is invoked synchronously from the
 * original gesture handler, which satisfies autoplay policies; rendering
 * waits for its resolution so sources are never started against a suspended
 * context and silently lost.
 */
function playSynthCue(render: (context: AudioContext, now: number) => void): void {
  if (!soundEnabled) return;

  const context = getSynthAudioContext();
  if (!context) return;

  const start = () => {
    if (context.state !== "running") return;
    try {
      render(context, context.currentTime);
    } catch {
      // A failed cue must never disrupt a game interaction.
    }
  };

  if (context.state === "running") {
    start();
    return;
  }

  // Important: call resume immediately, while the pointer/click event is still
  // active. Only its completion is deferred.
  void context.resume().then(start).catch(() => {});
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
  playSynthCue((context, now) => {
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
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
  });
}

/**
 * Neon board control press: a tight digital transient with a warm electrical
 * resonance. It lasts 120ms, so it remains satisfying across rapid UI taps
 * without becoming harsh or competing with the dice and pawn cues.
 */
export function playNeonClick(): void {
  playSynthCue((context, now) => {
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.12, now + 0.003);
    master.gain.exponentialRampToValueAtTime(0.036, now + 0.021);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    master.connect(context.destination);

    // Quick, glassy attack: provides definition without the brittle hiss of
    // an all-noise click.
    const attack = context.createOscillator();
    attack.type = "triangle";
    attack.frequency.setValueAtTime(1580, now);
    attack.frequency.exponentialRampToValueAtTime(760, now + 0.042);
    const attackGain = context.createGain();
    attackGain.gain.setValueAtTime(0.0001, now);
    attackGain.gain.exponentialRampToValueAtTime(0.72, now + 0.002);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    attack.connect(attackGain).connect(master);
    attack.start(now);
    attack.stop(now + 0.06);

    // A lower sine tail gives the press a subtle electric body rather than a
    // thin, tinny UI tick.
    const resonance = context.createOscillator();
    resonance.type = "sine";
    resonance.frequency.setValueAtTime(520, now);
    resonance.frequency.exponentialRampToValueAtTime(380, now + 0.115);
    const resonanceGain = context.createGain();
    resonanceGain.gain.setValueAtTime(0.0001, now);
    resonanceGain.gain.exponentialRampToValueAtTime(0.42, now + 0.011);
    resonanceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    resonance.connect(resonanceGain).connect(master);
    resonance.start(now);
    resonance.stop(now + 0.125);
  });
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

  playSynthCue((context, now) => {
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
  });
}

function getWoodNoiseBuffer(context: AudioContext): AudioBuffer {
  if (woodNoiseBuffer?.sampleRate === context.sampleRate) return woodNoiseBuffer;
  const duration = 0.22;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    // Heavier smoothing than Neon's noise buffer rounds off the high end, so
    // this reads as a duller, more organic "wood" texture rather than a
    // digital rattle.
    const previous = i === 0 ? 0 : samples[i - 1] * 0.62;
    samples[i] = previous + (Math.random() * 2 - 1) * 0.5;
  }
  woodNoiseBuffer = buffer;
  return buffer;
}

/**
 * Shared building block for every Classic board cue: a short filtered-noise
 * "chk" contact transient plus a brief decaying triangle tone (the wooden
 * body's resonance). Reused with different parameters for the dice roll,
 * pawn step, and UI click so all three share one coherent "wood family"
 * timbre, distinct from Neon's oscillator-sweep/digital-noise character.
 */
function scheduleWoodKnock(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay, noiseMix = 0.5 }: { amp: number; freq: number; decay: number; noiseMix?: number },
): void {
  // Filtered-noise contact transient — the "chk" of impact.
  const noise = context.createBufferSource();
  noise.buffer = getWoodNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(freq * 2.1, startTime);
  noiseFilter.Q.value = 0.9;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(amp * noiseMix, startTime + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.5);
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(startTime);
  noise.stop(startTime + decay * 0.5 + 0.02);

  // Decaying triangle "thock" gives the knock a solid wooden body.
  const tone = context.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(freq, startTime);
  tone.frequency.exponentialRampToValueAtTime(freq * 0.72, startTime + decay);
  const toneGain = context.createGain();
  toneGain.gain.setValueAtTime(0.0001, startTime);
  toneGain.gain.linearRampToValueAtTime(amp * (1 - noiseMix * 0.6), startTime + 0.006);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  tone.connect(toneGain).connect(bus);
  tone.start(startTime);
  tone.stop(startTime + decay + 0.02);
}

// ─── Classic dice roll: real recorded sample ─────────────────────────────────
// Sourced from a user-provided recording instead of synthesis, for maximum
// authenticity. Decoded once into an AudioBuffer so playback can start with
// zero latency and be trimmed sample-accurately to the roll animation's real
// duration — never stretched, looped, or lengthened past its own length.
const CLASSIC_DICE_ROLL_URL = "sounds/dice-roll-classic.wav";
let classicDiceRollBuffer: AudioBuffer | null = null;
let classicDiceRollLoadPromise: Promise<AudioBuffer | null> | null = null;

function loadClassicDiceRollBuffer(context: AudioContext): Promise<AudioBuffer | null> {
  if (classicDiceRollBuffer) return Promise.resolve(classicDiceRollBuffer);
  if (classicDiceRollLoadPromise) return classicDiceRollLoadPromise;

  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  classicDiceRollLoadPromise = fetch(`${base}${CLASSIC_DICE_ROLL_URL}`)
    .then((response) => {
      if (!response.ok) throw new Error(`dice roll sample fetch failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      classicDiceRollBuffer = buffer;
      return buffer;
    })
    .catch(() => {
      // A failed fetch/decode must never crash the game. Clear the promise so
      // a later roll can retry instead of being permanently stuck on failure.
      classicDiceRollLoadPromise = null;
      return null;
    });

  return classicDiceRollLoadPromise;
}

// Kick off the fetch/decode the moment this module is first imported — i.e.
// on initial app load, well before the player reaches the game board — so
// the very first roll never waits on the network or the decoder.
if (typeof window !== "undefined") {
  const warmContext = getSynthAudioContext();
  if (warmContext) void loadClassicDiceRollBuffer(warmContext);
}

/**
 * Classic board dice: plays the real recorded dice-tumble sample, starting
 * instantly (no delay) when the roll animation begins. `rollDurationMs` is
 * the caller's own roll-animation length (computed from its existing timing,
 * unchanged here). If the sample would outlast it, playback is trimmed to
 * end exactly at that moment with a short fade so the cut is a clean tail-off
 * rather than an abrupt pop. If the sample is already shorter, it plays
 * through untouched — never stretched or looped to fill the remaining time.
 * It is separate from both Neon/DZ cues and the Classic pawn/click helpers.
 */
export function playClassicDiceRoll(rollDurationMs: number): void {
  playSynthCue((context, now) => {
    const buffer = classicDiceRollBuffer;
    if (!buffer) {
      // Not decoded yet (e.g. a roll fired before the eager load above
      // finished) — retry the load for next time rather than substituting a
      // different cue or blocking this roll.
      void loadClassicDiceRollBuffer(context);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    source.connect(gain).connect(context.destination);

    const rollDurationSec = Math.max(0.05, rollDurationMs / 1000);
    if (buffer.duration <= rollDurationSec) {
      // Sample is already no longer than the roll animation — play it
      // through as-is, at its natural length.
      gain.gain.setValueAtTime(1, now);
      source.start(now);
      source.stop(now + buffer.duration + 0.02);
      return;
    }

    // Sample outlasts the roll animation: trim playback to match it exactly,
    // easing out over a short window so the stop reads as a natural
    // tail-off rather than a hard, clicky cut.
    const stopAt = now + rollDurationSec;
    const fadeStart = Math.max(now, stopAt - Math.min(0.09, rollDurationSec * 0.25));
    gain.gain.setValueAtTime(1, fadeStart);
    gain.gain.linearRampToValueAtTime(0, stopAt);
    source.start(now);
    source.stop(stopAt + 0.02);
  });
}

/**
 * Classic board control press: a single soft, lower knock with a longer
 * decay than the pawn step, so it reads as a deliberate tap rather than a
 * moving piece.
 */
export function playClassicClick(): void {
  playSynthCue((context, now) => {
    scheduleWoodKnock(context, context.destination, now, { amp: 0.34, freq: 340, decay: 0.14, noiseMix: 0.46 });
  });
}

/**
 * Classic board pawn step: a quiet, short knock — a pawn settling onto the
 * next tile. The interval guard avoids stacked transients if animation
 * events ever arrive closer together than the normal hop cadence.
 */
export function playClassicPawnMove(): void {
  if (!soundEnabled) return;
  const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
  if (nowMs - lastClassicPawnAt < CLASSIC_PAWN_MIN_INTERVAL_MS) return;
  lastClassicPawnAt = nowMs;

  playSynthCue((context, now) => {
    scheduleWoodKnock(context, context.destination, now, { amp: 0.2, freq: 540, decay: 0.055, noiseMix: 0.56 });
  });
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
