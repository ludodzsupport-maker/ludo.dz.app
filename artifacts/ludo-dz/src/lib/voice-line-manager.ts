import { setSfxDucking } from './sound-manager';

export const VOICE_LINE_EVENTS = [
  'game_start',
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

// Kept as an alias so existing settings/UI imports remain source-compatible.
export const VOICE_LINE_CATEGORIES = VOICE_LINE_EVENTS;
export type VoiceLineEvent = typeof VOICE_LINE_EVENTS[number];
export type VoiceLineCategory = VoiceLineEvent;

export const VOICE_MOODS = [
  'triumphant',
  'aggressive',
  'mocking',
  'anxious',
  'disappointed',
  'encouraging',
  'informational',
  'surprised',
  'humorous',
] as const;
export type VoiceMood = typeof VOICE_MOODS[number];

export const EVENT_MOODS: Readonly<Record<VoiceLineEvent, readonly VoiceMood[]>> = {
  game_start: ['informational', 'triumphant'],
  win: ['triumphant'],
  opponent_near_win: ['anxious', 'encouraging'],
  rolled_six: ['informational', 'aggressive'],
  consecutive_sixes_2: ['humorous', 'informational'],
  forfeit_three_sixes: ['disappointed'],
  no_valid_moves: ['disappointed', 'informational'],
  extra_turn: ['triumphant', 'aggressive'],
  piece_exited_home: ['informational', 'encouraging'],
  piece_home: ['triumphant'],
  capture_by_me: ['aggressive', 'triumphant'],
  captured_by_opponent: ['disappointed', 'anxious'],
  laugh_mock: ['mocking'],
  near_miss: ['surprised', 'anxious'],
  blocked_path: ['disappointed', 'mocking'],
  perfect_escape: ['encouraging', 'surprised'],
  danger: ['anxious'],
  danger_escape: ['encouraging', 'surprised'],
  safe_gathering: ['informational', 'encouraging'],
  safe_zone_entry: ['informational'],
  turn_reminder: ['informational'],
  ai_thinking: ['informational', 'encouraging'],
  final_stretch: ['aggressive', 'triumphant'],
  opponent_captured: ['mocking', 'surprised'],
};

const EXCLUSIVE_EVENTS = new Set<VoiceLineEvent>(['win', 'game_start', 'piece_home']);

/** Number of successfully selected clips protected across all events. */
export const GLOBAL_VOICE_COOLDOWN_EVENTS = 3;
/** Number of successfully selected clips protected for the same event. */
export const PER_EVENT_VOICE_COOLDOWN_EVENTS = 1;

const VOICE_FILES = import.meta.glob('../assets/audio/voice/**/*.{mp3,ogg,wav,m4a,aac,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const MAX_QUEUE_SIZE = 2;
const DEFAULT_VOICE_VOLUME = 0.9;
const PRIMARY_MOOD_WEIGHT = 3;
const SECONDARY_MOOD_WEIGHT = 1;
const VOICE_ENABLED_STORAGE_KEY = 'ludo-dz:voice-commentary-enabled';
const VOICE_VOLUME_STORAGE_KEY = 'ludo-dz:voice-commentary-volume';

export interface ParsedVoiceFilename {
  moods: readonly VoiceMood[];
  sequence: number;
}

interface VoiceClip extends ParsedVoiceFilename {
  path: string;
  url: string;
}

/** Parses `{name}_{emotion}{n}` and `{name}_{emotion1}_{emotion2}{n}` names. */
export function parseVoiceFilename(path: string): ParsedVoiceFilename | null {
  const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '');
  if (!filename) return null;

  const moods: VoiceMood[] = [];
  let sequence: number | null = null;
  for (const segment of filename.split('_')) {
    const match = segment.match(/^([a-z]+?)(\d+)?$/i);
    if (!match) continue;
    const mood = match[1].toLowerCase() as VoiceMood;
    if (!VOICE_MOODS.includes(mood)) continue;
    if (!moods.includes(mood)) moods.push(mood);
    if (match[2]) sequence = Number(match[2]);
  }

  // Per convention, trailing digits belong to the last matched mood segment.
  const lastMoodSegment = [...filename.split('_')].reverse().find(segment => {
    const mood = segment.replace(/\d+$/, '').toLowerCase() as VoiceMood;
    return VOICE_MOODS.includes(mood);
  });
  const trailingSequence = lastMoodSegment?.match(/(\d+)$/)?.[1];
  if (!moods.length || !trailingSequence || sequence === null) return null;
  return { moods, sequence: Number(trailingSequence) };
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
const clips: VoiceClip[] = [];
const globalHistory: string[] = [];
const eventHistory = new Map<VoiceLineEvent, string[]>();
let activeAudio: HTMLAudioElement | null = null;
let queue: VoiceLineEvent[] = [];

Object.entries(VOICE_FILES).forEach(([path, url]) => {
  const parsed = parseVoiceFilename(path);
  if (parsed) clips.push({ path, url, ...parsed });
});
clips.sort((a, b) => a.path.localeCompare(b.path) || a.sequence - b.sequence);

function weightedRandom(candidates: VoiceClip[], primaryMood: VoiceMood): VoiceClip {
  const weighted = candidates.map(clip => ({
    clip,
    weight: clip.moods.includes(primaryMood) ? PRIMARY_MOOD_WEIGHT : SECONDARY_MOOD_WEIGHT,
  }));
  let roll = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
  for (const item of weighted) {
    roll -= item.weight;
    if (roll < 0) return item.clip;
  }
  return weighted[weighted.length - 1].clip;
}

function pickRandomFile(event: VoiceLineEvent): string | null {
  const accepted = EVENT_MOODS[event];
  const primary = accepted[0];
  const eligible = clips.filter(clip => EXCLUSIVE_EVENTS.has(event)
    ? clip.moods.length === 1 && clip.moods[0] === primary
    : clip.moods.some(mood => accepted.includes(mood)));
  if (!eligible.length) return null;

  const recentForEvent = eventHistory.get(event) ?? [];
  const cooled = eligible.filter(clip =>
    !globalHistory.includes(clip.url) && !recentForEvent.includes(clip.url));
  const picked = weightedRandom(cooled.length ? cooled : eligible, primary);

  globalHistory.unshift(picked.url);
  globalHistory.splice(GLOBAL_VOICE_COOLDOWN_EVENTS);
  const nextEventHistory = [picked.url, ...recentForEvent];
  nextEventHistory.splice(PER_EVENT_VOICE_COOLDOWN_EVENTS);
  eventHistory.set(event, nextEventHistory);
  return picked.url;
}

function playNextQueued(): void {
  if (activeAudio || queue.length === 0) return;
  const next = queue.shift();
  if (next) playVoiceLine(next);
}

/** Plays one mood-matched Algerian Darija narrator line without overlap. */
export function playVoiceLine(event: VoiceLineEvent): void {
  if (!voiceLinesEnabled || voiceLineVolume <= 0 || typeof Audio === 'undefined') return;
  if (activeAudio) {
    if (queue.length < MAX_QUEUE_SIZE) queue.push(event);
    return;
  }

  const file = pickRandomFile(event);
  if (!file) return;
  const audio = new Audio(file);
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

export function getVoiceLineFiles(event: VoiceLineEvent): readonly string[] {
  const accepted = EVENT_MOODS[event];
  return clips.filter(clip => EXCLUSIVE_EVENTS.has(event)
    ? clip.moods.length === 1 && clip.moods[0] === accepted[0]
    : clip.moods.some(mood => accepted.includes(mood))).map(clip => clip.url);
}
