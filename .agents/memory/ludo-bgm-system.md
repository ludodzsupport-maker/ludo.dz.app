---
name: Ludo DZ background music (BGM) system
description: How the universal ambient BGM loop is wired (separate from per-theme SFX), and a gotcha about asset presence vs. code completeness.
---

## Where things live
The BGM system is a self-contained block in `sound-manager.ts` (search "Background Music (BGM)"), structurally separate from the per-theme click/pawn/capture/dice cues documented in `ludo-sound-architecture.md`. It owns its own localStorage key, its own AudioContext gain graph, and never checks the SFX `soundEnabled` flag — fully independent of "مؤثرات صوتية" (SFX), bound only to "موسيقى الخلفية" (Music) in Settings.

## Loop technique
Native `loop=true` isn't used (can't guarantee a gapless boundary on a generated asset). The whole file is decoded once via `decodeAudioData` into a PCM AudioBuffer, and each pass is scheduled as its own BufferSource with a ~1.6s overlap-crossfade into the next pass — this makes the loop seam inaudible even if the source file's raw start/end samples don't perfectly match. A static -7dB highshelf (~1600Hz) is baked into the BGM graph so pawn/dice SFX always stay audible on top, regardless of the raw asset's own mix.

## Gotcha: code completeness does not mean the feature works — check the asset file exists
Found 2026-08-04: the entire BGM implementation (1.2s fade-in / 1.0s fade-out timing, crossfade loop, first-gesture autoplay recovery, localStorage persistence, EQ carve for SFX headroom) was already fully coded and matched a detailed audio spec exactly, but the referenced asset (`public/sounds/bgm-ambient-loop.mp3`) did not exist on disk — only a similarly-named, purpose-generated file sat unused in `attached_assets/generated_audio/bgm_universal_ambient_loop.mp3`. The fetch failed silently (caught and swallowed by design, so a missing asset never crashes the game), so nothing in logs pointed at it. **Why:** a prior session likely wrote the code and generated the asset as separate steps and never did the final copy-into-`public/`. **How to apply:** when asked to fix/verify/build a BGM or similar asset-backed feature, don't stop at reading the code — grep for the exact asset URL/filename the code fetches and confirm a file exists at that literal path (`ls`/`find`), and curl the dev server for it, before concluding the feature is broken or needs new code.

## Judging loop-safety of a candidate ambient track without literally listening
Compare `ffmpeg -af volumedetect` mean/max dB across matching-length windows at the very start vs. the very end, and per-frequency-band (e.g. 200-400/400-1000/1000-3000/3000-8000 Hz via highpass+lowpass chained into volumedetect) — levels within 1-3dB at both edges across all bands is a strong signal the loop point will crossfade cleanly, even when the track has an overall swell (quiet→loud→quiet) envelope rather than a static drone. `ffmpeg -lavfi showwavespic` renders a quick waveform PNG (viewable via ReadFile) to sanity-check the envelope shape visually.
