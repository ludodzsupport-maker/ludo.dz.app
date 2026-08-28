---
name: Ludo DZ voice reply (ردود) scheduling + SFX ducking + speaking aura
description: Why the إخراج_بيدق reply used to land only when the game went quiet, the reservation model that replaced the reply timer, how voice ducking of dice/pawn SFX is wired, and where the speaking aura lives.
---

## The reply is a reservation on the primary line, not a queue entry or a timer

Original design (2026-08-28, replaced): `maybeScheduleReply` fired a `setTimeout` of
500-1000 ms measured from the moment the **primary** line *started*, and the callback
pushed the reply into the same `MAX_QUEUE_SIZE = 2` no-overlap queue used by ordinary
lines. Three failure modes came out of that shape, and together they produced the
reported symptom ("the reply only comes out when I stop playing"):

1. **Start-anchored race.** Primary clips run 1.5-2.5 s, so the timer essentially always
   fired mid-primary and the reply became an ordinary queue entry whose start time was
   decided by unrelated queue traffic, not by the primary's end.
2. **Droppable + unprioritised.** `if (queue.length < MAX_QUEUE_SIZE) queue.push(...)` —
   during busy play (double-six exits queue a second `إخراج_بيدق`) the reply is silently
   discarded, and even when it fits it can sit behind other lines.
3. **One drain point, no watchdog.** The queue advanced *only* from the playing element's
   `ended`/`error` handler. Anything that stops that handler from running (an element
   that never reaches `ended`, an OS audio-focus interruption on Android WebView, a
   `stopVoiceLines()` from a lifecycle path) leaves `activeAudio` non-null forever, so the
   queued reply never drains — and the SFX duck never lifts either. A queued item whose
   pool resolved empty also `return`ed without recursing, stalling everything behind it.
   Aggravating factor: the reply's `Audio` element was constructed at play time, so its
   mp3 fetch/decode happened in the middle of a dice-roll/pawn animation.

Current model in `voice-line-manager.ts`:

- `prepareReply()` runs when a replyable primary **starts**: it picks the responder
  and clip, and creates + `load()`s the element up front (preloaded, so playback is
  instant later). The result is stored in `pendingReply` tagged with its `owner` (the
  primary's element). Nothing is scheduled on a clock.
- **Replies are unconditional (2026-08-28).** The original `REPLY_CHANCE = 0.35`
  probability gate was removed outright (constant deleted, not set to 1.0) — every
  replyable primary line is answered. The only randomness left is which clip plays,
  which player answers (uniform among `playersInGame` minus the acting player), and
  the gap jitter. The two structural no-ops remain: an empty `ردود/<event>/` folder,
  and no eligible responder (no `playersInGame`, or the actor is the only player).
- `finishLine(owner)` is the single end-of-clip callback. If `pendingReply.owner === owner`
  it starts the reply after `REPLY_GAP_MIN_MS`-`REPLY_GAP_MAX_MS` measured from the
  primary's **end**. The reply can never be dropped by queue size and never waits behind
  other lines.
- `isVoiceBusy()` = `activeAudio !== null || replyGapTimer !== null`. The gap counts as
  busy, so a gameplay line fired in that window queues instead of stealing the slot.
- `armWatchdog()` guarantees `finishLine` runs even if `ended` never does (re-armed on
  `loadedmetadata` so it tracks the clip's real duration), and `playNextQueued()` loops
  past unplayable entries. Together these make the queue impossible to wedge.

**How to apply:** any future "line B must follow line A" pairing in this file should reuse
the reservation shape (decide + preload at A's start, fire from A's end callback), not a
timer plus the shared queue.

## Voice ducking lives in sound-manager and covers every SFX by construction

`setSfxDucking(boolean)` (sound-manager.ts) is level-based and idempotent, driven from
`syncDucking()` in the voice manager. Tunables: `SFX_DUCK_LEVEL`, `SFX_DUCK_FADE_IN_MS`,
`SFX_DUCK_FADE_OUT_MS`. Two paths, one multiplier: synthesized cues share the single
`sfxMasterGain` bus (`getSfxDestination`) and get a native `linearRampToValueAtTime`;
cached HTMLAudio UI cues have no ramp API so their multiplier is stepped on a 16 ms timer
over the same window. Because *every* per-theme cue (Neon/Classic/DZ dice roll, pawn step,
capture, click, jingle) already connects through `getSfxDestination`, ducking needs no
per-cue changes — a new cue is ducked automatically as long as it uses that destination.
BGM has its own `bgmMasterGain` and is deliberately untouched. The duck is held
continuously across the primary → gap → reply exchange (that is what `isVoiceBusy()` is
for) rather than toggling per clip.

## Speaking indicator: aura is the primary cue, equalizer bars are secondary

`GameBoardScreen.tsx` has two components. `SpeakingAura` (dominant) renders in the
`CornerDice` outer wrapper at `zIndex: 0`, behind the card (the card itself is
`position: relative; zIndex: 1`) — it must live in the wrapper, not inside the card, since
the card sets `overflow: hidden` and would clip any ring drawn outside its box. It mirrors
the card's own `panelScale`/`panelOrigin`/`panelRadius` (extracted into consts shared by
both) so ring and card stay concentric while the active card leans in. `SpeakingIndicator`
(the three-bar equalizer) stays as a quiet supporting cue next to the player name.

Sizes derive from `panelLayout.panelW` (ratios `SPEAK_RING_RATIO`/`SPEAK_BLOOM_RATIO`), not
fixed px, so the effect scales with the board on every phone. The manager broadcasts
`{ player, kind }` where `kind` is `'primary' | 'reply'`; a reply gets a thicker ring, a
faster breath (`SPEAK_BREATH_S`) and a second entrance burst — that difference is the
"duel/answering back" read. `useReducedMotion` falls back to a static but still bright
ring + halo (never to nothing), and drops the entrance bursts.
