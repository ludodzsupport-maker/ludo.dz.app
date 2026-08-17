import { setSfxDucking } from './sound-manager';

export const VOICE_LINE_CATEGORIES = [
  'danger',
  'danger_escape',
  'capture_by_me',
  'captured_by_opponent',
  'laugh_mock',
  'safe_gathering',
  'piece_home',
  'win',
  'game_start',
  'turn_reminder',
] as const;

export type VoiceLineCategory = typeof VOICE_LINE_CATEGORIES[number];

const VOICE_FILES = import.meta.glob('../assets/audio/voice/*/*.{mp3,ogg,wav,m4a,aac,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const MAX_QUEUE_SIZE = 2;
const VOICE_VOLUME = 0.9;

const filesByCategory = new Map<VoiceLineCategory, string[]>();
const lastPlayedByCategory = new Map<VoiceLineCategory, string>();
let activeAudio: HTMLAudioElement | null = null;
let queue: VoiceLineCategory[] = [];

for (const category of VOICE_LINE_CATEGORIES) filesByCategory.set(category, []);

Object.entries(VOICE_FILES).forEach(([path, url]) => {
  const match = path.match(/\/voice\/([^/]+)\//);
  const category = match?.[1] as VoiceLineCategory | undefined;
  if (!category || !VOICE_LINE_CATEGORIES.includes(category)) return;
  filesByCategory.get(category)?.push(url);
});

for (const files of filesByCategory.values()) files.sort();

function pickRandomFile(category: VoiceLineCategory): string | null {
  const files = filesByCategory.get(category) ?? [];
  if (files.length === 0) return null;
  const last = lastPlayedByCategory.get(category);
  const candidates = files.length > 1 ? files.filter(file => file !== last) : files;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  lastPlayedByCategory.set(category, picked);
  return picked;
}

function playNextQueued(): void {
  if (activeAudio || queue.length === 0) return;
  const next = queue.shift();
  if (next) playVoiceLine(next);
}

/**
 * Plays one random Algerian Darija narrator line from a category.
 *
 * Concurrency policy: voice lines never overlap. If a trigger arrives while a
 * line is already playing, the category is queued briefly behind the current
 * line, with a two-item cap. Additional triggers are skipped so old commentary
 * does not pile up and feel late.
 */
export function playVoiceLine(category: VoiceLineCategory): void {
  if (typeof Audio === 'undefined') return;
  if (activeAudio) {
    if (queue.length < MAX_QUEUE_SIZE) queue.push(category);
    return;
  }

  const file = pickRandomFile(category);
  if (!file) return;

  const audio = new Audio(file);
  audio.preload = 'auto';
  audio.volume = VOICE_VOLUME;
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

export function getVoiceLineFiles(category: VoiceLineCategory): readonly string[] {
  return filesByCategory.get(category) ?? [];
}
