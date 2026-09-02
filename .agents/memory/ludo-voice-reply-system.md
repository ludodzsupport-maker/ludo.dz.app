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
  - **Scenario B (Cross-turn exits):** Evaluated against the currently playing line's remaining duration (`EXIT_QUEUE_MAX_WAIT_MS = 900` ms, tightened from 1200 on 2026-09-01 — a *lower* threshold is the stricter gate: it lengthens the stretch of a line during which a newcomer is suppressed).
    If the active line finishes in <= 900 ms, the new exit line is queued (replacing any existing queued exit line so at most 1 exit line is queued).
    If remaining wait > 900 ms, the new exit line is cancelled. If play advances to a 3rd player (color C), any queued exit line for B is cancelled.
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
- coalesces **stacked captures** with its own tunable `CAPTURE_COALESCE_MAX_WAIT_MS = 1150`
  (tightened from 1500 on 2026-09-01 in step with `EXIT_QUEUE_MAX_WAIT_MS`, keeping the same
  ~1.25× ratio — deliberately a bit larger than the exit window): if the running
  `الأكل` line finishes within 1150 ms the new capture is a separate event and gets queued
  at the **head** (a capture never queues behind stale lines; the recency-gated pick
  guarantees a different clip); if it has longer to run, both captures are one combined
  event and the new line is dropped along with any stale queued capture line;
- is a safe no-op when its pool is empty — it never interrupts just to leave silence.

`الأكل` is foreign to the reply system **by construction** (registered in `VOICE_EVENTS`,
not `EXIT_EVENT`), so the generic `hasForeignVoiceEventInPath()` preemption applies without
extra wiring; the capture branch upgrades it from preempt-and-queue to preempt-and-play.

**How to apply:** any future "interrupts everything" event copies this branch shape
(immediate stop + pool-empty guard + head-inserted coalescing queue). All voice pools —
primary and reply — inherit clip selection for free because it is funnelled through
`pickClip`/`pickReply` (renamed from `pickRandomClip`/`pickRandomReply` on 2026-09-01);
per-event pickers must keep using them.

## Clip selection is four-layer: min-separation + soft recency + jitter + wildcard (2026-09-02)

`ClipSelector` (one instance per primary pool and per `ردود` reply pool) replaced the old
"uniform random, never the same clip twice in a row" rule. The 2026-09-01 version (hard
`round(n/3)` recency gate + `maxPlays - plays + 1` deficit weighting) balanced long-run
exposure well, but a listener could *feel* a soft rotation: the hard gate gave a learnable
"out of the running" set, and the deficit re-boosted a clip right as its cooldown expired,
so a clip's returns clustered around one near-constant gap. The current draw computes
`weight = deficit × softRamp × jitter` per clip, with four layers:

1. **Minimum separation — the only hard rule.** `age === 1` (picked on the immediately
   preceding draw) → weight 0. Nothing else is ever excluded outright, so there is no
   cooldown window to anticipate.
2. **Soft recency ramp.** `min(1, age / rampHorizon)²` with `rampHorizon = n/3` (same
   clamped pool share the old gate used — same average cadence, no cliff). Never-played
   clips have `age = ∞` → full ramp.
3. **Jittered fairness.** The bounded deficit `maxPlays - plays + 1` is kept exactly (still
   fully fair long-run), but each weight is multiplied by `e^(σ·z)`, `z ~ N(0,1)`,
   `σ = 0.5`: expected order still favours laggers, actual order is re-rolled every draw.
4. **Wildcard draws.** With probability 0.07 the draw is uniform over the pool minus the
   last clip (unbiased, so fairness-neutral): this is the source of the rare close echo
   that breaks the "recent clips never come back" inference.

n = 2-3 collapse to forced alternation (identical to the old rule). O(n) per pick, no
allocation (weight scratch buffer reused), per-session in-memory state. Simulated over 30n
draws (40 seeds, n = 10/28/50): play-count spread widens only ~1.2× vs the old selector
and stays bounded at 200n draws (self-correcting deficit); immediate-repeat rate is 0;
gap-≤5 returns go from ~0 % (n = 28/50) to a few per session; per-clip gap CV rises
(n = 50: 0.58 → 0.71) and min observed gap drops from `window + 1` exactly to 2 — the
near-constant return spacing that made the old selector feel cyclical is gone. Never-played
clips carry the largest weight, so clips added to a folder later surface quickly.
Tunables: `RECENCY_WINDOW_RATIO` (1/3), `RECENCY_RAMP_EXPONENT` (2),
`FAIRNESS_JITTER_SIGMA` (0.5), `WILDCARD_CHANCE` (0.07).

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
