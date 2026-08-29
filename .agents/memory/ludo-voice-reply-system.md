---
name: Ludo DZ voice reply (ردود) scheduling + SFX ducking + speaking aura
description: Why the إخراج_بيدق reply used to land only when the game went quiet, the reservation model that replaced the reply timer, the الأكل top-priority capture event (interrupt + coalescing), how voice ducking of dice/pawn SFX is wired, and where the speaking aura lives.
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
- **Replies are guaranteed for a qualifying `إخراج_بيدق` run (2026-08-29).** The old
  probabilistic `REPLY_CHANCE` gate and the `REPLY_QUIET_WINDOW_MS` "quiet moment" gate
  are removed. `prepareReply()` no longer rolls `Math.random()` or checks recent audio
  activity. A run still produces no reply only when: the `ردود/<event>/` pool is empty,
  there is no eligible responder (no `playersInGame`, or every player in the game has now
  acted in the run), a future event preempts the reply, or voice is disabled/muted.
- **Stacked `إخراج_بيدق` runs produce exactly one reply.** `ExitReplyRunState` tracks one
  logical run. When a queued exit line actually starts playing, `onReplyPrimaryStart()`
  re-owns `pendingReply.owner` to that line and adds the line's speaker to the run's actor
  set, so the reply is ultimately fired from the last exit line that survives the
  queue-cancellation rules. `finishLine()` keeps the reply pending while
  `hasQueuedExitRunLine()` is true; it only starts the reply gap when no queued exit line
  remains. The single reply's speaker is reselected at each continuation so it still
  excludes every actor in the run.
- **Future event types take priority over the reply.** `hasForeignVoiceEventInPath()` is
  generic: any event in `VOICE_EVENTS` other than `إخراج_بيدق` (and outside the `ردود`
  reply system) is "foreign", so a newly migrated capture/danger/taunt/etc. event is
  covered automatically. If such an event is already active or queued at the moment the
  reply is scheduled, or appears while the reply is pending/gap-running,
  `cancelPendingReplyForFutures()` drops the reply entirely (never delays/requeues it).
  `cancelPendingReplyForFutures()` keeps the run marked `preempted`, so remaining
  continuation exit lines in that run cannot resurrect the dropped reply. A foreign event
  that is dropped by `MAX_QUEUE_SIZE` does not count as queued/playing and therefore does
  not preempt.
- **`إخراج_بيدق` primary line queue rules (2026-08-29, unchanged):**
  - **Scenario A (Same-turn back-to-back exits):** If a second `إخراج_بيدق` trigger arrives for the same speaker
    without an intervening turn/action from another player, it is unconditionally cancelled (never queued).
  - **Scenario B (Cross-turn exits):** Evaluated against the currently playing line's remaining duration (`EXIT_QUEUE_MAX_WAIT_MS = 1200` ms).
    If the active line finishes in <= 1200 ms, the new exit line is queued (replacing any existing queued exit line so at most 1 exit line is queued).
    If remaining wait > 1200 ms, the new exit line is cancelled. If play advances to a 3rd player (color C), any queued exit line for B is cancelled.
- `finishLine(owner)` is the single end-of-clip callback. If `pendingReply.owner === owner`,
  no foreign event is queued/active, and no queued exit line remains, it starts the reply
  after `REPLY_GAP_MIN_MS`-`REPLY_GAP_MAX_MS` measured from the last primary's **end**. The
  reply can never be dropped by queue size and never waits behind other lines (except when
  a foreign event preempts it, per above).
- `isVoiceBusy()` = `activeAudio !== null || replyGapTimer !== null`. The gap counts as
  busy, so a gameplay line fired in that window queues instead of stealing the slot.
- `armWatchdog()` guarantees `finishLine` runs even if `ended` never does (re-armed on
  `loadedmetadata` so it tracks the clip's real duration), and `playNextQueued()` loops
  past unplayable entries (returning whether it actually started a clip so `finishLine`
  can fire a reply when a queued continuation turned out to be unplayable). Together these
  make the queue impossible to wedge.

**How to apply:** any future "line B must follow line A" pairing in this file should reuse
the reservation shape (decide + preload at A's start, fire from A's end callback), not a
timer plus the shared queue.

## `الأكل` (capture) is the top-priority event and interrupts, not queues (2026-08-29)

Third registered event, same isolated-folder pattern (`voice/الأكل/`). Unlike every other
event, a capture line never waits behind anything: fired from `playResolvedVoiceLines()`
in `GameBoardScreen.tsx` (the single capture-resolution point — last-hop landing, zero-step
moves; the Neon exit-modal `resumePausedMove` path plays no voice for any event, by design),
it goes through the capture branch of `playVoiceLine`, which

- calls `stopActiveLineImmediate()` — nulls `activeAudio` *before* `pause()` so the cut
  element's `ended`/watchdog handlers no-op and `finishLine` never runs for it; works for
  primaries, replies, and clears the reply-gap;
- drops the reserved exit reply (`clearPendingReply`/`clearReplyGap` + keeps
  `exitReplyRun.preempted = true` so a queued continuation exit line still plays but
  cannot resurrect the reply);
- coalesces **stacked captures** with its own tunable `CAPTURE_COALESCE_MAX_WAIT_MS = 1500`
  (analogous to `EXIT_QUEUE_MAX_WAIT_MS`, deliberately a bit larger): if the running
  `الأكل` line finishes within 1500 ms the new capture is a separate event and gets queued
  at the **head** (a capture never queues behind stale lines; the universal no-repeat pick
  guarantees a different clip); if it has longer to run, both captures are one combined
  event and the new line is dropped along with any stale queued capture line;
- is a safe no-op when its pool is empty — it never interrupts just to leave silence.

`الأكل` is foreign to the reply system **by construction** (registered in `VOICE_EVENTS`,
not `EXIT_EVENT`), so the generic `hasForeignVoiceEventInPath()` preemption applies without
extra wiring; the capture branch upgrades it from preempt-and-queue to preempt-and-play.

**How to apply:** any future "interrupts everything" event copies this branch shape
(immediate stop + pool-empty guard + head-inserted coalescing queue). All voice pools —
primary and reply — inherit the no-immediate-repeat rule for free because selection is
funnelled through `pickRandomClip`/`pickRandomReply`; per-event pickers must keep using
them.

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
