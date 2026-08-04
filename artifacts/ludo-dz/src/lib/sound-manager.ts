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
const DZ_PAWN_MIN_INTERVAL_MS = 42;

// Both pawn-step cues (Neon and Classic) were originally hand-tuned against
// the "normal" animation speed's hop duration. `hopMs` — the caller's own
// per-hop animation length, unchanged here — lets each cue's envelope scale
// proportionally instead of staying fixed-length while the visual hop speeds
// up or slows down. The scale is bounded so it only ever lightly shrinks
// (Fast/Rapid) or lightly extends (Slow) the cue: enough to track the
// animation, never enough to lose the "quick footstep" character or drift
// into a different-sounding cue. At the 150ms reference (the "normal"
// preset), the scale is exactly 1 — today's tuned sound is unchanged.
const PAWN_STEP_REFERENCE_HOP_MS = 150;
const PAWN_STEP_MIN_SCALE = 0.75;
const PAWN_STEP_MAX_SCALE = 1.35;

function pawnStepTimeScale(hopMs: number | undefined): number {
  if (!hopMs || !Number.isFinite(hopMs) || hopMs <= 0) return 1;
  const raw = hopMs / PAWN_STEP_REFERENCE_HOP_MS;
  return Math.min(PAWN_STEP_MAX_SCALE, Math.max(PAWN_STEP_MIN_SCALE, raw));
}

// Neon and Classic board cues are intentionally synthesized rather than
// fetched audio: they start instantly, add no asset/licensing overhead, and
// stay crisp at any display scale. Their master levels are lower than UI
// button sounds because both can repeat several times during a long pawn
// move. Both themes share one AudioContext and scheduler (below); each keeps
// its own noise buffer so their timbres never bleed into one another.
let synthAudioContext: AudioContext | null = null;
let neonNoiseBuffer: AudioBuffer | null = null;
let woodNoiseBuffer: AudioBuffer | null = null;
let dzNoiseBuffer: AudioBuffer | null = null;
let lastNeonPawnAt = 0;
let lastClassicPawnAt = 0;
let lastDzPawnAt = 0;

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
 * closer together than the normal hop cadence. `hopMs` — the caller's own
 * per-hop animation length for the active speed setting, unchanged here —
 * scales the whole envelope (bounded, see `pawnStepTimeScale`) so the blip
 * tracks Fast/Rapid and Slow hop timing instead of staying fixed-length.
 */
export function playNeonPawnMove(hopMs?: number): void {
  if (!soundEnabled) return;
  const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
  if (nowMs - lastNeonPawnAt < NEON_PAWN_MIN_INTERVAL_MS) return;
  lastNeonPawnAt = nowMs;

  const scale = pawnStepTimeScale(hopMs);
  playSynthCue((context, now) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(720, now);
    oscillator.frequency.exponentialRampToValueAtTime(1080, now + 0.052 * scale);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.052, now + 0.006 * scale);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.078 * scale);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.085 * scale);
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
 * Shared building block for every synthesized Classic board cue: a short
 * filtered-noise "chk" contact transient plus a brief decaying triangle tone
 * (the wooden body's resonance). Reused with different parameters for the
 * pawn step, capture, and UI click so all three share one coherent "wood
 * family" timbre, distinct from Neon's oscillator-sweep/digital-noise
 * character. (The dice roll uses a real recorded sample instead — see below.)
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
// zero latency and align sample-accurately to the roll animation's real
// duration.
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

// Sample outlasts the roll animation (Fast/Rapid speeds): rather than always
// starting at the recording's beginning and fading its tail early — which
// cuts the take off before it resolves — speed it up just enough (capped) to
// let the *whole* take fit naturally. 1.35x keeps the tumble recognizable
// instead of chipmunking it. If even that capped rate can't fit the whole
// take in time, skip into the recording so its own natural ending — not a
// fade — lands exactly when the roll animation does, matching the resolve
// tone to the visual landing at any speed.
const CLASSIC_DICE_MAX_TRIM_RATE = 1.35;

/**
 * Classic board dice: plays the real recorded dice-tumble sample, starting
 * instantly (no delay) when the roll animation begins. `rollDurationMs` is
 * the caller's own roll-animation length (computed from its existing timing,
 * unchanged here).
 *
 * If the sample is shorter than the roll, it is played once at the modest
 * rate needed to fill the exact roll window, preserving one continuous
 * recording without an audible splice or a silent gap (Normal/Slow — the
 * Classic timing presets cap this at a deliberate, bounded 0.649x for the
 * slow setting).
 *
 * If the sample would outlast the roll (Fast/Rapid), playback speeds up
 * (bounded — see `CLASSIC_DICE_MAX_TRIM_RATE`) so the complete take, start to
 * resolve, fits inside the shorter window instead of being faded off
 * mid-rattle. If the capped speed-up still isn't enough to fit the whole
 * take, playback starts partway into the recording instead of fading its
 * tail, so what plays is always the take's own natural ending rather than an
 * abrupt or faded cut.
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
    gain.gain.setValueAtTime(1, now);

    const rollDurationSec = Math.max(0.05, rollDurationMs / 1000);
    if (buffer.duration <= rollDurationSec) {
      // Slow the complete recording just enough to end with the animation.
      // The Classic timing presets cap this at a deliberate, bounded 0.649x
      // for the slow setting; no loop or synthetic filler is introduced.
      const playbackRate = buffer.duration / rollDurationSec;
      source.playbackRate.setValueAtTime(playbackRate, now);
      source.start(now);
      // The buffer naturally exhausts at exactly `rollDurationSec`; this is
      // only a post-end cleanup guard and does not extend audible playback.
      source.stop(now + rollDurationSec + 0.02);
      return;
    }

    // Sample outlasts the roll animation: speed it up (capped) so the whole
    // take fits; skip into the buffer if even the cap isn't enough, so
    // playback always ends on the recording's real finish.
    const idealRate = buffer.duration / rollDurationSec;
    const rate = Math.min(CLASSIC_DICE_MAX_TRIM_RATE, idealRate);
    source.playbackRate.setValueAtTime(rate, now);

    const bufferSpanPlayed = rollDurationSec * rate; // seconds of buffer consumed at this rate
    const offset = Math.max(0, buffer.duration - bufferSpanPlayed);
    source.start(now, offset);
    source.stop(now + rollDurationSec + 0.02);
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

let classicPawnNoiseBuffer: AudioBuffer | null = null;

/**
 * Dedicated noise texture for Classic's marble pawn select/step family —
 * distinct from `getWoodNoiseBuffer` (shared by the generic Classic click
 * and capture, both untouched below). Only lightly correlated (unlike the
 * smoothed, rounded buffers used elsewhere) so a bandpass filter still has
 * real high-frequency content to carve into — the hard, bright "mineral
 * surface" edge a duller buffer can't give.
 */
function getClassicPawnNoiseBuffer(context: AudioContext): AudioBuffer {
  if (classicPawnNoiseBuffer?.sampleRate === context.sampleRate) return classicPawnNoiseBuffer;
  const duration = 0.08;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    const previous = i === 0 ? 0 : samples[i - 1] * 0.15;
    samples[i] = previous + (Math.random() * 2 - 1) * 0.85;
  }
  classicPawnNoiseBuffer = buffer;
  return buffer;
}

/**
 * Shared building block for Classic's marble/stone pawn family — the pawn
 * tap-to-select and the pawn jump/step landing. Replaces an earlier
 * wood/resin design (dual detuned oscillators plus a sub-bass layer and a
 * delayed second hit) that read as reverby and hollow; this version is
 * deliberately a single hit with a very short exponential decay and no
 * sub-bass at all, so nothing here can sustain, ring, or repeat — a real
 * marble "clack" is over in well under a tenth of a second. A
 * bandpass-filtered noise burst (bright and hard, tuned high — not the warm
 * lowpass "thump" used for wood) supplies the mineral contact transient; a
 * short triangle tone with a quick upward pitch-flick at the very onset
 * supplies the light cartoon "pop" rather than a flat static beep; a quiet,
 * even shorter octave-up sine shimmer adds the crisp, high-definition edge
 * that reads as polished stone. Kept entirely separate from
 * `scheduleWoodKnock` (untouched; still powers the generic Classic UI click
 * and capture), so this redesign can't affect either. Every cue built on
 * this shares the exact recipe; only freq/amp/decay/mix differ.
 */
function scheduleClassicPawnBody(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay, noiseMix = 0.5 }: { amp: number; freq: number; decay: number; noiseMix?: number },
): void {
  // Hard mineral contact transient — bandpass and short, not the lowpass
  // "thump" used for wood, so the attack reads as a crisp clack rather than
  // a dull knock.
  const noise = context.createBufferSource();
  noise.buffer = getClassicPawnNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(freq * 4.2, startTime);
  noiseFilter.Q.value = 1.1;
  const noiseGain = context.createGain();
  const noiseDecay = Math.min(decay * 0.6, 0.024);
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(amp * noiseMix, startTime + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noiseDecay);
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(startTime);
  noise.stop(startTime + noiseDecay + 0.01);

  // Tone — a very slight upward onset flick into the target pitch, then an
  // immediate, fully dry decay. Sine wave (not triangle) so there are no odd
  // harmonics: the result is a clean, smooth polished-stone body rather than
  // a hollow or boxy one. No downward glide and no sustain.
  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(freq * 0.88, startTime);
  body.frequency.exponentialRampToValueAtTime(freq, startTime + 0.008);
  body.frequency.exponentialRampToValueAtTime(freq * 0.92, startTime + decay);
  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(amp * (1 - noiseMix * 0.3), startTime + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  body.connect(bodyGain).connect(bus);
  body.start(startTime);
  body.stop(startTime + decay + 0.01);

  // Octave-up shimmer, very quiet and even shorter — the crisp,
  // high-definition edge that reads as polished stone rather than plain
  // wood, without adding any perceptible length to the cue.
  const shimmer = context.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(freq * 2.1, startTime);
  const shimmerGain = context.createGain();
  const shimmerDecay = Math.min(decay * 0.45, 0.02);
  shimmerGain.gain.setValueAtTime(0.0001, startTime);
  shimmerGain.gain.linearRampToValueAtTime(amp * 0.16, startTime + 0.002);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + shimmerDecay);
  shimmer.connect(shimmerGain).connect(bus);
  shimmer.start(startTime);
  shimmer.stop(startTime + shimmerDecay + 0.01);
}

/**
 * Classic board pawn step: a snappy, solid marble drop/landing — one dry hit
 * only (no settle-bounce echo; the previous design's delayed second hit was
 * part of what read as "echo"). Lower-pitched and a touch heavier than
 * selection below for the "solid landing" weight, while sharing the exact
 * same `scheduleClassicPawnBody` recipe so the two cues still read as the
 * same material. `hopMs` — the caller's own per-hop animation length for the
 * active speed setting, unchanged here — lightly scales the decay (bounded,
 * see `pawnStepTimeScale`); even at its longest (Slow) the cue stays under
 * 70ms, well inside "ends instantly."
 */
export function playClassicPawnMove(hopMs?: number): void {
  if (!soundEnabled) return;
  const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
  if (nowMs - lastClassicPawnAt < CLASSIC_PAWN_MIN_INTERVAL_MS) return;
  lastClassicPawnAt = nowMs;

  const scale = pawnStepTimeScale(hopMs);
  const jitter = 0.97 + Math.random() * 0.06;
  playSynthCue((context, now) => {
    // Tuned for maximum snap and dryness: lighter amp, higher/brighter pitch,
    // very short decay (≤40ms even at Slow), and a higher noise mix so the
    // cue reads as a crisp click-and-clean-tone rather than a tonal body.
    scheduleClassicPawnBody(context, context.destination, now, {
      amp: 0.36, freq: 640 * jitter, decay: 0.030 * scale, noiseMix: 0.62,
    });
  });
}

/**
 * Classic board pawn selection: the tap that picks a playable pawn to move —
 * a sharp, clean, dry marble tap, brighter and quicker than the step above
 * with no low-end weight at all. Built on the exact same
 * `scheduleClassicPawnBody` recipe as `playClassicPawnMove` (just a higher
 * base frequency and a shorter, lighter decay) so selecting and then
 * stepping a pawn read as one cohesive marble material. Distinct from the
 * generic `playClassicClick` (still `scheduleWoodKnock`, untouched) used by
 * settings/back/restart/speed-picker buttons — "pawn click/selection" means
 * specifically this tap-to-select action.
 */
export function playClassicPawnSelect(): void {
  const jitter = 0.97 + Math.random() * 0.06;
  playSynthCue((context, now) => {
    scheduleClassicPawnBody(context, context.destination, now, {
      amp: 0.40, freq: 760 * jitter, decay: 0.034, noiseMix: 0.56,
    });
  });
}

/**
 * Classic board capture: a firmer, lower double-knock than the pawn step, so
 * sending an opponent's piece home reads as a distinctly bigger, satisfying
 * event rather than a louder version of a normal landing. A weighty primary
 * strike lands first; a lighter, higher second knock ~85 ms later reads as
 * the bumped piece tumbling off the tile. A short sine body under the first
 * strike adds warmth without turning it into a boom. Kept under 350 ms total
 * so it never lingers over the shockwave VFX or the next turn's roll.
 */
export function playClassicCapture(): void {
  playSynthCue((context, now) => {
    const master = context.createGain();
    master.gain.setValueAtTime(1, now);
    master.connect(context.destination);

    scheduleWoodKnock(context, master, now, { amp: 0.52, freq: 250, decay: 0.20, noiseMix: 0.40 });
    scheduleWoodKnock(context, master, now + 0.085, { amp: 0.22, freq: 460, decay: 0.11, noiseMix: 0.56 });

    const body = context.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(196, now);
    body.frequency.exponentialRampToValueAtTime(148, now + 0.16);
    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.20, now + 0.01);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    body.connect(bodyGain).connect(master);
    body.start(now);
    body.stop(now + 0.2);
  });
}

// ─── DZ (Algerian) board cues ───────────────────────────────────────────────
// A third synthesized family, distinct from both Neon's digital sweep and
// Classic's plain wood: a warm resonant body (suggesting polished stone or a
// lacquered box) plus a brief pair of closely-detuned high sine partials —
// standing in for a gold-inlay accent catching the light — layered on every
// contact. Shares the module's one AudioContext/scheduler but keeps its own
// noise buffer so its timbre never bleeds into the other two themes.

function getDzNoiseBuffer(context: AudioContext): AudioBuffer {
  if (dzNoiseBuffer?.sampleRate === context.sampleRate) return dzNoiseBuffer;
  const duration = 0.22;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    // Correlation sits between Neon's crisp digital rattle (0.28) and
    // Classic's dull wood (0.62): a rounder, more "lacquered" contact
    // transient that still leaves the gold shimmer layer room to read
    // clearly on top of it.
    const previous = i === 0 ? 0 : samples[i - 1] * 0.48;
    samples[i] = previous + (Math.random() * 2 - 1) * 0.62;
  }
  dzNoiseBuffer = buffer;
  return buffer;
}

/**
 * Shared building block for every synthesized DZ board cue: a soft filtered-
 * noise contact transient, a two-partial resonant body (fundamental + a
 * fifth above — a single triangle reads as flat "wood"; the extra partial
 * gives a struck-object resonance suggesting stone or a lacquered, gold-
 * trimmed box), and a pair of closely-detuned high sine partials that decay
 * almost immediately (the slight detune beats briefly against itself,
 * reading as a metallic/brass glint rather than a plain electronic beep).
 * Reused with different parameters for the dice tumble/resolve, pawn step,
 * and UI click so the whole DZ family shares one coherent "warm gold-and-
 * green" timbre.
 */
function scheduleDzKnock(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay, shimmerAmp, shimmerFreq, shimmerDecay, noiseMix = 0.3 }: {
    amp: number; freq: number; decay: number;
    shimmerAmp: number; shimmerFreq: number; shimmerDecay: number;
    noiseMix?: number;
  },
): void {
  // Soft contact transient — quieter and rounder than Classic's bare "chk"
  // so it reads as a padded, premium touch.
  const noise = context.createBufferSource();
  noise.buffer = getDzNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(freq * 2.3, startTime);
  noiseFilter.Q.value = 1.1;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(amp * noiseMix, startTime + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.42);
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(startTime);
  noise.stop(startTime + decay * 0.42 + 0.02);

  // Fundamental body.
  const body = context.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(freq, startTime);
  body.frequency.exponentialRampToValueAtTime(freq * 0.82, startTime + decay);
  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(amp * (1 - noiseMix * 0.5), startTime + 0.007);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  body.connect(bodyGain).connect(bus);
  body.start(startTime);
  body.stop(startTime + decay + 0.02);

  // A fifth above the fundamental, quieter and shorter, gives the body a
  // resonant "struck object" quality instead of a flat single tone.
  const overtone = context.createOscillator();
  overtone.type = "triangle";
  overtone.frequency.setValueAtTime(freq * 1.5, startTime);
  overtone.frequency.exponentialRampToValueAtTime(freq * 1.5 * 0.82, startTime + decay * 0.8);
  const overtoneGain = context.createGain();
  overtoneGain.gain.setValueAtTime(0.0001, startTime);
  overtoneGain.gain.linearRampToValueAtTime(amp * 0.34, startTime + 0.006);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.75);
  overtone.connect(overtoneGain).connect(bus);
  overtone.start(startTime);
  overtone.stop(startTime + decay * 0.75 + 0.02);

  // Gold/brass shimmer: two closely-detuned high sines, near-instant decay.
  for (const [index, f] of [shimmerFreq, shimmerFreq * 1.025].entries()) {
    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(f, startTime);
    const shimmerGain = context.createGain();
    const gain = shimmerAmp * (index === 0 ? 1 : 0.7);
    shimmerGain.gain.setValueAtTime(0.0001, startTime);
    shimmerGain.gain.linearRampToValueAtTime(gain, startTime + 0.003);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + shimmerDecay);
    shimmer.connect(shimmerGain).connect(bus);
    shimmer.start(startTime);
    shimmer.stop(startTime + shimmerDecay + 0.02);
  }
}

/**
 * DZ board dice: delegates to Classic's recorded dice roll on purpose.
 * `playClassicDiceRoll` owns loading and timing the shared
 * `sounds/dice-roll-classic.wav` sample, so both themes use the exact same
 * source, gain, playback-rate and end-of-roll behavior. Keeping this small
 * theme-specific hook preserves the existing per-theme trigger pattern while
 * ensuring only DZ's dice cue is shared; DZ pawn and UI-click sounds remain
 * on their own dedicated functions below.
 */
export function playDzDiceRoll(rollDurationMs: number): void {
  playClassicDiceRoll(rollDurationMs);
}

/**
 * DZ board control press: a single warm, resonant press with a soft gold-
 * shimmer accent — a deliberate, premium tap distinct from Classic's plain
 * wood click and Neon's digital tick.
 */
export function playDzClick(): void {
  playSynthCue((context, now) => {
    scheduleDzKnock(context, context.destination, now, {
      amp: 0.36, freq: 300, decay: 0.16,
      shimmerAmp: 0.085, shimmerFreq: 2400, shimmerDecay: 0.10,
      noiseMix: 0.28,
    });
  });
}

let dzPlopNoiseBuffer: AudioBuffer | null = null;

/**
 * Dedicated noise texture for the DZ pawn-step "plop" only — distinct from
 * `getDzNoiseBuffer` (shared by DZ's click) and from the dice roll's own
 * buffer, so retuning this cue's tactile contact can never bleed into either.
 * Lightly correlated (between Neon's crisp 0.28 and the shared DZ knock's
 * 0.48) so a lowpass still rounds it into a soft "tok" rather than a hiss.
 */
function getDzPlopNoiseBuffer(context: AudioContext): AudioBuffer {
  if (dzPlopNoiseBuffer?.sampleRate === context.sampleRate) return dzPlopNoiseBuffer;
  const duration = 0.05;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    const previous = i === 0 ? 0 : samples[i - 1] * 0.4;
    samples[i] = previous + (Math.random() * 2 - 1) * 0.6;
  }
  dzPlopNoiseBuffer = buffer;
  return buffer;
}

/**
 * One "juicy" cartoon-plop contact for the DZ pawn step. Deliberately built
 * differently from `scheduleDzKnock` (DZ's click/dice-adjacent resonant
 * family, untouched): no bandpass-resonant noise and no bright triangle
 * overtone — instead a dual sine oscillator pitch-bend (the classic
 * cartoon "plop" technique: a fast downward glide reads as playful/organic
 * in a way a fixed pitch never does) plus a soft low-pass-filtered contact
 * thump for tactile touch. `freq` is the plop's starting pitch; the sub
 * layer and noise cutoff are derived from it so one knob tunes the whole
 * voice. Shimmer is the same gold-glint motif as the rest of the DZ family,
 * kept much quieter here so it reads as a light premium polish rather than
 * competing with the plop itself.
 */
function scheduleDzPlop(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay, shimmerAmp, shimmerFreq, shimmerDecay }: {
    amp: number; freq: number; decay: number;
    shimmerAmp: number; shimmerFreq: number; shimmerDecay: number;
  },
): void {
  // Tactile contact — soft low-pass filtered noise (no resonant peak, no
  // high-frequency hiss) standing in for the wood-bounce touch of contact.
  const noise = context.createBufferSource();
  noise.buffer = getDzPlopNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(freq * 1.7, startTime);
  noiseFilter.Q.value = 0.7;
  const noiseGain = context.createGain();
  const noiseDecay = decay * 0.3;
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(amp * 0.3, startTime + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noiseDecay);
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(startTime);
  noise.stop(startTime + noiseDecay + 0.02);

  // Main plop body — a bare sine gliding fast from mid pitch down toward its
  // low end. That downward bend, not the tone itself, is what makes it read
  // as a bouncy cartoon "plop" instead of a flat beep; a sine keeps it warm
  // and round instead of tinny.
  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(freq, startTime);
  body.frequency.exponentialRampToValueAtTime(freq * 0.42, startTime + decay);
  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(amp, startTime + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  body.connect(bodyGain).connect(bus);
  body.start(startTime);
  body.stop(startTime + decay + 0.02);

  // Sub layer — a second, lower sine gliding even further down and lingering
  // a touch longer, for the "deep, premium" low-mid weight underneath the
  // plop without doubling its exact pitch (avoids a phasey/beating clash).
  const subDecay = decay * 1.25;
  const sub = context.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(freq * 0.46, startTime);
  sub.frequency.exponentialRampToValueAtTime(freq * 0.46 * 0.55, startTime + subDecay);
  const subGain = context.createGain();
  subGain.gain.setValueAtTime(0.0001, startTime);
  subGain.gain.linearRampToValueAtTime(amp * 0.56, startTime + 0.005);
  subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + subDecay);
  sub.connect(subGain).connect(bus);
  sub.start(startTime);
  sub.stop(startTime + subDecay + 0.02);

  // Faint gold-glint accent — the DZ family's shared premium signature, kept
  // very quiet here so it polishes the plop without turning it "resonant."
  if (shimmerAmp > 0) {
    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(shimmerFreq, startTime);
    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, startTime);
    shimmerGain.gain.linearRampToValueAtTime(shimmerAmp, startTime + 0.003);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + shimmerDecay);
    shimmer.connect(shimmerGain).connect(bus);
    shimmer.start(startTime);
    shimmer.stop(startTime + shimmerDecay + 0.02);
  }
}

/**
 * DZ board pawn step: a deep, premium tactile thud blended with a fun, juicy
 * cartoon pop/plop — a dual-oscillator pitch-bend body (see `scheduleDzPlop`)
 * plus a tiny, quieter echo of the same plop ~30ms later standing in for a
 * soft second bounce, which is most of what makes it feel "juicy" rather
 * than a single flat hit. Deliberately not built on `scheduleDzKnock` (DZ's
 * click, untouched) — that family is a resonant knock; this one is a round,
 * bouncy plop, so the two stay clearly distinct even though both carry the
 * same DZ gold-glint accent. `hopMs` — the caller's own per-hop animation
 * length for the active speed setting, unchanged here — scales the plop's
 * envelope (bounded, see `pawnStepTimeScale`) exactly as Neon's and
 * Classic's pawn cues do, so all three themes track Fast/Rapide and Lent
 * consistently; a small per-hop pitch jitter keeps a rapid multi-hop dash
 * from sounding mechanically identical.
 */
export function playDzPawnMove(hopMs?: number): void {
  if (!soundEnabled) return;
  const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
  if (nowMs - lastDzPawnAt < DZ_PAWN_MIN_INTERVAL_MS) return;
  lastDzPawnAt = nowMs;

  const scale = pawnStepTimeScale(hopMs);
  const jitter = 0.97 + Math.random() * 0.06;
  playSynthCue((context, now) => {
    scheduleDzPlop(context, context.destination, now, {
      amp: 0.34, freq: 355 * jitter, decay: 0.05 * scale,
      shimmerAmp: 0.026, shimmerFreq: 2200, shimmerDecay: 0.016 * scale,
    });
    // Tiny secondary bounce — a quieter, higher echo of the same plop, the
    // "extra juice" layer that reads as a satisfying little settle rather
    // than one clean hit stopping cold.
    scheduleDzPlop(context, context.destination, now + 0.03 * scale, {
      amp: 0.11, freq: 300 * jitter, decay: 0.022 * scale,
      shimmerAmp: 0, shimmerFreq: 2200, shimmerDecay: 0.01,
    });
  });
}

/**
 * DZ board pawn selection: the tap that picks a playable pawn to move,
 * distinct from both the pawn's own step/landing cue and from DZ's generic
 * control-press click. Deliberately built on the exact same `scheduleDzPlop`
 * voice as `playDzPawnMove` (untouched above) rather than the resonant
 * `scheduleDzKnock` family used by `playDzClick` — sharing that pitch-bend
 * "plop" DNA is what makes selecting and then stepping a pawn read as one
 * cohesive tactile feedback loop instead of two unrelated sounds. It differs
 * from the step cue on purpose: a single hit (no secondary settle-bounce, so
 * it reads as an instant "activated" acknowledgment rather than a landing),
 * pitched a little higher and louder with a brighter, longer gold-glint
 * shimmer (a confident "premium select" glint vs. the step's subtler
 * contact polish) — while staying low-mid and warm, never thin or harsh.
 */
export function playDzPawnSelect(): void {
  const jitter = 0.97 + Math.random() * 0.06;
  playSynthCue((context, now) => {
    scheduleDzPlop(context, context.destination, now, {
      amp: 0.40, freq: 400 * jitter, decay: 0.065,
      shimmerAmp: 0.05, shimmerFreq: 2600, shimmerDecay: 0.055,
    });
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
