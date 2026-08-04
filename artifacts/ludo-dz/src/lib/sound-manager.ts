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
 * Neon board dice: shares the exact same recorded dice-tumble sample and
 * duration-sync logic as Classic/DZ (same recognisable rhythm and tactile
 * impact), then adds three layers of synthesized neon colour on top.
 *
 * `rollDurationMs` is the caller's own roll-animation length — identical to
 * what Classic/DZ already receive so all three themes land in perfect sync.
 *
 *   Layer 1 — High-passed sample (digital tumble):
 *     The Classic recording is routed through a highpass at 900 Hz.  Stripping
 *     the low-end warmth leaves only the bright, airy upper portion of the
 *     tumble — recognisably a dice roll, but thin and digital rather than
 *     acoustic.  Rate/offset logic is identical to Classic so the take always
 *     lands exactly when the animation does.
 *
 *   Layer 2 — Neon glints (three digital sparks):
 *     Three brief bandpass-filtered bursts from `neonNoiseBuffer` (the same
 *     lightly-correlated digital noise used by Neon's pawn and click cues)
 *     fire at 15 %, 45 %, and 72 % of the roll duration.  Each is ~50 ms,
 *     tuned to a different centre frequency (1 800 / 2 300 / 1 500 Hz) so
 *     they read as distinct digital "glints" rather than a single repeating
 *     event.  Quiet (peak 0.15) so they accent rather than compete with the
 *     sample underneath.
 *
 *   Layer 3 — Sci-fi lock-in tone (descending sine resolve):
 *     A sine oscillator enters during the final portion of the roll and sweeps
 *     from 1 050 Hz down to 310 Hz, ending exactly as the animation lands.
 *     This is the defining Neon-board audio signature — the "number confirmed"
 *     resolve.  Duration is proportional to the roll (capped at 200 ms) so it
 *     scales gracefully from Fast to Slow without starting before the glints.
 *
 * Classic and DZ dice rolls are completely untouched.
 */
export function playNeonDiceRoll(rollDurationMs: number): void {
  playSynthCue((context, now) => {
    const rollSec = Math.max(0.05, rollDurationMs / 1000);

    // ── Layer 1: recorded sample, high-passed ───────────────────────────────
    const buffer = classicDiceRollBuffer;
    if (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;

      // Identical rate/offset logic to playClassicDiceRoll so the take always
      // ends exactly when the roll animation does at every speed preset.
      let offset = 0;
      if (buffer.duration <= rollSec) {
        source.playbackRate.setValueAtTime(buffer.duration / rollSec, now);
      } else {
        const rate = Math.min(CLASSIC_DICE_MAX_TRIM_RATE, buffer.duration / rollSec);
        source.playbackRate.setValueAtTime(rate, now);
        offset = Math.max(0, buffer.duration - rollSec * rate);
      }

      // Highpass strips acoustic warmth → bright digital tumble character.
      const hp = context.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(900, now);
      hp.Q.value = 0.7;

      const sampleGain = context.createGain();
      sampleGain.gain.setValueAtTime(0.70, now);

      source.connect(hp).connect(sampleGain).connect(context.destination);
      source.start(now, offset);
      source.stop(now + rollSec + 0.02);
    } else {
      // Not decoded yet — queue a retry for the next roll, never block.
      void loadClassicDiceRollBuffer(context);
    }

    // ── Layer 2: neon glints ────────────────────────────────────────────────
    // Three digital sparks spread across the roll.  Each uses a fresh
    // BufferSource so start() can be called at a future scheduled time.
    const glintDefs: Array<{ tRel: number; freq: number }> = [
      { tRel: 0.15, freq: 1800 },
      { tRel: 0.45, freq: 2300 },
      { tRel: 0.72, freq: 1500 },
    ];
    for (const { tRel, freq } of glintDefs) {
      const t = now + rollSec * tRel;
      const glint = context.createBufferSource();
      glint.buffer = getNeonNoiseBuffer(context);
      const glintFilter = context.createBiquadFilter();
      glintFilter.type = "bandpass";
      glintFilter.frequency.setValueAtTime(freq, t);
      glintFilter.Q.value = 2.2;
      const glintGain = context.createGain();
      glintGain.gain.setValueAtTime(0.0001, t);
      glintGain.gain.linearRampToValueAtTime(0.15, t + 0.008);
      glintGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.050);
      glint.connect(glintFilter).connect(glintGain).connect(context.destination);
      glint.start(t);
      glint.stop(t + 0.060);
    }

    // ── Layer 3: sci-fi lock-in tone ────────────────────────────────────────
    // Descending sine that sweeps in during the roll's final portion and ends
    // exactly at the animation landing point.  Duration is proportional to
    // the roll (capped at 200 ms) so it always starts after the last glint.
    const resolveDur = Math.min(0.200, rollSec * 0.38);
    const resolveAt  = now + rollSec - resolveDur;
    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(1050, resolveAt);
    tone.frequency.exponentialRampToValueAtTime(310, resolveAt + resolveDur);
    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(0.0001, resolveAt);
    toneGain.gain.exponentialRampToValueAtTime(0.13, resolveAt + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, resolveAt + resolveDur);
    tone.connect(toneGain).connect(context.destination);
    tone.start(resolveAt);
    tone.stop(resolveAt + resolveDur + 0.010);
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

/**
 * Shared building block for `playNeonWelcomeJingle`'s arpeggio notes: a
 * bright triangle tone (the same waveform as Neon's click attack, for family
 * consistency) with a quick, clean decay — a melodic sibling to the noise/
 * sweep layers used elsewhere in this cue. Not reused by any other cue, so
 * tuning it can never affect the click, pawn, or dice sounds above.
 */
function scheduleNeonChimeNote(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay }: { amp: number; freq: number; decay: number },
): void {
  const tone = context.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(freq, startTime);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(amp, startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  tone.connect(gain).connect(bus);
  tone.start(startTime);
  tone.stop(startTime + decay + 0.02);
}

/**
 * Neon board welcome jingle: an energetic cyber "boot-up" chime — a rising
 * filtered-sawtooth power-up sweep, a bright ascending four-note arpeggio
 * (stacked perfect fourths, for an angular, futuristic interval rather than
 * a conventional major scale), digital glint bursts (the exact
 * `getNeonNoiseBuffer` bandpass-burst technique used by the dice roll's
 * Layer 2), and a final bright two-note "system ready" ping.
 *
 * Total length ≈ 1.55s, comfortably inside the 1.5–2.5s brief and dry enough
 * to never bleed into the first dice roll — which always waits for the human
 * player's own tap (player 0 always starts and the "AI roll" effect below
 * explicitly skips activePlayer 0), so there is no automatic roll timer to
 * race against.
 *
 * Plays once when the Game Board screen mounts; gated on the Sound Effects
 * setting via `playSynthCue`, completely independent of the Background Music
 * toggle (see `pauseBgmForGameplay`/`resumeBgmForMenu` below).
 */
export function playNeonWelcomeJingle(): void {
  playSynthCue((context, now) => {
    // ── Power-up sweep — rising sawtooth through a rising bandpass filter ──
    const sweepDur = 0.28;
    const sweep = context.createOscillator();
    sweep.type = "sawtooth";
    sweep.frequency.setValueAtTime(160, now);
    sweep.frequency.exponentialRampToValueAtTime(1100, now + sweepDur);
    const sweepFilter = context.createBiquadFilter();
    sweepFilter.type = "bandpass";
    sweepFilter.Q.value = 0.9;
    sweepFilter.frequency.setValueAtTime(400, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(3200, now + sweepDur);
    const sweepGain = context.createGain();
    sweepGain.gain.setValueAtTime(0.0001, now);
    sweepGain.gain.linearRampToValueAtTime(0.10, now + 0.03);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + sweepDur);
    sweep.connect(sweepFilter).connect(sweepGain).connect(context.destination);
    sweep.start(now);
    sweep.stop(now + sweepDur + 0.02);

    // ── Ascending arpeggio — perfect fourths for an angular, sci-fi shape ──
    const A4 = 440.00, D5 = 587.33, A5 = 880.00, D6 = 1174.66;
    scheduleNeonChimeNote(context, context.destination, now + 0.30, { amp: 0.17, freq: A4, decay: 0.14 });
    scheduleNeonChimeNote(context, context.destination, now + 0.44, { amp: 0.19, freq: D5, decay: 0.14 });
    scheduleNeonChimeNote(context, context.destination, now + 0.58, { amp: 0.21, freq: A5, decay: 0.16 });
    scheduleNeonChimeNote(context, context.destination, now + 0.74, { amp: 0.23, freq: D6, decay: 0.18 });

    // ── Digital glints — same technique as playNeonDiceRoll's Layer 2 ──────
    const glintDefs: Array<{ t: number; freq: number }> = [
      { t: 0.10, freq: 1900 },
      { t: 0.50, freq: 2300 },
      { t: 0.80, freq: 2700 },
    ];
    for (const { t, freq } of glintDefs) {
      const at = now + t;
      const glint = context.createBufferSource();
      glint.buffer = getNeonNoiseBuffer(context);
      const glintFilter = context.createBiquadFilter();
      glintFilter.type = "bandpass";
      glintFilter.frequency.setValueAtTime(freq, at);
      glintFilter.Q.value = 2.2;
      const glintGain = context.createGain();
      glintGain.gain.setValueAtTime(0.0001, at);
      glintGain.gain.linearRampToValueAtTime(0.13, at + 0.008);
      glintGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.050);
      glint.connect(glintFilter).connect(glintGain).connect(context.destination);
      glint.start(at);
      glint.stop(at + 0.06);
    }

    // ── Final "system ready" ping — bright ascending dyad ──────────────────
    const pingAt = now + 0.94;
    const ping1 = context.createOscillator();
    ping1.type = "sine";
    ping1.frequency.setValueAtTime(D6, pingAt);
    const ping1Gain = context.createGain();
    ping1Gain.gain.setValueAtTime(0.0001, pingAt);
    ping1Gain.gain.linearRampToValueAtTime(0.26, pingAt + 0.006);
    ping1Gain.gain.exponentialRampToValueAtTime(0.0001, pingAt + 0.6);
    ping1.connect(ping1Gain).connect(context.destination);
    ping1.start(pingAt);
    ping1.stop(pingAt + 0.62);

    const ping2 = context.createOscillator();
    ping2.type = "sine";
    ping2.frequency.setValueAtTime(1760.00, pingAt);
    const ping2Gain = context.createGain();
    ping2Gain.gain.setValueAtTime(0.0001, pingAt);
    ping2Gain.gain.linearRampToValueAtTime(0.13, pingAt + 0.006);
    ping2Gain.gain.exponentialRampToValueAtTime(0.0001, pingAt + 0.5);
    ping2.connect(ping2Gain).connect(context.destination);
    ping2.start(pingAt);
    ping2.stop(pingAt + 0.52);
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
 * Shared building block for Classic's ceramic pawn family — three-layer
 * synthesis targeting the "Crisp Ceramic + Subtle Cartoon Touch" profile:
 *
 *   Layer 1 — Ceramic clack: tight high-bandpass noise burst (≤12 ms).
 *     A barely-correlated noise source through a narrow bandpass centred
 *     very high (freq×5) gives the sharp, hard "clack" of smooth porcelain
 *     on a solid surface. Fully silent before 12 ms — zero tail.
 *
 *   Layer 2 — Cartoon pop: upward pitch-flick sine (≤35 ms total).
 *     A sine oscillator that sweeps from freq×0.70 up to freq×1.12 in 7 ms
 *     then holds near freq×1.05 until the fast exponential decay ends it.
 *     The upward flick is the "cartoon touch" — a quick, playful rise that
 *     reads as light and bouncy without becoming a slide or boing. Sine
 *     (not triangle) keeps the tone smooth and non-hollow.
 *
 *   Layer 3 — Ceramic ring shimmer: octave-up sine (≤12 ms).
 *     A very quiet, even briefer sine at freq×2.1 adds the high-definition
 *     "ring" of polished ceramic — surface texture only, no perceptible
 *     added length.
 *
 * Total maximum duration at the slowest speed preset: ~35 ms. Absolute zero
 * reverb, no sub-bass, no downward glide, no sustain of any kind.
 * Kept entirely separate from `scheduleWoodKnock` (untouched; powers the
 * generic Classic UI click and capture), so this redesign cannot affect
 * either of those cues.
 */
function scheduleClassicPawnBody(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay, noiseMix = 0.5 }: { amp: number; freq: number; decay: number; noiseMix?: number },
): void {
  // ── Layer 1: Ceramic clack ───────────────────────────────────────────────
  // Tight bandpass very high up the spectrum — not the warm lowpass "thump"
  // of wood, nor the mid-range "knock" of stone. The barely-correlated noise
  // buffer (0.15 smoothing) preserves enough high-frequency content for the
  // bandpass to carve into. noiseDecay is hard-capped at 12 ms so this layer
  // is always the sharpest, driest part of the cue.
  const noise = context.createBufferSource();
  noise.buffer = getClassicPawnNoiseBuffer(context);
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(freq * 5.0, startTime);
  noiseFilter.Q.value = 1.8;
  const noiseGain = context.createGain();
  const noiseDecay = Math.min(decay * 0.45, 0.012);
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(amp * noiseMix, startTime + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noiseDecay);
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(startTime);
  noise.stop(startTime + noiseDecay + 0.006);

  // ── Layer 2: Cartoon pop ─────────────────────────────────────────────────
  // Upward pitch flick (0.70× → 1.12× in 7 ms) is the defining "cartoon
  // touch". The rise is fast enough to feel snappy and tactile rather than a
  // slide; landing near 1.05× then immediately fading keeps it dry — no
  // downward glide, no sustain, no reverb of any kind. The exponential decay
  // to 0.0001 ensures absolute silence before `decay` seconds have elapsed.
  const pop = context.createOscillator();
  pop.type = "sine";
  pop.frequency.setValueAtTime(freq * 0.70, startTime);
  pop.frequency.exponentialRampToValueAtTime(freq * 1.12, startTime + 0.007);
  pop.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + decay);
  const popGain = context.createGain();
  popGain.gain.setValueAtTime(0.0001, startTime);
  popGain.gain.linearRampToValueAtTime(amp * (1 - noiseMix * 0.35), startTime + 0.003);
  popGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  pop.connect(popGain).connect(bus);
  pop.start(startTime);
  pop.stop(startTime + decay + 0.006);

  // ── Layer 3: Ceramic ring shimmer ────────────────────────────────────────
  // Very quiet octave-up sine — the glass-like surface ring of polished
  // ceramic. Hard-capped at 12 ms so it contributes texture, not length.
  const shimmer = context.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(freq * 2.1, startTime);
  const shimmerGain = context.createGain();
  const shimmerDecay = Math.min(decay * 0.42, 0.012);
  shimmerGain.gain.setValueAtTime(0.0001, startTime);
  shimmerGain.gain.linearRampToValueAtTime(amp * 0.13, startTime + 0.001);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + shimmerDecay);
  shimmer.connect(shimmerGain).connect(bus);
  shimmer.start(startTime);
  shimmer.stop(startTime + shimmerDecay + 0.006);
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
    // 680 Hz base: bright enough for ceramic (not heavy/bassy), below the
    // harsh register. noiseMix 0.55 balances the ceramic clack (layer 1)
    // against the cartoon pop body (layer 2). decay 0.026×scale: 26 ms at
    // Normal, 35 ms max at Slow — the pop flick completes in 7 ms and the
    // remainder is a clean, fast exponential fade. Zero tail guaranteed.
    scheduleClassicPawnBody(context, context.destination, now, {
      amp: 0.38, freq: 680 * jitter, decay: 0.026 * scale, noiseMix: 0.55,
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

/**
 * Shared building block for `playClassicWelcomeJingle`'s marimba-style
 * notes: a sine fundamental (the mallet bar's main pitch) plus a quiet,
 * fast-decaying overtone near 4x the fundamental (a mallet instrument's
 * bright upper partial, which always fades far quicker than the main
 * pitch), with a hairline high-passed noise "chiff" on the attack standing
 * in for the mallet strike. Kept fully separate from `scheduleWoodKnock`/
 * `scheduleClassicPawnBody` (both untouched) — this is a melodic mallet
 * voice, not a contact knock, so tuning it cannot affect the click,
 * capture, or pawn cues built on those helpers.
 */
function scheduleMarimbaNote(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  { amp, freq, decay }: { amp: number; freq: number; decay: number },
): void {
  // Mallet attack chiff — a hairline, near-instant noise tick, much shorter
  // and quieter than the wood family's own contact transient.
  const chiff = context.createBufferSource();
  chiff.buffer = getWoodNoiseBuffer(context);
  const chiffFilter = context.createBiquadFilter();
  chiffFilter.type = "bandpass";
  chiffFilter.frequency.setValueAtTime(freq * 3.2, startTime);
  chiffFilter.Q.value = 1.2;
  const chiffGain = context.createGain();
  chiffGain.gain.setValueAtTime(0.0001, startTime);
  chiffGain.gain.linearRampToValueAtTime(amp * 0.28, startTime + 0.002);
  chiffGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.014);
  chiff.connect(chiffFilter).connect(chiffGain).connect(bus);
  chiff.start(startTime);
  chiff.stop(startTime + 0.02);

  // Fundamental — the mallet bar's main pitch.
  const body = context.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(freq, startTime);
  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(amp, startTime + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  body.connect(bodyGain).connect(bus);
  body.start(startTime);
  body.stop(startTime + decay + 0.02);

  // Bright, fast-decaying upper partial — marimba bars ring a quiet high
  // overtone that fades far quicker than the fundamental, giving the
  // "wooden mallet" identity rather than a flute-like pure tone.
  const overtone = context.createOscillator();
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(freq * 3.93, startTime);
  const overtoneGain = context.createGain();
  const overtoneDecay = Math.min(decay * 0.4, 0.09);
  overtoneGain.gain.setValueAtTime(0.0001, startTime);
  overtoneGain.gain.linearRampToValueAtTime(amp * 0.22, startTime + 0.004);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + overtoneDecay);
  overtone.connect(overtoneGain).connect(bus);
  overtone.start(startTime);
  overtone.stop(startTime + overtoneDecay + 0.02);
}

/**
 * Classic board welcome jingle: a clean, upbeat marimba fanfare that greets
 * the player the instant a match begins — a "do-mi-sol" bugle-call shape
 * with a short turn and a held, harmonized landing note (fifth below the
 * top note, filling it into a small chord). Entirely dry, with no reverb or
 * delay of any kind — matching the Classic family's established "no echo"
 * direction (see `scheduleClassicPawnBody`).
 *
 * Total length ≈ 1.8s, comfortably inside the 1.5–2.5s brief and dry enough
 * to never bleed into the first dice roll — which always waits for the human
 * player's own tap (player 0 always starts and the "AI roll" effect below
 * explicitly skips activePlayer 0), so there is no automatic roll timer to
 * race against.
 *
 * Plays once when the Game Board screen mounts; gated on the Sound Effects
 * setting via `playSynthCue`, completely independent of the Background Music
 * toggle (see `pauseBgmForGameplay`/`resumeBgmForMenu` below).
 */
export function playClassicWelcomeJingle(): void {
  playSynthCue((context, now) => {
    const PICKUP_G4 = 392.00;
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.50;

    scheduleMarimbaNote(context, context.destination, now, { amp: 0.11, freq: PICKUP_G4, decay: 0.09 });
    scheduleMarimbaNote(context, context.destination, now + 0.11, { amp: 0.22, freq: C5, decay: 0.18 });
    scheduleMarimbaNote(context, context.destination, now + 0.27, { amp: 0.24, freq: E5, decay: 0.18 });
    scheduleMarimbaNote(context, context.destination, now + 0.43, { amp: 0.26, freq: G5, decay: 0.20 });
    scheduleMarimbaNote(context, context.destination, now + 0.63, { amp: 0.20, freq: E5, decay: 0.16 });
    // Held landing chord — the fanfare's resolution.
    scheduleMarimbaNote(context, context.destination, now + 0.81, { amp: 0.30, freq: C6, decay: 1.0 });
    scheduleMarimbaNote(context, context.destination, now + 0.81, { amp: 0.15, freq: G5, decay: 0.85 });
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

/**
 * Shared building block for `playDzWelcomeJingle`'s notes: the same warm
 * two-partial body (fundamental + a fifth above) as `scheduleDzKnock`, tuned
 * with a longer, ringing decay plus a bright inharmonic "ting" so each note
 * reads as a small struck-metal chime (finger-cymbal/sagat family) rather
 * than a resonant knock. Deliberately its own helper — not `scheduleDzKnock`
 * or `scheduleDzPlop` (both untouched) — since a melodic run needs a longer
 * ring than either of those contact envelopes was tuned for.
 */
function scheduleDzChimeNote(
  context: AudioContext,
  bus: AudioNode,
  startTime: number,
  {
    amp, freq, decay, shimmer,
  }: { amp: number; freq: number; decay: number; shimmer?: { amp: number; freq: number; decay: number } },
): void {
  // Fundamental — a struck, bell-like body.
  const body = context.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(freq, startTime);
  const bodyGain = context.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(amp, startTime + 0.005);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  body.connect(bodyGain).connect(bus);
  body.start(startTime);
  body.stop(startTime + decay + 0.02);

  // A fifth above, quieter and shorter — the same resonant-body ratio as
  // scheduleDzKnock, giving the note a struck-metal shimmer instead of a
  // flat single pitch.
  const overtone = context.createOscillator();
  overtone.type = "triangle";
  overtone.frequency.setValueAtTime(freq * 1.5, startTime);
  const overtoneGain = context.createGain();
  const overtoneDecay = decay * 0.6;
  overtoneGain.gain.setValueAtTime(0.0001, startTime);
  overtoneGain.gain.linearRampToValueAtTime(amp * 0.30, startTime + 0.004);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + overtoneDecay);
  overtone.connect(overtoneGain).connect(bus);
  overtone.start(startTime);
  overtone.stop(startTime + overtoneDecay + 0.02);

  // Bright inharmonic "ting" — a small metallic bell/finger-cymbal accent on
  // every note, so the whole run reads as one coherent struck-metal chime.
  const ting = context.createOscillator();
  ting.type = "sine";
  ting.frequency.setValueAtTime(freq * 3.0, startTime);
  const tingGain = context.createGain();
  const tingDecay = Math.min(decay * 0.35, 0.08);
  tingGain.gain.setValueAtTime(0.0001, startTime);
  tingGain.gain.linearRampToValueAtTime(amp * 0.20, startTime + 0.003);
  tingGain.gain.exponentialRampToValueAtTime(0.0001, startTime + tingDecay);
  ting.connect(tingGain).connect(bus);
  ting.start(startTime);
  ting.stop(startTime + tingDecay + 0.02);

  // Gold-glint shimmer — only on notes that request it (the landing note),
  // the same closely-detuned high-sine-pair motif used by every other DZ cue.
  if (shimmer) {
    for (const [index, f] of [shimmer.freq, shimmer.freq * 1.025].entries()) {
      const glint = context.createOscillator();
      glint.type = "sine";
      glint.frequency.setValueAtTime(f, startTime);
      const glintGain = context.createGain();
      const gain = shimmer.amp * (index === 0 ? 1 : 0.7);
      glintGain.gain.setValueAtTime(0.0001, startTime);
      glintGain.gain.linearRampToValueAtTime(gain, startTime + 0.004);
      glintGain.gain.exponentialRampToValueAtTime(0.0001, startTime + shimmer.decay);
      glint.connect(glintGain).connect(bus);
      glint.start(startTime);
      glint.stop(startTime + shimmer.decay + 0.02);
    }
  }
}

/**
 * DZ board welcome jingle: a cheerful, rhythmic chime with a subtle
 * Algerian/oriental melodic accent — a Hijaz-flavored tetrachord (root, flat
 * second, augmented second, perfect fourth: the half-step / augmented-second
 * / half-step pattern behind Middle Eastern melody's signature color),
 * opened with a rhythmic tonic pulse and closed on the octave with the DZ
 * family's own gold-glint shimmer.
 *
 * Total length ≈ 1.8s, comfortably inside the 1.5–2.5s brief and dry enough
 * to never bleed into the first dice roll — which always waits for the human
 * player's own tap (player 0 always starts and the "AI roll" effect below
 * explicitly skips activePlayer 0), so there is no automatic roll timer to
 * race against.
 *
 * Plays once when the Game Board screen mounts; gated on the Sound Effects
 * setting via `playSynthCue`, completely independent of the Background Music
 * toggle (see `pauseBgmForGameplay`/`resumeBgmForMenu` below).
 */
export function playDzWelcomeJingle(): void {
  playSynthCue((context, now) => {
    const D4 = 293.66, Eb4 = 311.13, FSharp4 = 369.99, G4 = 392.00, D5 = 587.33;

    // Rhythmic pulse on the tonic — the "rhythmic chime" character.
    scheduleDzChimeNote(context, context.destination, now, { amp: 0.24, freq: D4, decay: 0.15 });
    scheduleDzChimeNote(context, context.destination, now + 0.15, { amp: 0.19, freq: D4, decay: 0.13 });
    // Hijaz tetrachord run: half-step, augmented second, half-step.
    scheduleDzChimeNote(context, context.destination, now + 0.31, { amp: 0.22, freq: Eb4, decay: 0.15 });
    scheduleDzChimeNote(context, context.destination, now + 0.48, { amp: 0.25, freq: FSharp4, decay: 0.17 });
    scheduleDzChimeNote(context, context.destination, now + 0.67, { amp: 0.24, freq: G4, decay: 0.17 });
    // Landing on the octave, held, with the family's gold-glint signature.
    scheduleDzChimeNote(context, context.destination, now + 0.87, {
      amp: 0.30, freq: D5, decay: 0.90,
      shimmer: { amp: 0.09, freq: 2600, decay: 0.7 },
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

// ─── Background Music (BGM) ────────────────────────────────────────────────
// A single seamless ambient loop, completely independent from the "Sound
// Effects" system above: its own localStorage key, its own enabled flag, and
// its own playback lifecycle. Bound to the "موسيقى الخلفية" (Background
// Music) toggle in Settings — nothing else starts or stops it, and it never
// checks `soundEnabled`.
//
// Loop technique: native `loop = true` playback is only gapless if the
// source file's own start/end samples line up exactly, which a generated
// asset can't guarantee. Instead each pass through the buffer is scheduled
// as its own BufferSource with a short overlap-crossfade into the next pass
// (see `scheduleBgmLoopIteration`) — the standard technique for an audibly
// seamless loop (no gap, no click, no pop) regardless of the source
// material's own edges.

const BGM_STORAGE_KEY = "ludo-dz:bgm-enabled";
const BGM_URL = "sounds/bgm-ambient-loop.mp3";
const BGM_TARGET_VOLUME = 0.20;      // balanced, non-distracting bed level per spec (~0.20)
const BGM_FADE_IN_SEC = 1.2;
const BGM_FADE_OUT_SEC = 1.0;
const BGM_LOOP_CROSSFADE_SEC = 1.6;  // overlap window that hides any seam at the loop boundary
const BGM_SCHEDULE_LOOKAHEAD_SEC = 3; // JS-timer lead time before each pass's actual start

function readStoredBgmPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(BGM_STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

let bgmEnabled = readStoredBgmPreference();
let bgmBuffer: AudioBuffer | null = null;
let bgmLoadPromise: Promise<AudioBuffer | null> | null = null;
let bgmMasterGain: GainNode | null = null;
let bgmActiveSources: AudioBufferSourceNode[] = [];
let bgmSchedulerTimer: ReturnType<typeof setTimeout> | null = null;
let bgmIsRunning = false;

/** Current on/off state of the "Background Music" setting (persisted across reloads, independent of Sound Effects). */
export function isBgmEnabled(): boolean {
  return bgmEnabled;
}

function loadBgmBuffer(context: AudioContext): Promise<AudioBuffer | null> {
  if (bgmBuffer) return Promise.resolve(bgmBuffer);
  if (bgmLoadPromise) return bgmLoadPromise;

  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  bgmLoadPromise = fetch(`${base}${BGM_URL}`)
    .then((response) => {
      if (!response.ok) throw new Error(`bgm fetch failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      bgmBuffer = buffer;
      return buffer;
    })
    .catch(() => {
      // A failed fetch/decode must never crash the game. Clear the promise so
      // a later attempt (e.g. the next toggle-on) can retry.
      bgmLoadPromise = null;
      return null;
    });

  return bgmLoadPromise;
}

// Kick off the fetch/decode the moment this module is first imported — same
// warm-load pattern as the Classic dice sample above — so playback can start
// with zero latency the instant it's actually allowed to (first gesture).
if (typeof window !== "undefined") {
  const warmBgmContext = getSynthAudioContext();
  if (warmBgmContext) void loadBgmBuffer(warmBgmContext);
}

/**
 * Schedules one pass through the BGM buffer starting at `startTime`, and
 * recursively schedules the next pass shortly before this one ends. Each
 * pass gets its own gain envelope that fades in across the overlap with the
 * previous pass and fades out across the overlap with the next one — an
 * overlap-crossfade loop, so the seam is always inaudible regardless of
 * whether the source file's raw start/end samples actually match.
 */
function scheduleBgmLoopIteration(context: AudioContext, startTime: number): void {
  const buffer = bgmBuffer;
  if (!buffer || !bgmMasterGain) return;

  const duration = buffer.duration;
  const crossfade = Math.min(BGM_LOOP_CROSSFADE_SEC, duration * 0.4);
  const isFirstIteration = bgmActiveSources.length === 0;

  const source = context.createBufferSource();
  source.buffer = buffer;
  const iterGain = context.createGain();

  // Fade this pass in across the overlap with the previous one. The very
  // first pass of a session skips this — `bgmMasterGain` already owns the
  // "coming in from silence" fade-in, so a second fade here would just dull
  // the attack for no reason.
  if (isFirstIteration) {
    iterGain.gain.setValueAtTime(1, startTime);
  } else {
    iterGain.gain.setValueAtTime(0.0001, startTime);
    iterGain.gain.linearRampToValueAtTime(1, startTime + crossfade);
  }
  // Fade this pass out across its own overlap with the next one.
  iterGain.gain.setValueAtTime(1, startTime + duration - crossfade);
  iterGain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

  source.connect(iterGain).connect(bgmMasterGain);
  source.start(startTime);
  source.stop(startTime + duration + 0.05);
  bgmActiveSources.push(source);
  source.onended = () => {
    bgmActiveSources = bgmActiveSources.filter((s) => s !== source);
  };

  const nextStart = startTime + duration - crossfade;
  const delayMs = Math.max(0, (nextStart - context.currentTime - BGM_SCHEDULE_LOOKAHEAD_SEC) * 1000);
  bgmSchedulerTimer = setTimeout(() => {
    if (bgmIsRunning) scheduleBgmLoopIteration(context, nextStart);
  }, delayMs);
}

/**
 * Starts BGM playback with a smooth fade-in to the ambient target volume.
 * No-op if already running or currently disabled. Must be called during/
 * after a real user gesture so `context.resume()` (called by the caller)
 * satisfies autoplay policy — see `setBgmEnabled` and the first-interaction
 * listener below.
 */
function startBgm(context: AudioContext): void {
  if (bgmIsRunning || !bgmEnabled) return;

  const buffer = bgmBuffer;
  if (!buffer) {
    // Not decoded yet — retry once the load settles, if still wanted.
    void loadBgmBuffer(context).then((loaded) => {
      if (loaded && bgmEnabled && !bgmIsRunning) startBgm(context);
    });
    return;
  }

  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, context.currentTime);
  masterGain.gain.linearRampToValueAtTime(BGM_TARGET_VOLUME, context.currentTime + BGM_FADE_IN_SEC);

  // Gentle high-shelf cut carves out the mid-high range so pawn taps and
  // dice rolls stay clearly audible on top of the bed instead of getting
  // masked by it — a static "make room in the mix" EQ, always active while
  // BGM plays, applied once here rather than relying solely on the source
  // file's own mix.
  const toneFilter = context.createBiquadFilter();
  toneFilter.type = "highshelf";
  toneFilter.frequency.setValueAtTime(1600, context.currentTime);
  toneFilter.gain.setValueAtTime(-7, context.currentTime);

  masterGain.connect(toneFilter).connect(context.destination);
  bgmMasterGain = masterGain;
  bgmActiveSources = [];
  bgmIsRunning = true;
  scheduleBgmLoopIteration(context, context.currentTime);
}

/**
 * Fades BGM out over `BGM_FADE_OUT_SEC`, then stops and releases every
 * active source. No-op if BGM isn't running. Captures the fading gain node
 * and sources in local closures before resetting the module's live state, so
 * a quick toggle-off-then-on-again starts a clean new session instead of
 * racing with this fade-out's cleanup.
 */
function stopBgm(context: AudioContext): void {
  if (!bgmIsRunning) return;
  bgmIsRunning = false;

  const fadingGain = bgmMasterGain;
  const fadingSources = bgmActiveSources;
  bgmMasterGain = null;
  bgmActiveSources = [];
  if (bgmSchedulerTimer !== null) {
    clearTimeout(bgmSchedulerTimer);
    bgmSchedulerTimer = null;
  }

  if (fadingGain) {
    const now = context.currentTime;
    const current = fadingGain.gain.value;
    fadingGain.gain.cancelScheduledValues(now);
    fadingGain.gain.setValueAtTime(current, now);
    fadingGain.gain.linearRampToValueAtTime(0.0001, now + BGM_FADE_OUT_SEC);
  }

  setTimeout(() => {
    for (const src of fadingSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    if (fadingGain) {
      try { fadingGain.disconnect(); } catch { /* already disconnected */ }
    }
  }, BGM_FADE_OUT_SEC * 1000 + 60);
}

let bgmFirstGestureBound = false;

// Browsers only grant the "user activation" that lets a freshly created
// AudioContext leave its "suspended" state on specific trusted input events —
// and a press's *start* (`pointerdown`, `touchstart`, `mousedown`) is
// notably NOT one of them in Chromium/WebKit; only a press's *release*
// (`click`, and `keydown` for keyboards) reliably qualifies. `touchstart` is
// still included as a belt-and-braces attempt since some mobile browsers do
// accept it, and a harmless extra `resume()` call costs nothing. This is why
// the listener below tries `resume()` again on every one of these event
// types instead of unbinding everything after whichever fires first: a
// single tap dispatches `pointerdown`/`touchstart` *before* `click`, so
// tearing down on that first (possibly-insufficient) event would mean the
// later, actually-sufficient `click` is never seen.
const BGM_UNLOCK_EVENTS = ["pointerdown", "touchstart", "click", "keydown"] as const;

/**
 * Registers listeners for the first several trusted interaction types
 * anywhere in the app (capture phase, so an element's own
 * `stopPropagation()` can't hide the gesture from this). Browsers block
 * audio until a real gesture; when a returning player's saved preference is
 * ON, this is what restores BGM the moment they first interact with
 * anything — splash, welcome menu, the loading screen, anywhere — without
 * requiring a trip back into Settings. Listeners stay bound, retrying
 * `resume()` on each qualifying event, until the AudioContext actually
 * reports "running", then remove themselves for good.
 */
function bindBgmFirstGestureListener(): void {
  if (bgmFirstGestureBound || typeof document === "undefined") return;
  bgmFirstGestureBound = true;

  const unbindAll = () => {
    for (const type of BGM_UNLOCK_EVENTS) {
      document.removeEventListener(type, onFirstGesture, { capture: true });
    }
  };

  const onFirstGesture = () => {
    const context = getSynthAudioContext();
    if (!context) {
      unbindAll();
      return;
    }
    void context.resume().then(() => {
      // This particular event type may not have satisfied the browser's
      // autoplay policy (e.g. a `pointerdown` that isn't itself a valid
      // activation trigger) — if the context is still suspended, leave the
      // listeners bound so the next qualifying gesture gets its own chance
      // instead of being silently missed.
      if (context.state !== "running") return;
      unbindAll();
      if (bgmEnabled) startBgm(context);
    }).catch(() => {
      // Leave listeners bound; a later gesture may still succeed.
    });
  };

  for (const type of BGM_UNLOCK_EVENTS) {
    document.addEventListener(type, onFirstGesture, { capture: true, passive: true });
  }
}

if (typeof window !== "undefined") {
  bindBgmFirstGestureListener();
}

/**
 * Update the "Background Music" setting. Persists to localStorage under its
 * own key, completely independent of the Sound Effects setting, and
 * immediately starts (fade-in) or stops (fade-out) playback. Call this
 * directly from the Settings toggle's click handler — invoking it inside a
 * real gesture lets `context.resume()` satisfy the browser's autoplay
 * policy synchronously within that same event.
 */
export function setBgmEnabled(enabled: boolean): void {
  bgmEnabled = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BGM_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // ignore storage failures (e.g. private browsing)
    }
  }

  const context = getSynthAudioContext();
  if (!context) return;

  if (enabled) {
    void context.resume().then(() => startBgm(context)).catch(() => {});
  } else {
    stopBgm(context);
  }
}

/**
 * Suspend Background Music for active gameplay, without touching the user's
 * persisted "Background Music" preference at all — a purely transient,
 * screen-scoped pause. Call this once when the Game Board screen mounts.
 * Reuses `stopBgm`'s existing fade-out (see `BGM_FADE_OUT_SEC`), so the menu
 * loop ducks out smoothly rather than cutting off mid-note, and is a no-op
 * if BGM isn't currently playing (e.g. the setting is already off).
 */
export function pauseBgmForGameplay(): void {
  const context = getSynthAudioContext();
  if (!context) return;
  stopBgm(context);
}

/**
 * Resume Background Music when leaving gameplay back to Home/Menu screens —
 * but only if the user's "Background Music" setting is still on; otherwise
 * this is a no-op, so a player who muted BGM mid-session never has it
 * reappear on its own. Call this once when the Game Board screen unmounts
 * (header back button or the victory modal's "Menu" button — both leave
 * `screen: 'game'`; "Play Again" restarts in place and never unmounts this
 * screen, so it correctly never triggers this). Mirrors the same
 * `resume()` + `startBgm` sequence `setBgmEnabled(true)` already uses, so it
 * shares the identical fade-in behavior as toggling BGM on from Settings.
 */
export function resumeBgmForMenu(): void {
  if (!bgmEnabled) return;
  const context = getSynthAudioContext();
  if (!context) return;
  void context.resume().then(() => startBgm(context)).catch(() => {});
}
