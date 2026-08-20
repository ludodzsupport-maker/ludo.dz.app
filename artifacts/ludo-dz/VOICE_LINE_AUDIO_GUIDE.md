# Ludo DZ Voice-Line Audio System — Asset Preparation Guide

> **Current implementation reviewed:** 2026-08-20
>
> **Repository root:** `/home/user/ludo.dz.app`
>
> **App root:** `artifacts/ludo-dz/`

This document describes the system **as it is currently implemented**. It distinguishes hard loader requirements from production recommendations and calls out current behavior that may not match what the category names imply.

## Quick production checklist

- Put each clip under `artifacts/ludo-dz/src/assets/audio/voice/<category>/`.
- Use one of the six **lowercase** extensions recognized by the loader: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`, or `.webm`.
- No manifest is required. Files are discovered by Vite at development/build time.
- One valid file is enough for a category; 3–5 short alternatives per category is a practical recommendation for variety.
- Recommended delivery format: mono MP3, 44.1 or 48 kHz, about 96–128 kbps, normally 1–4 seconds, consistently normalized.
- Restart the Vite development server after adding files, then test through the development-console command in [Testing](#7-testing).
- Rebuild/redeploy the web app—or rebuild the Cordova package—before expecting new files in an installed or deployed app.

---

## 1. Folder structure and exact category keys

These are the exact, repository-root-relative paths. The directory name is also the exact category key used in code.

| Event/category | Exact category key and folder name | Exact path from repository root |
|---|---|---|
| Danger | `danger` | `artifacts/ludo-dz/src/assets/audio/voice/danger/` |
| Escape from danger | `danger_escape` | `artifacts/ludo-dz/src/assets/audio/voice/danger_escape/` |
| Capture by the acting player | `capture_by_me` | `artifacts/ludo-dz/src/assets/audio/voice/capture_by_me/` |
| Piece captured by an opponent | `captured_by_opponent` | `artifacts/ludo-dz/src/assets/audio/voice/captured_by_opponent/` |
| Laugh/mock after a capture streak | `laugh_mock` | `artifacts/ludo-dz/src/assets/audio/voice/laugh_mock/` |
| Different colors gather on a safe cell | `safe_gathering` | `artifacts/ludo-dz/src/assets/audio/voice/safe_gathering/` |
| One piece reaches the center/finished position | `piece_home` | `artifacts/ludo-dz/src/assets/audio/voice/piece_home/` |
| Match won | `win` | `artifacts/ludo-dz/src/assets/audio/voice/win/` |
| Game board entered or match restarted | `game_start` | `artifacts/ludo-dz/src/assets/audio/voice/game_start/` |
| Human player idle reminder | `turn_reminder` | `artifacts/ludo-dz/src/assets/audio/voice/turn_reminder/` |

The common parent folder is:

```text
artifacts/ludo-dz/src/assets/audio/voice/
```

The current tree is:

```text
artifacts/ludo-dz/src/assets/audio/voice/
├── danger/
├── danger_escape/
├── capture_by_me/
├── captured_by_opponent/
├── laugh_mock/
├── safe_gathering/
├── piece_home/
├── win/
├── game_start/
└── turn_reminder/
```

Each folder currently contains only a `.gitkeep` placeholder. There are **no production voice clips in the repository yet**.

### Important path distinction

The voice folders are inside `src/assets`, not the app's `public/sounds` folder used by some UI sound effects. For example, the complete repository path is:

```text
artifacts/ludo-dz/src/assets/audio/voice/danger/
```

Do not place voice files in either of these locations:

```text
assets/audio/voice/danger/          # missing the app/source prefix
artifacts/ludo-dz/public/sounds/    # used by a different SFX system
```

---

## 2. File naming convention and number of files

### Hard naming rule implemented by the loader

The actual supported path pattern is:

```text
artifacts/ludo-dz/src/assets/audio/voice/<exact-category>/<any-filename>.<supported-lowercase-extension>
```

There is **no required filename prefix, sequence number, or zero padding**. The loader categorizes a file from its parent folder, not from its base filename.

All of these are valid examples:

```text
artifacts/ludo-dz/src/assets/audio/voice/danger/danger_01.mp3
artifacts/ludo-dz/src/assets/audio/voice/danger/watch_out.mp3
artifacts/ludo-dz/src/assets/audio/voice/danger/01.ogg
```

The recommended convention is:

```text
<category>_<two-digit-number>.mp3
```

Examples:

```text
danger_01.mp3
danger_02.mp3
danger_escape_01.mp3
capture_by_me_01.mp3
captured_by_opponent_01.mp3
laugh_mock_01.mp3
safe_gathering_01.mp3
piece_home_01.mp3
win_01.mp3
game_start_01.mp3
turn_reminder_01.mp3
```

Use lowercase ASCII names with underscores for predictable behavior across web hosting, Git, Android, and case-sensitive filesystems. This is a recommendation rather than a code requirement.

### What is not matched

- Files nested another level down, such as `danger/male/danger_01.mp3`, are not matched.
- Files directly in `voice/` without a category folder are not matched.
- Files in an unknown or misspelled category folder are ignored.
- Uppercase extensions such as `.MP3` are not included by the current lowercase glob; use `.mp3`.
- Unsupported extensions such as `.flac`, `.aiff`, or `.wma` are ignored.

### Minimum and maximum count

- **Zero files:** the category silently does nothing. The game itself continues normally.
- **One file:** fully supported. The same clip plays every time that category successfully plays.
- **Two files:** supported and useful. The manager prevents an immediate repeat within that category, so two files alternate.
- **Three or more files:** supported. Every selection is random among all files except the file most recently played for that category.
- **Maximum:** no code-enforced maximum exists. The practical limits are repository size, web/mobile package size, build time, and maintainability.

A sensible starting set is **3–5 clips per category**, but this is not required. One clip is enough to make a category functional; 2+ is only needed if variation matters.

---

## 3. File-format and production requirements

### Extensions recognized by the current Vite loader

The loader's exact extension list is:

```text
.mp3
.ogg
.wav
.m4a
.aac
.webm
```

The source glob is:

```ts
import.meta.glob('../assets/audio/voice/*/*.{mp3,ogg,wav,m4a,aac,webm}', ...)
```

### Codec compatibility caveat

Recognition by the build does not guarantee that every browser or Android WebView can decode every codec that might be stored inside a matching container. For the broadest compatibility, especially for the Cordova/Android build, **MP3 is the safest default**. Ogg/WebM support can vary by embedded browser, while M4A/AAC support can vary by platform and codec profile.

### Hard constraints currently enforced

There are no code checks for:

- file size;
- sample rate;
- bitrate;
- mono versus stereo;
- loudness;
- peak level; or
- duration.

A corrupt or platform-unsupported file reaches the browser's `HTMLAudioElement`; if playback errors, the manager silently abandons that line, restores ducking, and proceeds to the next queued category.

### Recommended production specification

These are recommendations for consistency and performance, not loader requirements:

- **Format:** MP3.
- **Channels:** mono, unless a clip genuinely needs stereo. Spoken commentary gains little from stereo and mono reduces package size.
- **Sample rate:** 44.1 kHz or 48 kHz. Pick one rate and use it consistently.
- **Bitrate:** roughly 96–128 kbps for mono MP3 speech.
- **Duration:** preferably 1–4 seconds; aim for about 1–3 seconds when possible. Long lines make later queued commentary feel stale.
- **Loudness:** normalize all categories consistently; approximately `-16 LUFS-I` with true peaks no higher than about `-1 dBTP` is a reasonable starting point for mobile spoken audio. Audition on real phones before finalizing.
- **Editing:** trim leading/trailing silence, remove noise and plosives, and use very short edge fades to prevent clicks.
- **Mix:** deliver clean voice without baked-in game SFX, music, or heavy room reverb. The app handles SFX ducking itself.
- **File size:** there is no hard cap, but keeping a short line comfortably below a few hundred kilobytes helps the web build and mobile package remain lean.

The app sets voice playback to **90% element volume** (`0.9`). This is only a playback scalar; it does not normalize mismatched source files. The supplied clips therefore need consistent mastering.

---

## 4. How files are loaded

### No manifest or registration file is required

There is no JSON manifest and no category-to-filename list to update. The source of truth is:

```text
artifacts/ludo-dz/src/lib/voice-line-manager.ts
```

At development/build time, Vite expands this glob:

```ts
const VOICE_FILES = import.meta.glob(
  '../assets/audio/voice/*/*.{mp3,ogg,wav,m4a,aac,webm}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);
```

The manager then:

1. extracts the folder immediately after `/voice/`;
2. accepts it only if it exactly matches one of the ten category keys;
3. stores the generated asset URL under that category; and
4. sorts each category's URL list before random selection.

### What “auto-detect” means here

This is **build-time/dev-server discovery**, not runtime filesystem scanning.

- In source development, drop the file into the correct folder and restart the Vite server (safest) so the glob is recomputed.
- For a deployed web app, commit the source asset and rebuild/redeploy.
- For the mobile app, rebuild the Vite Cordova bundle and then rebuild the Cordova package.
- Copying a file next to an already-built web or installed app does not register it.

The eager glob eagerly registers asset URLs in the JavaScript module. It does not decode every voice clip at startup. A selected clip is created with `new Audio(url)` when its category reaches the front of the playback queue, so a clip can still incur first-use loading/decode latency.

The existing `.gitkeep` files may remain; their extension is not in the glob, so they are ignored.

---

## 5. Trigger conditions recap

All commentary is global narrator audio. It is not currently routed to a particular player's headphones, language, color, human/AI identity, or local-player perspective.

### `danger`

Plays after a resolved pawn move if **any pawn has newly entered the computed danger set** compared with the state before that move.

A pawn is considered in danger when all of the following are true:

- it is on the 51-position main track (`relPos` 0–50), not in base, a home column, or the finished center;
- its current absolute cell is not in `SAFE_SET`; and
- at least one active opposing pawn, also on the main track, could land exactly on that cell by moving forward a hypothetical 1–6 spaces without entering its home column.

The calculation does not require that opponent to be the next player or to have already rolled the needed number. It is a general “within capture distance” warning. Because the trigger is global, the newly endangered pawn can belong to any player, not necessarily the pawn that just moved.

Content fit: a short, player-neutral warning such as “Careful—someone is in range.”

### `danger_escape`

Plays after a resolved move when **the pawn that just moved** was in the danger set before the move and is no longer in it afterward.

It can stop being dangerous because it moved to a safe cell, moved out of all opponents' 1–6 capture range, entered its home column/finished, or removed the relevant threat by capturing. It does not fire merely because some other stationary pawn stopped being endangered.

Content fit: relief or a narrow-escape reaction.

### `capture_by_me`

Plays once whenever a move resolves a legal capture on a non-safe main-track cell. It is called first in the capture commentary sequence.

Content fit: celebration from the captor's side or neutral praise for a successful capture.

### `captured_by_opponent`

Plays on the **same capture event** as `capture_by_me`, immediately after it in queue order.

Current behavior does not choose one category according to perspective: when both categories contain files, the app attempts to play both serially for every capture. It also does not know which local listener is the captor or victim.

Content fit: a very short victim-side reaction, warning, or consolation that still makes sense when heard by everyone.

### `laugh_mock`

The threshold is `2`. The streak resets on restart and whenever a resolved pawn move captures nobody. Dice rolls between moves do not reset it.

The intended idea is a repeated capture streak. The exact current implementation has an important nuance:

- the first capture stores the captured **victim color** because ties are resolved in favor of the victim streak;
- from the initial/reset state, the captor branch is effectively unreachable because a victim count of at least 1 always wins a tie;
- the streak therefore increments to 2 only when the **same victim color is captured on successive capture moves**;
- it fires on the second qualifying capture and every later qualifying capture while the count remains at least 2; and
- the same captor taking different victim colors on consecutive moves resets the tracked count to 1 instead of extending a captor streak.

This should be treated as the current behavior and a likely future logic-cleanup item. Content should be a short mock/laugh line suitable for repeated captures.

### `safe_gathering`

Plays when the entire board changes from **having no mixed-color gathering on any safe cell** to **having at least one mixed-color gathering on a safe cell**.

Exact requirements:

- at least two pawns occupy the same safe cell;
- the occupants include at least two distinct player colors;
- two or more pawns of only one color do **not** qualify;
- three or more pawns qualify if at least two colors are represented;
- base positions, home-column cells, and the finished center do not count; and
- if a mixed-color safe gathering already exists elsewhere before the move, creating another one does not fire because the global condition was already true.

The runtime source of truth is this exact set of eight absolute main-path indexes:

```text
0, 8, 13, 21, 26, 34, 39, 47
```

They are:

- four player-start safe cells: `0`, `13`, `26`, `39`; and
- four additional safe cells: `8`, `21`, `34`, `47`.

For board-debugging purposes, their `[row, column]` coordinates are:

```text
0  -> [6, 1]
8  -> [2, 6]
13 -> [1, 8]
21 -> [6, 12]
26 -> [8, 13]
34 -> [12, 8]
39 -> [13, 6]
47 -> [8, 2]
```

There is a stale comment in `ludo-engine.ts` that mentions `11, 24, 37, 50`; that comment does **not** match the actual `SAFE_SET` used by captures, danger detection, safe gathering, and board safe-cell rendering. Use the eight runtime values above when writing/testing content.

Content fit: surprise, truce, or “everyone met in the safe spot” commentary involving different colors.

### `piece_home`

Plays when the pawn that just moved reaches `FINISHED_POS` (`relPos === 57`), meaning it has completed the home column and reached the center.

It does not play merely for entering the colored home column (`relPos` 51–56). It can play once for each pawn that reaches the center. The final pawn can also cause `win`.

Content fit: celebration of one pawn completing its journey, less final than a full win line.

### `win`

Plays when `game.winner` becomes non-null—that is, after all pawns belonging to one player have reached `FINISHED_POS`.

The quick rule creates two pawns per player; the normal rule creates four, so “all pieces are home” depends on the selected rule.

Content fit: unmistakable match-victory celebration.

### `game_start`

Plays:

- once when the game-board screen mounts, including entry into a restored/saved game; and
- again when the player uses the in-place restart/play-again flow.

A restart first stops the active voice and clears the queue, then requests `game_start`.

Content fit: a short welcome/readiness line that is also acceptable on a restart or restored board—not necessarily only “brand-new match” wording.

### `turn_reminder`

Plays once after **10,000 ms (10 seconds)** of an unchanged, eligible human-turn state.

The timer can run while the human is expected to roll or select a movable pawn. It does not run while:

- the exit confirmation is open;
- the dice are animating;
- a pawn is animating;
- the game has a winner;
- it is an AI player's turn; or
- the game is outside the rolling/selecting phases.

In local multiplayer every player is treated as human. In computer mode, only player/color index `0` is treated as human. Relevant turn/phase/dice/move-state changes cancel and restart the timer. After it fires once, it does not repeat continuously until one of those dependencies changes.

Content fit: a friendly, non-hostile “roll” or “choose a pawn” prompt that works in either eligible phase.

### Multi-trigger ordering

One move can satisfy several categories. The move-resolution code requests them in this order:

1. `capture_by_me`
2. `captured_by_opponent`
3. `laugh_mock` (if threshold reached)
4. `danger_escape`
5. `safe_gathering`
6. `piece_home`
7. `danger`

`win` is requested by a React effect after the winner state is committed. The queue limit described below means later requests can be skipped when many conditions happen on one move.

---

## 6. Volume and ducking behavior

### Implemented values

| Behavior | Current value |
|---|---:|
| Voice element volume | `0.9` (90%) |
| SFX level while ducked | `0.3` of normal SFX level (30%, a 70% reduction) |
| SFX fade-down time | `200 ms` |
| SFX fade-up time | `200 ms` |
| Fade shape | Linear |

The SFX fade-down starts when a voice clip starts. Fade-up starts when that clip ends, errors, is rejected by browser playback policy, or voice playback is explicitly stopped.

For cached UI `<audio>` effects, the ordinary base element volume is `0.55`; fully ducked it becomes approximately `0.55 × 0.3 = 0.165`. Synthesized board effects and the decoded dice sample are routed through a shared Web Audio gain stage and reduced to 30% of their normal output.

### What is not ducked or faded

- The voice clip itself has no app-provided fade-in or fade-out; it starts and ends according to the supplied file.
- Background music is not part of this ducking bus. It is already paused while the game-board screen is active.
- Voice volume is not linked to a user-facing voice-volume slider; it is a fixed `0.9` constant.

### Mastering implication

Do not pre-duck game sounds into the recording or master voices excessively hot. Supply consistently normalized, clean speech. The app already reduces active SFX substantially, but it does not perform compression, limiting, loudness matching, or automatic gain control on voice files.

### Current queued-line ducking caveat

Ducking is straightforward for a single line. At the end of each line, however, the current manager starts restoring SFX before immediately starting the next queued line. Because of the current fade-timer/early-return interaction, SFX can fade back toward full volume during a queued line instead of remaining continuously at 30% across the whole queue. This is a known implementation limitation worth fixing before relying on several back-to-back lines.

---

## 7. Testing

### Is there a debug/test button?

No. There is currently no in-app voice browser, category test button, or diagnostics screen. `getVoiceLineFiles(category)` exists in the manager, but no UI exposes it.

### Fastest category-specific test in Vite development

1. Add the new file to the exact category folder.
2. From the repository root, start or restart the app:

   ```bash
   pnpm --filter @workspace/ludo-dz run dev
   ```

3. Open the app and then open the browser's developer console.
4. For a `danger` test, run:

   ```js
   import('/src/lib/voice-line-manager.ts').then((voice) => {
     console.log(voice.getVoiceLineFiles('danger'));
     document.addEventListener(
       'click',
       () => voice.playVoiceLine('danger'),
       { once: true, capture: true },
     );
     console.log('Now click/tap the app once to play the test line.');
   });
   ```

5. Click/tap a harmless part of the app once. Registering the test on a real click makes it work with stricter browser autoplay policies.
6. Replace `danger` in both places with any exact category key to test that category.

Expected results:

- `getVoiceLineFiles(...)` prints one or more generated asset URLs.
- The next click/tap plays one randomly selected clip.
- SFX starts ducking while it plays.

If the returned list is empty:

- confirm the repository path;
- confirm the category spelling and underscores;
- confirm the extension is one of the six supported lowercase extensions; and
- restart Vite so the glob is recalculated.

This console import is a development-server convenience. It is not a production debug API and will not work the same way against the compiled static bundle.

### No-console smoke test

`game_start` is the easiest category to verify without developer tools:

1. put a clip in `artifacts/ludo-dz/src/assets/audio/voice/game_start/`;
2. restart the dev server and reload the app;
3. enter a game board, or use Play Again/Restart from the game flow; and
4. listen for the line.

For other categories, without the development-console method, the corresponding real game condition must be produced.

### Build verification

After adding the real assets, run:

```bash
pnpm --filter @workspace/ludo-dz run typecheck
pnpm --filter @workspace/ludo-dz run build
```

For the mobile bundle, also run:

```bash
pnpm --filter @workspace/ludo-dz run build:cordova
```

A successful build verifies that Vite accepted and emitted the matched source assets. It does not prove that every target browser/WebView can decode a chosen codec, so also test on representative Android devices and browsers.

---

## 8. Current limitations and unfinished considerations

### Playback and UX

- **No voice assets are supplied yet.** All ten folders contain only `.gitkeep`, so every current trigger is a silent no-op.
- **No debug UI exists.** Testing is via a dev-console import or real game events.
- **No separate voice setting exists.** Voice playback is not gated by the existing Sound Effects toggle and has no voice on/off or volume control.
- **No language routing exists.** The same files play whether the app UI is French or Arabic. There is no Darija/French/Arabic subfolder or manifest selection.
- **No player-perspective routing exists.** `capture_by_me` and `captured_by_opponent` are both requested for every capture and heard globally.
- **No captions/subtitles or transcript metadata exist.** Keep accessibility/localization requirements in mind if this becomes production narration.
- **Browser autoplay rules can reject a line**, especially an entry-time `game_start` line before media has been unlocked. The manager silently skips a rejected line; it does not retry it later.
- **There is no startup pre-decode/preload pass.** A category's selected clip is loaded when requested, so the first playback can have network/decode delay.
- **Errors are intentionally silent.** Missing, corrupt, or undecodable files do not crash gameplay, but there is no user-visible or developer-visible diagnostic emitted by the manager.

### Queue/randomness

- Only one voice clip plays at a time.
- While one line is active, at most **two category requests** are queued.
- Additional requests are silently skipped; they are not replayed later.
- Queue entries are not deduplicated.
- Long files make queued commentary increasingly late, which is why short lines are strongly recommended.
- Immediate repeats are prevented only when a category contains 2+ files. There is no broader repetition cooldown.
- Ducking can restore during queued playback as described in [Current queued-line ducking caveat](#current-queued-line-ducking-caveat).

### Trigger logic caveats

- `laugh_mock` currently behaves primarily as a consecutive-same-victim-color streak, not a robust “same captor or same victim” streak.
- `safe_gathering` uses a global false-to-true transition. A second mixed-color safe gathering does not trigger while any earlier mixed gathering still exists.
- `danger` is a global hypothetical 1–6 range calculation, not necessarily an immediate-next-turn warning.
- `danger_escape` checks only the moved pawn, not every pawn that may have become safe.
- A move that captures multiple stacked opposing pawns still produces one capture commentary sequence, based on the first captured pawn found for streak bookkeeping.
- The engine's prose comment naming safe cells is stale; runtime behavior uses `0, 8, 13, 21, 26, 34, 39, 47`.
- A move can request more categories than the active-plus-two queue can hold. In a capture streak, for example, the two capture lines and `laugh_mock` can fill playback capacity before danger/safe/home lines are considered.

### Asset governance

- There is no automatic validation/transcoding/loudness pipeline for voice files.
- There is no hard file-count or package-size budget.
- `artifacts/ludo-dz/SOUND_CREDITS.md` documents existing UI effects but is **not** a loader manifest. Voice clips do not need to be added there to function, but licensing/source/performer or generated-audio provenance should be documented before release.

---

## Implementation reference

The current behavior comes from these files:

- Category discovery, random selection, queueing, voice volume, and lifecycle:
  `artifacts/ludo-dz/src/lib/voice-line-manager.ts`
- Game trigger calculations and calls:
  `artifacts/ludo-dz/src/components/GameBoardScreen.tsx`
- SFX duck level and fade timing:
  `artifacts/ludo-dz/src/lib/sound-manager.ts`
- Main-track positions, finishing position, captures, and runtime safe-cell set:
  `artifacts/ludo-dz/src/lib/ludo-engine.ts`
