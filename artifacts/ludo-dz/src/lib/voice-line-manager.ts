import { setSfxDucking } from './sound-manager';

// ─────────────────────────────────────────────────────────────────────────────
// Event-isolated voice commentary
//
// Every event owns one dedicated folder under `src/assets/audio/voice/<event>/`.
// Every audio file inside that folder is the event's clip pool, and no clip is
// ever shared between events. Selecting a line is a uniform random pick from
// that event's own pool — no weights, no mood tags, no cross-event eligibility.
// The only anti-repetition rule is: never play the exact same clip twice in a
// row within the same event's pool.
//
// Events are registered one at a time. `VOICE_EVENTS` is the single source of
// truth; adding an event here (with its Arabic key + folder) is all that's
// needed to bring its pool online.
// ─────────────────────────────────────────────────────────────────────────────

/** Registered voice events. The key is the Arabic folder name under `voice/`. */
export const VOICE_EVENTS = ['بداية_اللعبة', 'إخراج_بيدق'] as const;
export type VoiceLineEvent = (typeof VOICE_EVENTS)[number];

/** Arabic display label for each registered event. */
export const VOICE_EVENT_LABELS: Readonly<Record<VoiceLineEvent, string>> = {
  'بداية_اللعبة': 'بداية اللعبة',
  'إخراج_بيدق': 'إخراج بيدق',
};

// Trigger identifiers still referenced by existing game logic that have not
// been migrated to an isolated Arabic pool yet. They resolve to an empty pool,
// so triggering them is a safe no-op until their event is registered above.
const UNMIGRATED_EVENTS = [
  'win',
  'opponent_near_win',
  'rolled_six',
  'consecutive_sixes_2',
  'forfeit_three_sixes',
  'no_valid_moves',
  'extra_turn',
  'piece_home',
  'capture_by_me',
  'captured_by_opponent',
  'laugh_mock',
  'near_miss',
  'blocked_path',
  'perfect_escape',
  'danger',
  'danger_escape',
  'safe_gathering',
  'safe_zone_entry',
  'turn_reminder',
  'ai_thinking',
  'final_stretch',
  'opponent_captured',
] as const;

/** Accepted trigger identifiers: registered events + not-yet-migrated ones. */
export type VoiceLineTrigger = VoiceLineEvent | (typeof UNMIGRATED_EVENTS)[number];

const VOICE_FILES = import.meta.glob('../assets/audio/voice/**/*.{mp3,ogg,wav,m4a,aac,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const MAX_QUEUE_SIZE = 2;
const DEFAULT_VOICE_VOLUME = 0.9;
const VOICE_ENABLED_STORAGE_KEY = 'ludo-dz:voice-commentary-enabled';
const VOICE_VOLUME_STORAGE_KEY = 'ludo-dz:voice-commentary-volume';

// ─────────────────────────────────────────────────────────────────────────────
// Reply (ردود) commentary
//
// A reply is a secondary line that plays *immediately after* a replyable event's
// primary line, as a direct back-and-forth. Replies are probabilistic and gated
// by audio activity so they feel like an occasional charming surprise rather than
// audio clutter during busy play:
//
// 1. Probability gate: `REPLY_CHANCE` (e.g. 0.12, roughly 1 in 8 triggers).
// 2. Quiet moment gate: `REPLY_QUIET_WINDOW_MS` (e.g. 2500 ms). A reply is only
//    scheduled if no other voice line is currently playing, queued, pending/reserved,
//    or was active/played within the quiet window duration.
//
// It reuses the same isolated-folder model: the reply pool lives under
// `voice/ردود/<event>/` and is shared across all players (the audio content is
// generic; only the speaking indicator is tied to a specific player). No clip is
// shared between events, nor between an event and its own replies, and the
// no-immediate-repeat rule applies within each reply pool.
//
// The randomness in a reply consists of (a) whether a reply is scheduled at all
// (gated by probability + quiet moment check), (b) which clip is picked from the pool,
// and (c) which player answers — a uniform pick among the players currently in the
// game, excluding whoever just acted.
//
// To enable replies for a new event, add its key to `REPLYABLE_EVENTS` and drop
// clips into `voice/ردود/<event>/` — nothing else changes. The pool is auto-built
// and the constants below apply uniformly to every replyable event.
//
// Scheduling model (see the "reply reservation" section further down):
// the reply is decided and *preloaded* the moment its primary line starts, but
// it is fired from the primary line's own end-of-playback callback — never from
// a wall-clock timer racing the primary, and never as an ordinary, droppable
// queue entry. That is what makes it land right after the primary regardless of
// what the player is doing (rolling, moving pawns, tapping UI) in between.
//
// The only ways a reply does not happen are: the probability roll misses,
// the quiet moment gate fails (recent audio activity), an empty `voice/ردود/<event>/`
// folder, or no eligible responder (the caller passed no `playersInGame`, or the
// acting player is the only one).
// ─────────────────────────────────────────────────────────────────────────────

/** Tunable probability (0.0 to 1.0) of scheduling a reply for replyable events. */
export const REPLY_CHANCE = 0.12;

/**
 * Tunable duration (in milliseconds) for the "quiet moment" gate.
 * Skip reply scheduling if any voice line was playing, queued, or recently active within this window.
 */
export const REPLY_QUIET_WINDOW_MS = 2500;

/**
 * Tunable threshold (in milliseconds) for queuing a cross-turn `إخراج_بيدق` line (Scenario B).
 * If the currently playing line is expected to finish within this wait window, the new exit line is queued;
 * if it will take longer, the new exit line is cancelled to prevent stale audio backlog.
 */
export const EXIT_QUEUE_MAX_WAIT_MS = 1200;

// Conversational beat between the primary line ending and the reply starting.
// Measured from the primary's END (not its start), so it is a real pause in the
// dialogue rather than a race against the primary's own length.
const REPLY_GAP_MIN_MS = 180;
const REPLY_GAP_MAX_MS = 420;

// Safety net so the queue can never wedge: if an element never fires `ended`
// (decode error, an OS-level audio-focus interruption on Android, a stalled
// media fetch), this drains the queue anyway shortly after the clip's own
// duration has elapsed.
const VOICE_WATCHDOG_GRACE_MS = 600;
const VOICE_WATCHDOG_FALLBACK_MS = 15000; // used only while duration is unknown

/** Events that may produce a reply after their primary line plays. */
const REPLYABLE_EVENTS: Readonly<Partial<Record<VoiceLineEvent, boolean>>> = {
  'إخراج_بيدق': true,
};

// ─── Speaking indicator ───────────────────────────────────────────────────────
// The visual "someone is speaking" state. Whenever a line starts playing for a
// specific player, a single speaker is broadcast; when it ends (or a line with
// no speaker plays), the speaker is cleared. UI subscribes via `subscribeSpeaking`.
// `kind` lets the UI treat a reply ("this player is answering back") with a
// stronger, duel-flavoured treatment than an ordinary primary line.
export type SpeakingKind = 'primary' | 'reply';
export type SpeakingState = { player: number; kind: SpeakingKind } | null;
type SpeakingListener = (state: SpeakingState) => void;
const speakingListeners = new Set<SpeakingListener>();
let currentSpeaking: SpeakingState = null;

/** Options that accompany a single `playVoiceLine` call. */
export interface VoiceLineContext {
  /** The player this commentary belongs to — drives the speaking indicator. */
  speaker?: number;
  /** Players currently in the game — required only to target a reply. */
  playersInGame?: readonly number[];
}

/**
 * Subscribe to speaking-state changes. The listener is invoked immediately with
 * any in-progress speaker and then on every change; returns an unsubscribe fn.
 * The state is `{ player, kind }` while a line for that player is audible, else `null`.
 */
export function subscribeSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener);
  if (currentSpeaking) listener(currentSpeaking);
  return () => { speakingListeners.delete(listener); };
}

function notifySpeaking(state: SpeakingState): void {
  if (currentSpeaking?.player === state?.player && currentSpeaking?.kind === state?.kind) return;
  currentSpeaking = state;
  speakingListeners.forEach(listener => listener(state));
}

interface VoiceClip {
  path: string;
  url: string;
}

// One isolated pool per registered event, built from that event's folder only.
const eventPools = new Map<VoiceLineEvent, VoiceClip[]>();
const lastPlayed = new Map<VoiceLineEvent, string>();

for (const event of VOICE_EVENTS) {
  const pool = Object.entries(VOICE_FILES)
    .filter(([path]) => path.includes(`/voice/${event}/`))
    .map(([path, url]) => ({ path, url }))
    .sort((a, b) => a.path.localeCompare(b.path));
  eventPools.set(event, pool);
}

// One isolated reply pool per registered event, built from `ردود/<event>/`.
const eventReplyPools = new Map<VoiceLineEvent, VoiceClip[]>();
const lastPlayedReply = new Map<VoiceLineEvent, string>();

for (const event of VOICE_EVENTS) {
  const pool = Object.entries(VOICE_FILES)
    .filter(([path]) => path.includes(`/voice/ردود/${event}/`))
    .map(([path, url]) => ({ path, url }))
    .sort((a, b) => a.path.localeCompare(b.path));
  eventReplyPools.set(event, pool);
}

function clampVoiceVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_VOICE_VOLUME;
  return Math.min(1, Math.max(0, volume));
}

function readStoredVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(VOICE_ENABLED_STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function readStoredVoiceVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOICE_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOICE_VOLUME_STORAGE_KEY);
    return raw === null ? DEFAULT_VOICE_VOLUME : clampVoiceVolume(Number(raw));
  } catch {
    return DEFAULT_VOICE_VOLUME;
  }
}

let voiceLinesEnabled = readStoredVoiceEnabled();
let voiceLineVolume = readStoredVoiceVolume();
let activeAudio: HTMLAudioElement | null = null;
let activeWatchdog: ReturnType<typeof setTimeout> | null = null;
let lastVoiceActivityEndTime = 0;

interface ActiveLineInfo {
  event: VoiceLineTrigger | 'reply';
  speaker?: number;
  startTime: number;
  durationMs: number | null;
  audio: HTMLAudioElement;
}

let activeLineInfo: ActiveLineInfo | null = null;
let lastExitSpeaker: number | null = null;

function getActiveLineRemainingMs(): number {
  if (!activeLineInfo) return 0;
  const elapsed = Date.now() - activeLineInfo.startTime;
  const duration = activeLineInfo.durationMs ?? 2000;
  return Math.max(0, duration - elapsed);
}

// A queued line is either a registered/unmigrated event, or a reply line. Both
// carry their options so the speaking indicator and reply targeting still work
// after they drain through the no-overlap queue.
type QueuedLine =
  | { kind: 'event'; event: VoiceLineTrigger; options: VoiceLineContext }
  | { kind: 'reply'; replyEvent: VoiceLineEvent; options: VoiceLineContext };

let queue: QueuedLine[] = [];

// ─── Reply reservation ────────────────────────────────────────────────────────
// The reply is not a queue entry. It is a slot reserved on the primary line
// itself (`owner`), decided + preloaded at the primary's start and consumed by
// the primary's end callback. Two consequences that matter:
//   • it can never be dropped by MAX_QUEUE_SIZE, and never has to wait behind
//     unrelated lines that happen to be queued;
//   • the short gap between primary and reply counts as "voice busy", so a
//     gameplay-triggered line firing in that window queues instead of stealing
//     the slot, and the SFX duck holds across the whole exchange.
interface PendingReply {
  event: VoiceLineEvent;
  speaker: number;
  clip: VoiceClip;
  /** Element created (and `load()`-ed) up front so the reply starts instantly. */
  audio: HTMLAudioElement;
  /** The primary element whose end fires this reply. */
  owner: HTMLAudioElement;
}
let pendingReply: PendingReply | null = null;
let replyGapTimer: ReturnType<typeof setTimeout> | null = null;

/** True while a line is audible, or while the primary→reply gap is running. */
function isVoiceBusy(): boolean {
  return activeAudio !== null || replyGapTimer !== null;
}

/**
 * Check if the audio system is currently busy or was active within the quiet window.
 * Used at reply scheduling time to ensure replies only occur during calm stretches.
 *
 * @param owner - Optional HTMLAudioElement of the primary voice line that is currently starting.
 *                Passing `owner` ensures the line itself is not misidentified as "another active line".
 */
export function isAudioRecentlyActive(owner?: HTMLAudioElement): boolean {
  if (activeAudio !== null && activeAudio !== owner) return true;
  if (pendingReply !== null && pendingReply.owner !== owner) return true;
  if (replyGapTimer !== null) return true;
  if (queue.length > 0) return true;
  if (Date.now() - lastVoiceActivityEndTime < REPLY_QUIET_WINDOW_MS) return true;
  return false;
}

/**
 * Keep the SFX duck aligned with voice activity. Ducking is level-based (not a
 * per-clip on/off), so back-to-back lines and the primary→reply gap hold one
 * continuous duck instead of bouncing the game's sound effects up and down.
 */
function syncDucking(): void {
  setSfxDucking(isVoiceBusy());
}

function clearWatchdog(): void {
  if (activeWatchdog === null) return;
  clearTimeout(activeWatchdog);
  activeWatchdog = null;
}

function clearPendingReply(): void {
  if (!pendingReply) return;
  try { pendingReply.audio.pause(); } catch { /* nothing to pause */ }
  pendingReply = null;
}

function clearReplyGap(): void {
  if (replyGapTimer === null) return;
  clearTimeout(replyGapTimer);
  replyGapTimer = null;
}

function isRegisteredEvent(event: VoiceLineTrigger): event is VoiceLineEvent {
  return (VOICE_EVENTS as readonly string[]).includes(event);
}

/** Uniform random pick from the event's own pool, skipping the last clip played. */
function pickRandomClip(event: VoiceLineEvent): VoiceClip | null {
  const pool = eventPools.get(event) ?? [];
  if (pool.length === 0) return null;
  if (pool.length === 1) {
    lastPlayed.set(event, pool[0].url);
    return pool[0];
  }

  const previous = lastPlayed.get(event);
  const candidates = previous ? pool.filter(clip => clip.url !== previous) : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  lastPlayed.set(event, picked.url);
  return picked;
}

/** Uniform random pick from the event's reply pool, skipping the last reply. */
function pickRandomReply(event: VoiceLineEvent): VoiceClip | null {
  const pool = eventReplyPools.get(event) ?? [];
  if (pool.length === 0) return null;
  if (pool.length === 1) {
    lastPlayedReply.set(event, pool[0].url);
    return pool[0];
  }

  const previous = lastPlayedReply.get(event);
  const candidates = previous ? pool.filter(clip => clip.url !== previous) : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  lastPlayedReply.set(event, picked.url);
  return picked;
}

function isReplyable(event: VoiceLineTrigger): event is VoiceLineEvent {
  return isRegisteredEvent(event) && REPLYABLE_EVENTS[event] === true;
}

/**
 * Reserve + preload the reply for a primary line that is starting now.
 *
 * Replies are probabilistic and gated by audio activity:
 * 1. Probability gate: Controlled by `REPLY_CHANCE` (0.12 = ~1 in 8 triggers).
 * 2. Quiet moment gate: Checked via `isAudioRecentlyActive(owner)`. If any voice line
 *    was recently active (within `REPLY_QUIET_WINDOW_MS`), queued, or pending,
 *    scheduling is skipped so replies only happen during genuinely calm stretches.
 *
 * Nothing is scheduled on a clock here: the reservation is handed to the
 * primary's end callback (`finishLine`). Preloading at this point means the clip
 * is already buffered when the primary ends, so the reply starts on the spot
 * instead of waiting on a media fetch in the middle of a dice roll or pawn
 * animation.
 */
function prepareReply(event: VoiceLineEvent, options: VoiceLineContext, owner: HTMLAudioElement): void {
  clearPendingReply();

  // Gate 1: Probabilistic roll (start around 0.10–0.15)
  if (Math.random() > REPLY_CHANCE) return;

  // Gate 2: "Quiet moment" condition — skip if audio system was busy or recently active
  if (isAudioRecentlyActive(owner)) return;

  const acting = options.speaker;
  const candidates = (options.playersInGame ?? [])
    .filter(player => (acting === undefined ? true : player !== acting));
  if (candidates.length === 0) return; // nobody left to answer = safe no-op

  const clip = pickRandomReply(event); // empty folder = safe no-op
  if (!clip) return;

  const speaker = candidates[Math.floor(Math.random() * candidates.length)];
  const audio = new Audio(clip.url);
  audio.preload = 'auto';
  try { audio.load(); } catch { /* preload is best-effort */ }
  pendingReply = { event, speaker, clip, audio, owner };
}

/** Fire the reserved reply after a short conversational beat. */
function startReplyGap(): void {
  clearReplyGap();
  const gap = REPLY_GAP_MIN_MS + Math.random() * (REPLY_GAP_MAX_MS - REPLY_GAP_MIN_MS);
  replyGapTimer = setTimeout(() => {
    replyGapTimer = null;
    lastVoiceActivityEndTime = Date.now();
    const reply = pendingReply;
    pendingReply = null;
    if (!reply || !voiceLinesEnabled || voiceLineVolume <= 0) {
      playNextQueued();
      syncDucking();
      return;
    }
    playClip(
      { kind: 'reply', replyEvent: reply.event, options: { speaker: reply.speaker } },
      reply.clip,
      reply.audio,
    );
  }, gap);
  // The gap itself counts as busy: holds the duck and reserves the slot.
  syncDucking();
}

/**
 * Guarantee the end callback runs even when `ended` never does. Re-armed once
 * metadata lands so the timeout tracks the clip's real length.
 */
function armWatchdog(audio: HTMLAudioElement, onExpire: () => void): void {
  const schedule = () => {
    clearWatchdog();
    if (activeAudio !== audio) return;
    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration * 1000
      : null;
    const remainingMs = durationMs === null
      ? VOICE_WATCHDOG_FALLBACK_MS
      : Math.max(0, durationMs - audio.currentTime * 1000);
    activeWatchdog = setTimeout(onExpire, remainingMs + VOICE_WATCHDOG_GRACE_MS);
  };
  schedule();
  audio.addEventListener('loadedmetadata', schedule, { once: true });
}

/** Start (or, via the caller, enqueue) one clip and drive the speaking state. */
function playClip(line: QueuedLine, clip: VoiceClip, preloaded?: HTMLAudioElement): void {
  const audio = preloaded ?? new Audio(clip.url);
  audio.preload = 'auto';
  audio.volume = voiceLineVolume;
  activeAudio = audio;

  activeLineInfo = {
    event: line.kind === 'event' ? line.event : 'reply',
    speaker: line.options.speaker,
    startTime: Date.now(),
    durationMs: (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0)
      ? audio.duration * 1000
      : null,
    audio,
  };

  const updateDuration = () => {
    if (activeLineInfo && activeLineInfo.audio === audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      activeLineInfo.durationMs = audio.duration * 1000;
    }
  };
  audio.addEventListener('loadedmetadata', updateDuration, { once: true });

  syncDucking();
  notifySpeaking(line.options.speaker === undefined
    ? null
    : { player: line.options.speaker, kind: line.kind === 'reply' ? 'reply' : 'primary' });

  const finish = () => {
    if (activeAudio !== audio) return;
    clearWatchdog();
    activeAudio = null;
    activeLineInfo = null;
    lastVoiceActivityEndTime = Date.now();
    notifySpeaking(null);
    finishLine(audio);
  };
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', finish, { once: true });
  armWatchdog(audio, finish);
  audio.play()?.catch(finish);

  // Only a registered event's primary line can reserve a reply — never a reply.
  if (line.kind === 'event' && isReplyable(line.event)) {
    prepareReply(line.event, line.options, audio);
  }
}

/**
 * Single drain point, run when a clip ends for any reason. A reply reserved by
 * the clip that just ended always wins the next slot; otherwise the ordinary
 * queue drains and the duck is released if nothing else is speaking.
 */
function finishLine(owner: HTMLAudioElement): void {
  if (pendingReply && pendingReply.owner === owner) {
    startReplyGap();
    return;
  }
  clearPendingReply(); // a reservation from an older line can never apply here
  playNextQueued();
  syncDucking();
}

function playNextQueued(): void {
  // Loops rather than returning on the first unplayable entry: a queued line
  // whose pool is empty must not stall everything behind it.
  while (!isVoiceBusy() && queue.length > 0) {
    const next = queue.shift();
    if (!next) return;

    if (next.kind === 'event') {
      if (!isRegisteredEvent(next.event)) continue;
      const clip = pickRandomClip(next.event);
      if (!clip) continue;
      playClip(next, clip);
      return;
    }

    const clip = pickRandomReply(next.replyEvent);
    if (!clip) continue;
    playClip(next, clip);
    return;
  }
}

/** Plays one line from the event's own isolated pool without overlap. */
export function playVoiceLine(event: VoiceLineTrigger, context?: VoiceLineContext): void {
  if (!voiceLinesEnabled || voiceLineVolume <= 0 || typeof Audio === 'undefined') return;
  if (!isRegisteredEvent(event)) return; // unmigrated event = safe no-op

  const currentSpeaker = context?.speaker;

  // Special Case B: If play proceeds to a 3rd player/color (Player C) while an `إخراج_بيدق`
  // line for Player B is queued behind Player A's line, cancel Player B's queued line.
  if (currentSpeaker !== undefined) {
    const activeSpeaker = activeLineInfo?.speaker;
    if (activeSpeaker !== undefined && currentSpeaker !== activeSpeaker) {
      queue = queue.filter(q => {
        if (q.kind === 'event' && q.event === 'إخراج_بيدق' && q.options.speaker !== undefined) {
          return q.options.speaker === activeSpeaker || q.options.speaker === currentSpeaker;
        }
        return true;
      });
    }
  }

  // Refined queueing rules specific to `إخراج_بيدق` primary lines
  if (event === 'إخراج_بيدق') {
    const speaker = context?.speaker;

    if (isVoiceBusy()) {
      // Scenario A: Two pawn-exits happening directly back-to-back (no turn change between them)
      if (speaker !== undefined && lastExitSpeaker !== null && speaker === lastExitSpeaker) {
        // Unconditionally cancel the second line entirely
        return;
      }

      // Scenario B: Pawn-exits across different players' turns
      if (speaker !== undefined) {
        lastExitSpeaker = speaker;
      }

      const remainingWaitMs = getActiveLineRemainingMs();

      // If A's line is expected to finish soon after B's exit (short gap <= EXIT_QUEUE_MAX_WAIT_MS):
      if (remainingWaitMs <= EXIT_QUEUE_MAX_WAIT_MS) {
        // At most one `إخراج_بيدق` line should ever be queued waiting behind the currently-playing one.
        // Evaluate fresh: replace any existing queued `إخراج_بيدق` line.
        queue = queue.filter(q => !(q.kind === 'event' && q.event === 'إخراج_بيدق'));
        queue.push({ kind: 'event', event, options: context ?? {} });
      } else {
        // A's line will take longer to finish (long wait > EXIT_QUEUE_MAX_WAIT_MS):
        // Cancel B's line entirely (do not queue it) and clear any stale queued exit line.
        queue = queue.filter(q => !(q.kind === 'event' && q.event === 'إخراج_بيدق'));
      }
      return;
    }

    // Audio system is not busy: play immediately
    if (speaker !== undefined) {
      lastExitSpeaker = speaker;
    }
    const clip = pickRandomClip(event);
    if (!clip) return;
    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // Default queueing logic for non-إخراج_بيدق voice events
  if (isVoiceBusy()) {
    if (queue.length < MAX_QUEUE_SIZE) queue.push({ kind: 'event', event, options: context ?? {} });
    return;
  }

  const clip = pickRandomClip(event);
  if (!clip) return;
  playClip({ kind: 'event', event, options: context ?? {} }, clip);
}

export function stopVoiceLines(): void {
  queue = [];
  clearWatchdog();
  clearReplyGap();
  clearPendingReply();
  activeLineInfo = null;
  lastExitSpeaker = null;
  if (activeAudio) {
    const audio = activeAudio;
    // Null first: the `pause` below must not be mistaken for a natural end by
    // the element's own handlers.
    activeAudio = null;
    audio.pause();
  }
  lastVoiceActivityEndTime = Date.now();
  setSfxDucking(false);
  notifySpeaking(null);
}

export function isVoiceLinesEnabled(): boolean { return voiceLinesEnabled; }

export function setVoiceLinesEnabled(enabled: boolean): void {
  voiceLinesEnabled = enabled;
  if (!enabled) stopVoiceLines();
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
}

export function getVoiceLineVolume(): number { return voiceLineVolume; }

export function setVoiceLineVolume(volume: number): void {
  voiceLineVolume = clampVoiceVolume(volume);
  if (activeAudio) activeAudio.volume = voiceLineVolume;
  if (voiceLineVolume <= 0) stopVoiceLines();
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(VOICE_VOLUME_STORAGE_KEY, String(voiceLineVolume)); } catch { /* ignore */ }
}
