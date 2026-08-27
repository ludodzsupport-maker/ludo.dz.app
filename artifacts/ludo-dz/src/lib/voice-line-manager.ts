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
export const VOICE_EVENTS = ['بداية_اللعبة'] as const;
export type VoiceLineEvent = (typeof VOICE_EVENTS)[number];

/** Arabic display label for each registered event. */
export const VOICE_EVENT_LABELS: Readonly<Record<VoiceLineEvent, string>> = {
  'بداية_اللعبة': 'بداية اللعبة',
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
  'piece_exited_home',
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
let queue: VoiceLineTrigger[] = [];

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

function playNextQueued(): void {
  if (activeAudio || queue.length === 0) return;
  const next = queue.shift();
  if (next) playVoiceLine(next);
}

/** Plays one line from the event's own isolated pool without overlap. */
export function playVoiceLine(event: VoiceLineTrigger): void {
  if (!voiceLinesEnabled || voiceLineVolume <= 0 || typeof Audio === 'undefined') return;
  if (activeAudio) {
    if (queue.length < MAX_QUEUE_SIZE) queue.push(event);
    return;
  }
  if (!isRegisteredEvent(event)) return;

  const clip = pickRandomClip(event);
  if (!clip) return;
  const audio = new Audio(clip.url);
  audio.preload = 'auto';
  audio.volume = voiceLineVolume;
  activeAudio = audio;
  setSfxDucking(true);

  const finish = () => {
    if (activeAudio !== audio) return;
    activeAudio = null;
    setSfxDucking(false);
    playNextQueued();
  };
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', finish, { once: true });
  audio.play()?.catch(finish);
}

export function stopVoiceLines(): void {
  queue = [];
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  setSfxDucking(false);
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
