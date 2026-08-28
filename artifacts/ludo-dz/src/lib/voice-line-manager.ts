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
// A reply is an optional secondary line that may play *after* a registered
// event's primary line. It reuses the same isolated-folder model: the reply
// pool lives under `voice/ردود/<event>/` and is shared across all players (the
// audio content is generic; only the speaking indicator is tied to a specific
// player). No clip is shared between events, nor between an event and its own
// replies, and the no-immediate-repeat rule applies within each reply pool.
//
// To enable replies for a new event, add its key to `REPLYABLE_EVENTS` and drop
// clips into `voice/ردود/<event>/` — nothing else changes. The pool is auto-built
// and the chance/delay constants below apply uniformly to every replyable event.
// ─────────────────────────────────────────────────────────────────────────────

/** Probability that a reply fires after the primary line plays (tune here). */
export const REPLY_CHANCE = 0.35;

const REPLY_DELAY_MIN_MS = 500; // earliest a reply may start after the primary
const REPLY_DELAY_MAX_MS = 1000; // latest a reply may start after the primary

/** Events that may produce a reply after their primary line plays. */
const REPLYABLE_EVENTS: Readonly<Partial<Record<VoiceLineEvent, boolean>>> = {
  'إخراج_بيدق': true,
};

// ─── Speaking indicator ───────────────────────────────────────────────────────
// The visual "someone is speaking" state. Whenever a line starts playing for a
// specific player, a single speaker is broadcast; when it ends (or a line with
// no speaker plays), the speaker is cleared. UI subscribes via `subscribeSpeaking`.
export type SpeakingState = { player: number } | null;
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
 * The state is `{ player }` while a line for that player is audible, else `null`.
 */
export function subscribeSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener);
  if (currentSpeaking) listener(currentSpeaking);
  return () => { speakingListeners.delete(listener); };
}

function notifySpeaking(state: SpeakingState): void {
  if (currentSpeaking?.player === state?.player) return;
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

// A queued line is either a registered/unmigrated event, or a reply line. Both
// carry their options so the speaking indicator and reply targeting still work
// after they drain through the no-overlap queue.
type QueuedLine =
  | { kind: 'event'; event: VoiceLineTrigger; options: VoiceLineContext }
  | { kind: 'reply'; replyEvent: VoiceLineEvent; options: VoiceLineContext };

let queue: QueuedLine[] = [];
// Pending reply timers, so `stopVoiceLines` can cancel anything still in flight.
const pendingReplyTimers = new Set<ReturnType<typeof setTimeout>>();

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

/** Schedule a delayed reply after a replyable event's primary line. */
function maybeScheduleReply(event: VoiceLineEvent, options: VoiceLineContext): void {
  if (Math.random() >= REPLY_CHANCE) return;

  const acting = options.speaker;
  const candidates = (options.playersInGame ?? [])
    .filter(player => (acting === undefined ? true : player !== acting));
  if (candidates.length === 0) return;

  const replySpeaker = candidates[Math.floor(Math.random() * candidates.length)];
  const delay = REPLY_DELAY_MIN_MS + Math.random() * (REPLY_DELAY_MAX_MS - REPLY_DELAY_MIN_MS);

  const timer = setTimeout(() => {
    pendingReplyTimers.delete(timer);
    if (!voiceLinesEnabled || voiceLineVolume <= 0) return;
    const replyPool = eventReplyPools.get(event);
    if (!replyPool || replyPool.length === 0) return; // empty folder = safe no-op
    // Respect the same no-overlap queue as normal lines.
    if (activeAudio) {
      if (queue.length < MAX_QUEUE_SIZE) queue.push({ kind: 'reply', replyEvent: event, options: { speaker: replySpeaker } });
      return;
    }
    const clip = pickRandomReply(event);
    if (!clip) return;
    playClip({ kind: 'reply', replyEvent: event, options: { speaker: replySpeaker } }, clip);
  }, delay);
  pendingReplyTimers.add(timer);
}

/** Start (or, via the caller, enqueue) one clip and drive the speaking state. */
function playClip(line: QueuedLine, clip: VoiceClip): void {
  const audio = new Audio(clip.url);
  audio.preload = 'auto';
  audio.volume = voiceLineVolume;
  activeAudio = audio;
  setSfxDucking(true);
  notifySpeaking(line.options.speaker === undefined ? null : { player: line.options.speaker });

  const finish = () => {
    if (activeAudio !== audio) return;
    activeAudio = null;
    setSfxDucking(false);
    notifySpeaking(null);
    playNextQueued();
  };
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', finish, { once: true });
  audio.play()?.catch(finish);

  // Only a registered event's primary line can schedule a reply — never a reply.
  if (line.kind === 'event' && isReplyable(line.event)) {
    maybeScheduleReply(line.event, line.options);
  }
}

function playNextQueued(): void {
  if (activeAudio || queue.length === 0) return;
  const next = queue.shift();
  if (!next) return;

  if (next.kind === 'event') {
    if (!isRegisteredEvent(next.event)) return;
    const clip = pickRandomClip(next.event);
    if (!clip) return;
    playClip(next, clip);
  } else {
    const clip = pickRandomReply(next.replyEvent);
    if (!clip) return;
    playClip(next, clip);
  }
}

/** Plays one line from the event's own isolated pool without overlap. */
export function playVoiceLine(event: VoiceLineTrigger, context?: VoiceLineContext): void {
  if (!voiceLinesEnabled || voiceLineVolume <= 0 || typeof Audio === 'undefined') return;
  if (!isRegisteredEvent(event)) return; // unmigrated event = safe no-op
  if (activeAudio) {
    if (queue.length < MAX_QUEUE_SIZE) queue.push({ kind: 'event', event, options: context ?? {} });
    return;
  }

  const clip = pickRandomClip(event);
  if (!clip) return;
  playClip({ kind: 'event', event, options: context ?? {} }, clip);
}

export function stopVoiceLines(): void {
  queue = [];
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  pendingReplyTimers.forEach(clearTimeout);
  pendingReplyTimers.clear();
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
