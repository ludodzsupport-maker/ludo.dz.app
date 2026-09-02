import { setSfxDucking } from './sound-manager';

// ─────────────────────────────────────────────────────────────────────────────
// Event-isolated voice commentary
//
// Every event owns one dedicated folder under `src/assets/audio/voice/<event>/`.
// Every audio file inside that folder is the event's clip pool, and no clip is
// ever shared between events. Selecting a line is a random pick from that
// event's own pool — no mood tags, no cross-event eligibility. The draw is not
// uniform: it enforces a hard no-repeat (never the same line twice in a row) on
// top of a soft recency ramp, jittered play-count balancing, and rare wildcard
// draws, so every clip in a pool gets even exposure over a long session,
// however large the pool grows — without any perceptible rotation. See
// `ClipSelector`.
//
// Events are registered one at a time. `VOICE_EVENTS` is the single source of
// truth; adding an event here (with its Arabic key + folder) is all that's
// needed to bring its pool online.
//
// Priority exception: `الأكل` (capture) is the system's top-priority event. It
// does not queue behind anything — it interrupts the active line (primary or
// reply) and starts immediately; consecutive captures coalesce via their own
// run rule. The capture also has a guaranteed reply: the captured piece's
// owner answers back at the captor, fired from the end of the run's last
// surviving capture line. That reply is a follow-up to the capture's
// priority, never a replacement for it — a new capture still cuts in over a
// playing capture reply. See CAPTURE_COALESCE_MAX_WAIT_MS and the capture
// branch in `playVoiceLine`.
//
// `التهديد` (threat) is a queue-tier event like `إخراج_بيدق`: it never
// interrupts, plays immediately when voice is idle, and otherwise queues (or
// is cancelled) by the same remaining-wait rule as exits. Near-simultaneous
// threats coalesce into one line using the same run shape as captures — see
// the threat branch in `playVoiceLine`.
//
// `الهروب` (escape) closes the threat relationship: it fires when a piece that
// was under threat is no longer inside its attacker's 1-2 square range. It is
// queue-tier like `التهديد` and shares its coalescing run rule, with three
// behaviours of its own:
//   • it **waits out a playing `التهديد` line**: the escape is the resolution of
//     the warning that line is announcing, so it never interrupts it and never
//     overlaps it — it plays immediately once the threat line ends naturally,
//     however much of it was left;
//   • it **outranks `إخراج_بيدق` in the queue** (see `insertEscapeByPriority`):
//     when the two contend for the same slot, the escape plays (or queues
//     ahead) and the exit yields, even though `إخراج_بيدق` is the baseline
//     queue-and-wait event;
//   • like every queue-tier event it never interrupts anything else.
//
// `ضمّ` (lap completion) fires when a piece completes its full circuit — the
// shared loop, its home column — and lands on its final home slot. It is
// queue-tier like the others (it never interrupts anything) and coalesces with
// the standard remaining-wait run rule, with one special relationship: vs a
// playing `الأكل` line it uses the near/far wait-and-threshold decision (see
// the ضمّ branch in `playVoiceLine`) — the capture line is never interrupted,
// but a long capture exchange never delays the milestone either. The
// colour-completing arrival (the colour's last piece reaching home, i.e. the
// colour finishing the game) never fires this event: that moment belongs to
// the victory/finish event, so the call site gates it.
// ─────────────────────────────────────────────────────────────────────────────

/** Registered voice events. The key is the Arabic folder name under `voice/`. */
export const VOICE_EVENTS = ['بداية_اللعبة', 'إخراج_بيدق', 'الأكل', 'التهديد', 'الهروب', 'ضمّ'] as const;
export type VoiceLineEvent = (typeof VOICE_EVENTS)[number];

/** Arabic display label for each registered event. */
export const VOICE_EVENT_LABELS: Readonly<Record<VoiceLineEvent, string>> = {
  'بداية_اللعبة': 'بداية اللعبة',
  'إخراج_بيدق': 'إخراج بيدق',
  'الأكل': 'الأكل',
  'التهديد': 'التهديد',
  'الهروب': 'الهروب',
  'ضمّ': 'ضمّ',
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
// primary line(s), as a direct back-and-forth. Both registered replyable events
// are guaranteed (probabilistic gating and the old "quiet moment" gate are gone):
// a qualifying run always produces exactly one reply, subject only to the
// structural preconditions below and to future-event priority.
//
//   • `إخراج_بيدق`: the responder is a uniform pick among the players currently
//     in the game, excluding every actor involved in the run.
//   • `الأكل`: the responder is deterministic — the captured (victim) player,
//     passed as `replySpeaker`, answering back at the captor (the line's
//     `speaker`). No random pick and no fallback: if the victim is unknown there
//     is simply no reply. Targeting reuses the existing speaker/kind plumbing —
//     the reply is tied to the captor's run and announced with the `reply`
//     speaking kind on the victim's panel.
//
// It reuses the same isolated-folder model: the reply pool lives under
// `voice/ردود/<event>/` and is shared across all players (the audio content is
// generic; only the speaking indicator is tied to a specific player). No clip is
// shared between events, nor between an event and its own replies, and the same
// minimum-separation, softly-ramped, jittered selection (`ClipSelector`)
// applies within each reply pool.
//
// To enable replies for a new event, add its key to `REPLYABLE_EVENTS` and drop
// clips into `voice/ردود/<event>/` — nothing else changes. The pool is auto-built,
// and the future-event priority check below applies automatically to any new
// registered event without extra wiring.
//
// Scheduling model (see the "reply reservation" section further down):
// the reply is decided and *preloaded* when a replyable primary line starts, but
// it is fired from the end of the *last line in that logical run* — never from
// a wall-clock timer racing the run, and never as an ordinary, droppable queue
// entry. A short conversational beat (REPLY_GAP_*_MS) separates the primary's end
// from the reply's start, so the reply never overlaps or precedes the primary.
//
// Runs: a reply belongs to a *run* — one currently-playing line of an event plus
// whichever queued lines of the same event actually survive the coalescing /
// queue-cancellation rules and play after it. The whole run is one logical event
// and produces exactly one reply (not one per line):
//   • a `إخراج_بيدق` run groups stacked exits behind the existing queue
//     cancellation rules;
//   • an `الأكل` run follows CAPTURE_COALESCE_MAX_WAIT_MS 1:1 — a stacked capture
//     inside the coalescing window is combined (no new line, the reserved reply
//     is untouched), one outside it plays a fresh line and re-owns the pending
//     reply (the speaker becomes the newest victim) — so the number of replies
//     always equals the number of capture lines that actually play.
// One run state exists per replyable event, so a preempted `إخراج_بيدق` tail can
// wait in the queue while a live `الأكل` run (and its reply) runs, and vice versa.
// See `ReplyRunState`.
//
// Future-event priority: if a different event is already active or queued ahead
// of the run at the moment a reply would be scheduled — or if one appears while a
// run/reply is pending — that event takes priority and the pending reply is
// dropped entirely (never delayed, never requeued). The check is relative to the
// run's own event: a queued line of the run's event is a continuation (it
// re-owns the reply), anything else registered is foreign. See
// `hasForeignVoiceEventInPath`.
//
// The only ways a reply does not happen are: an empty `voice/ردود/<event>/`
// folder, no eligible responder (the caller passed no `playersInGame`, or every
// player in the game is an actor in the run, or — for `الأكل` — no victim was
// passed), a future event preempting it, or voice being disabled/muted.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tunable threshold (in milliseconds) for queuing a cross-turn `إخراج_بيدق` line (Scenario B).
 * If the currently playing line is expected to finish within this wait window, the new exit line is queued;
 * if it will take longer, the new exit line is cancelled to prevent stale audio backlog.
 *
 * The comparison is against *whatever* line is currently playing, which also
 * covers a playing capture reply (ردود/الأكل): an exit that lands with <= this
 * much of the reply left queues normally and plays right after; an exit that
 * lands with a longer stretch of reply remaining is cancelled entirely (and,
 * since a cancelled line never starts, never reserves one, its own reply can
 * never fire either).
 *
 * Reused deliberately instead of a separate capture-reply constant: it is the
 * identical decision ("will the active line finish within one conversational
 * beat?") for the identical class of line — the measured reply pools sit at
 * ~1.9-7.7 s, the same class as primary lines — so a second threshold would
 * just create a second knob for the same question.
 *
 * The same constant also governs `التهديد`'s and `الهروب`'s coalescing — see
 * the threat and escape branches in `playVoiceLine`. Threat and escape are two
 * halves of one relationship (a pair appears, a pair is resolved), they fire
 * from the same board scan, and their pools are the same class of line, so
 * giving them the same "one conversational beat" window keeps one knob for one
 * question and makes the pair behave symmetrically. Only `الأكل` — the event
 * the player most wants heard — widens it, with CAPTURE_COALESCE_MAX_WAIT_MS.
 *
 * `ضمّ` reuses it too, for both of its decisions (coalescing vs another `ضمّ`
 * line, and the near/far priority call vs a playing `الأكل` line). Same
 * reasoning as the threat/escape pair: it is the identical "will the active
 * line finish within one conversational beat?" question about the same class
 * of line, and `ضمّ` has no interrupt privilege that would justify widening
 * its window the way the top-priority `الأكل` does — so a second knob at the
 * same value would just be a duplicate dial for one question.
 *
 * Tightened 1200 → 900 ms (2026-09-01). The threshold is the *upper bound* on
 * how much of the audible line may remain for a second trigger to still earn
 * its own line, so lowering it lengthens the stretch of a line during which a
 * newcomer is suppressed (a line of length D suppresses over its first
 * `D - threshold` ms instead of `D - 1200`). Consecutive triggers therefore
 * coalesce/cancel more often and produce fewer immediately back-to-back lines;
 * only triggers that land in the final ~0.9 s of the audible line — where a
 * follow-up still reads as a reaction to its own moment rather than as a
 * rushed queue drain — get a line of their own.
 */
export const EXIT_QUEUE_MAX_WAIT_MS = 900;

/**
 * `الأكل` (a piece captures/eats another piece) — the highest-priority voice
 * event in the system. Unlike `إخراج_بيدق`, a capture line never queues behind
 * anything: when it fires, whatever is currently speaking (any primary line,
 * any reply, mid reply-gap) is cut off on the spot and the capture line starts
 * immediately. The one exception is a *stacked* capture — see below.
 *
 * Tunable threshold (in milliseconds) for consecutive `الأكل` events. When a
 * capture fires while an `الأكل` line from a previous capture is still audible,
 * the remaining duration of the running line decides:
 *  • remaining wait <= threshold → the captures are separate events: the
 *    running line finishes and a fresh (different-clip) capture line plays;
 *  • remaining wait  > threshold → both captures are one combined event: the
 *    running line already covers them, so no second line is queued.
 * Default 1150 ms: capture reactions in this game's style run ~1.5-4 s (the
 * existing primary pools measure 1.8-4.0 s), and a second capture realistically
 * lands 2-6 s after the first (pawn defeat arc + extra-turn roll). With 1150 ms,
 * captures landing in the last ~1.15 s of the running line still get their own
 * follow-up line (feels responsive), while earlier ones — which would otherwise
 * start long after their visual moment or machine-gun-interrupt each other —
 * coalesce into the line already playing. Slightly larger than
 * EXIT_QUEUE_MAX_WAIT_MS (900 ms) on purpose: capture lines are the event the
 * player most wants heard, so the "give it a separate line" window is wider.
 *
 * Tightened 1500 → 1150 ms (2026-09-01), in step with EXIT_QUEUE_MAX_WAIT_MS
 * (see that constant for why a *lower* value is the stricter gate) and keeping
 * the same ~1.25× ratio between the two windows, so the capture event stays
 * the most permissive one relative to everything else while stacked captures
 * coalesce into one line more readily than before.
 *
 * The capture reply (ردود/الأكل) follows this run rule 1:1: the reply is
 * reserved on the running capture line and re-owned to every stacked capture
 * line that survives this coalescing check, so exactly one reply fires per
 * surviving capture-line run — captures combined into one shared line yield
 * one reply, not one per captured piece.
 */
export const CAPTURE_COALESCE_MAX_WAIT_MS = 1150;

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
  // The captured piece's owner answers back at the captor. Guaranteed, like
  // `إخراج_بيدق`: exactly one reply per surviving capture-line run (captures
  // coalesced into a single shared line produce a single reply).
  'الأكل': true,
};

// ─── Speaking indicator ───────────────────────────────────────────────────────
// The visual "someone is speaking" state. Whenever a line starts playing for a
// specific player, a single speaker is broadcast; when it ends (or a line with
// no speaker plays), the speaker is cleared. UI subscribes via `subscribeSpeaking`.
// `kind` lets the UI treat a reply ("this player is answering back") with a
// stronger, duel-flavoured treatment than an ordinary primary line. `event`
// says which registered event is audible (a reply carries the event it answers,
// e.g. 'الأكل' for the capture reply), and `piece` — when the caller supplied
// one — names the exact board pawn carrying the line, so per-piece visuals can
// target it instead of (or alongside) a whole corner panel.
export type SpeakingKind = 'primary' | 'reply';
export type SpeakingState = {
  player: number;
  kind: SpeakingKind;
  /** Registered event the audible line belongs to; null for unmigrated events. */
  event: VoiceLineEvent | null;
  /** Board-piece index of the pawn carrying the line, when known. */
  piece?: number;
} | null;
type SpeakingListener = (state: SpeakingState) => void;
const speakingListeners = new Set<SpeakingListener>();
let currentSpeaking: SpeakingState = null;

/** Options that accompany a single `playVoiceLine` call. */
export interface VoiceLineContext {
  /** The player this commentary belongs to — drives the speaking indicator. */
  speaker?: number;
  /**
   * The speaker's board-piece index (0-3) when the line is about one specific
   * pawn. Purely visual — never affects audio selection or scheduling. The
   * speaking broadcast echoes it back as `SpeakingState.piece` so per-piece
   * effects (the capture speaking echo on the captor's pawn) can target the
   * exact piece for exactly as long as the line is audible.
   */
  piece?: number;
  /** Players currently in the game — required only to target a reply. */
  playersInGame?: readonly number[];
  /**
   * For `الأكل`: the player who owns the captured piece (the victim). The
   * capture reply is spoken by this player, answering back at the captor
   * (`speaker`). When absent, no capture reply is reserved — it never falls
   * back to a random player or to the captor.
   */
  replySpeaker?: number;
  /**
   * For `الأكل`: the captured piece's own index. Echoed on the reply's
   * speaking broadcast so the victim's pawn (back in its home bay by the time
   * the reply plays) can carry the reply half of the capture speaking echo.
   */
  replyPiece?: number;
}

/**
 * Subscribe to speaking-state changes. The listener is invoked immediately with
 * any in-progress speaker and then on every change; returns an unsubscribe fn.
 * The state is `{ player, kind, event, piece? }` while a line for that player is
 * audible, else `null` — start/end are exact: set when a clip actually starts
 * playing, cleared on natural end, error, watchdog, interrupt, or stop.
 */
export function subscribeSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener);
  if (currentSpeaking) listener(currentSpeaking);
  return () => { speakingListeners.delete(listener); };
}

function notifySpeaking(state: SpeakingState): void {
  if (currentSpeaking?.player === state?.player
    && currentSpeaking?.kind === state?.kind
    && currentSpeaking?.event === state?.event
    && currentSpeaking?.piece === state?.piece) return;
  currentSpeaking = state;
  speakingListeners.forEach(listener => listener(state));
}

interface VoiceClip {
  path: string;
  url: string;
}

// ─── Clip selection: min-separation, soft-recency, jittered-fairness ────────
//
// Within one pool, picking a clip has two competing goals: each individual pick
// must feel unpredictable, and across a long session every clip in the pool
// must get roughly the same amount of airtime. A plain uniform draw satisfies
// the first and fails the second (with n clips, the chance a given clip is
// still unheard after n draws is ~37 %, and the gap only widens as pools grow),
// while a strict rotation satisfies the second and fails the first. A naive
// fairness mechanism (a hard recency cooldown + play-count weighting) is
// itself *perceptible*: the hard cooldown means a listener can always know
// which clips are "out of the running", and the deficit weight re-boosts a
// clip the moment its cooldown expires, so a clip's returns cluster around one
// near-constant gap — a soft rotation the ear eventually learns. `ClipSelector`
// keeps the deficit weighting (long-run fairness) but makes every other part
// of the mechanism soft, jittered, or occasionally bypassed — see the class
// doc.
//
// Both the primary pools and the `ردود` reply pools go through it, so any pool
// added later inherits the behaviour without extra wiring.

/**
 * Share of a pool the soft-recency ramp spans. With `rampHorizon = n/3` draws,
 * a clip's weight climbs smoothly from ~0 just after it played back up to full
 * once `n/3` draws have passed — the same cadence the old hard gate enforced,
 * but as a fade instead of a cliff. Clamped to `[1, n - 1]` at use, like the
 * gate it replaced. With 2-3 clips the fade saturates immediately, so the
 * selector collapses to exactly the old "never the same clip twice in a row".
 */
const RECENCY_WINDOW_RATIO = 1 / 3;

/**
 * Exponent of the soft-recency ramp: `min(1, age / rampHorizon)²`. Squaring
 * keeps recently-played clips *very* unlikely (at n = 50 a gap-2 return is
 * well under 1 % of a fresh clip's weight) while still never making them
 * impossible — the asymmetry that keeps short-term variety tight but the
 * schedule unlearnable.
 */
const RECENCY_RAMP_EXPONENT = 2;

/**
 * Standard deviation of the multiplicative jitter applied to every weight:
 * each weight is scaled by `e^(σ·z)` with z a standard normal. The *expected*
 * weight ordering still favours the same lagging clips, so long-run exposure
 * is unchanged, but the *actual* ordering is re-rolled on every draw — with
 * σ = 0.5 a weight is typically perturbed by roughly ±65 %, so who is "most
 * due" flips far more often than it survives.
 */
const FAIRNESS_JITTER_SIGMA = 0.5;

/**
 * Probability that a draw ignores all weighting and is uniform over the pool
 * minus the last clip. Unbiased, so it costs long-run fairness nothing, but
 * one draw in ~14 is fully independent of the fairness state — the source of
 * the rare close echo ("didn't I just hear that?") that makes the commentary
 * feel genuinely spontaneous rather than rotated.
 */
const WILDCARD_CHANCE = 0.07;

/**
 * Standard-normal sample (Box–Muller) for the weight jitter — a pair of
 * uniforms per sample, no allocation.
 */
function randomGaussian(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Picks clips from one fixed pool: minimum separation, a soft recency ramp,
 * jittered play-count weighting, and occasional wildcard draws.
 *
 * 1. **Minimum separation — the only hard rule.** The clip picked on the
 *    immediately preceding draw is ineligible, so the same line never plays
 *    twice in a row. Nothing else is ever excluded outright: there is no
 *    cooldown window, hence no "out of the running" set a listener could learn
 *    to anticipate.
 *
 * 2. **Soft recency ramp — short-term variety without a cliff.** Every eligible
 *    clip's weight is scaled by `min(1, age / rampHorizon)²`, where `age` is
 *    how many draws ago it last played (`∞` for never-played clips, which get
 *    the full ramp). The horizon is the same `n/3` pool share the old hard gate
 *    used — `RECENCY_WINDOW_RATIO` — but as a smooth fade: the most recent
 *    clips are merely very unlikely, never impossible, and returns are no
 *    longer clustered right at a cliff.
 *
 * 3. **Jittered fairness — long-term evenness that cannot be tracked.** The
 *    bounded deficit `maxPlays - plays + 1` from the old selector is kept
 *    exactly: under-played clips stay proportionally likelier, an evenly used
 *    pool still degenerates toward a uniform draw, and a never-played clip
 *    (`plays = 0`, e.g. a file dropped into the folder for a later build) still
 *    carries the largest weight and is surfaced quickly. Each weight is
 *    additionally multiplied by `e^(σ·z)` (standard normal,
 *    `FAIRNESS_JITTER_SIGMA`): the *expected* ranking still favours lagging
 *    clips, but the *actual* ranking is re-rolled every draw, so the
 *    "who's due next" logic is unlearnable even in principle.
 *
 * 4. **Wildcard draws — the anti-pattern breaker.** With probability
 *    `WILDCARD_CHANCE` the draw ignores all weighting and is uniform over the
 *    pool minus the last clip. The wildcard is itself unbiased (it cannot
 *    disturb long-run exposure), but it makes the rare close echo actually
 *    happen a handful of times per session — the one kind of event that proves
 *    to a listener there is no rotation rule at all.
 *
 * Cost per pick is O(n) with zero allocation (the weight buffer is reused) and
 * O(n) memory for the whole pool, so growing a category from 5 clips to 100
 * changes nothing structurally. State is per-session and in-memory, matching
 * the previous behaviour.
 */
class ClipSelector {
  private readonly pool: readonly VoiceClip[];
  /** Times each clip has played this session. */
  private readonly plays: number[];
  /** Draw ordinal at which each clip last played; `-Infinity` = never played. */
  private readonly lastPickedAt: number[];
  /** Reused scratch buffer for the per-draw weights (no per-pick allocation). */
  private readonly weights: number[];
  /** Monotonic count of draws served — the clock recency and fairness read. */
  private draws = 0;

  constructor(pool: readonly VoiceClip[]) {
    this.pool = pool;
    this.plays = new Array<number>(pool.length).fill(0);
    this.lastPickedAt = new Array<number>(pool.length).fill(Number.NEGATIVE_INFINITY);
    this.weights = new Array<number>(pool.length).fill(0);
  }

  /** Next clip for this pool, or `null` when the pool is empty. */
  next(): VoiceClip | null {
    const n = this.pool.length;
    if (n === 0) return null;
    if (n === 1) return this.take(0);

    // The soft ramp spans the same pool share the old hard gate did, so the
    // average cadence is unchanged; only the enforcement changes (fade, not
    // exclusion).
    const rampHorizon = Math.min(n - 1, Math.max(1, Math.round(n * RECENCY_WINDOW_RATIO)));
    const wildcard = Math.random() < WILDCARD_CHANCE;

    let maxPlays = 0;
    for (let i = 0; i < n; i += 1) {
      if (this.plays[i] > maxPlays) maxPlays = this.plays[i];
    }

    let total = 0;
    for (let i = 0; i < n; i += 1) {
      // Draws since this clip last played; `∞` for never-played clips.
      const age = this.draws - this.lastPickedAt[i];
      // Minimum separation — the only hard rule in the selector: the clip that
      // just played cannot repeat this draw. At most one clip has `age === 1`.
      if (age === 1) {
        this.weights[i] = 0;
        continue;
      }
      let weight: number;
      if (wildcard) {
        // Ignore all weighting: uniform over the pool minus the last clip.
        weight = 1;
      } else {
        const deficit = maxPlays - this.plays[i] + 1;
        const ramp = Math.pow(Math.min(1, age / rampHorizon), RECENCY_RAMP_EXPONENT);
        const jitter = Math.exp(FAIRNESS_JITTER_SIGMA * randomGaussian());
        weight = deficit * ramp * jitter;
      }
      this.weights[i] = weight;
      total += weight;
    }

    // `total` is always > 0 (at least `n - 1` clips are eligible).
    let ticket = Math.random() * total;
    for (let i = 0; i < n; i += 1) {
      ticket -= this.weights[i];
      if (ticket < 0) return this.take(i);
    }

    // Floating-point guard only: fall back to the last eligible clip.
    for (let i = n - 1; i >= 0; i -= 1) {
      if (this.weights[i] > 0) return this.take(i);
    }
    return this.take(n - 1);
  }

  private take(index: number): VoiceClip {
    this.plays[index] += 1;
    this.lastPickedAt[index] = this.draws;
    this.draws += 1;
    return this.pool[index];
  }
}

function buildPool(prefix: string): VoiceClip[] {
  return Object.entries(VOICE_FILES)
    .filter(([path]) => path.includes(prefix))
    .map(([path, url]) => ({ path, url }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// One isolated pool per registered event, built from that event's folder only,
// plus the selector that owns that pool's exposure history. Reply pools
// (`ردود/<event>/`) get the same treatment, kept separate so an event and its
// replies never share clips or history.
const eventPools = new Map<VoiceLineEvent, VoiceClip[]>();
const eventSelectors = new Map<VoiceLineEvent, ClipSelector>();
const eventReplySelectors = new Map<VoiceLineEvent, ClipSelector>();

for (const event of VOICE_EVENTS) {
  const pool = buildPool(`/voice/${event}/`);
  eventPools.set(event, pool);
  eventSelectors.set(event, new ClipSelector(pool));
  eventReplySelectors.set(event, new ClipSelector(buildPool(`/voice/ردود/${event}/`)));
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

interface ActiveLineInfo {
  event: VoiceLineTrigger | 'reply';
  speaker?: number;
  startTime: number;
  durationMs: number | null;
  audio: HTMLAudioElement;
}

let activeLineInfo: ActiveLineInfo | null = null;
let lastExitSpeaker: number | null = null;

/**
 * Tracks a logical run of one replyable event so a stacked run produces
 * exactly one reply.
 *
 * The run starts when the first line of the event starts playing and ends when
 * no line of the event is active or queued any more. Every actor in the run
 * (each speaker whose line actually plays) is collected: for `إخراج_بيدق` it
 * keeps the responder pick a uniform guess among the players that were *not*
 * involved in the run; for `الأكل` it records the captor(s) the run's victim
 * answers back at.
 */
interface ReplyRunState {
  /** The event this run's reply is for. */
  event: VoiceLineEvent;
  /**
   * The line that currently owns the reserved reply. As a stacked queued line
   * starts playing, ownership is moved to that line (re-owned), so the reply
   * is ultimately tied to the end of the last line that survives the
   * coalescing / queue-cancellation rules.
   */
  owner: HTMLAudioElement;
  /** Every speaker that has actually played inside this run. */
  actors: Set<number>;
  /**
   * True once a foreign event has preempted this run. The run's single reply
   * is dropped permanently; remaining continuation lines cannot resurrect it.
   */
  preempted: boolean;
}

/**
 * One run state per replyable event. A run (and the pending reply it owns) is
 * tracked per event, so a preempted `إخراج_بيدق` tail can wait in the queue
 * while a live `الأكل` run (and its reply) runs, and vice versa.
 */
const replyRunByEvent: Partial<Record<VoiceLineEvent, ReplyRunState>> = {};

function getReplyRun(event: VoiceLineEvent): ReplyRunState | null {
  return replyRunByEvent[event] ?? null;
}

function clearReplyRun(event: VoiceLineEvent): void {
  delete replyRunByEvent[event];
}

function clearAllReplyRuns(): void {
  for (const event of Object.keys(replyRunByEvent)) {
    delete replyRunByEvent[event as VoiceLineEvent];
  }
}

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
// The reply is not a queue entry. It is a slot reserved on a primary line
// itself (`owner`), decided + preloaded at the start of the line that owns it
// and consumed by that owner's end callback. For stacked `إخراج_بيدق` runs the
// ownership is re-pointed at each surviving exit line, so the reply is always
// tied to the end of the last exit line in the run. Consequences that matter:
//   • it can never be dropped by MAX_QUEUE_SIZE, and never has to wait behind
//     unrelated lines that happen to be queued;
//   • the short gap between the last primary and the reply counts as "voice
//     busy", so a gameplay-triggered line firing in that window queues instead
//     of stealing the slot, and the SFX duck holds across the whole exchange.
interface PendingReply {
  event: VoiceLineEvent;
  speaker: number;
  /**
   * For `الأكل`: the victim's board-piece index (`replyPiece`), kept so the
   * reply's speaking broadcast targets the captured pawn for the reply echo.
   */
  piece?: number;
  clip: VoiceClip;
  /** Element created (and `load()`-ed) up front so the reply starts instantly. */
  audio: HTMLAudioElement;
  /** The primary element whose end fires this reply (re-owned per run). */
  owner: HTMLAudioElement;
  /**
   * Every speaker already involved in the run — the exit speakers for an
   * `إخراج_بيدق` reply, the captor(s) for an `الأكل` reply (the reply's target).
   */
  actors: Set<number>;
  /** Players available to answer, kept so a stacked run can reselect speakers. */
  playersInGame: readonly number[];
}
let pendingReply: PendingReply | null = null;
let replyGapTimer: ReturnType<typeof setTimeout> | null = null;

/** True while a line is audible, or while the primary→reply gap is running. */
function isVoiceBusy(): boolean {
  return activeAudio !== null || replyGapTimer !== null;
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

/**
 * Cut off the active line (any primary or reply) instantly, without running
 * its end-of-line logic. `activeAudio` is nulled *before* the pause so the
 * element's own `ended`/`error` handlers and the watchdog no-op, and
 * `finishLine` never fires for the interrupted line — the caller (the capture
 * event) owns the slot afterwards. The reserved exit reply (and its gap) is
 * cleared by the caller as part of the same interruption.
 */
function stopActiveLineImmediate(): void {
  if (!activeAudio) return;
  const audio = activeAudio;
  activeAudio = null;
  activeLineInfo = null;
  clearWatchdog();
  try { audio.pause(); } catch { /* nothing to pause */ }
  notifySpeaking(null);
}

function isRegisteredEvent(event: VoiceLineTrigger): event is VoiceLineEvent {
  return (VOICE_EVENTS as readonly string[]).includes(event);
}

/**
 * Next clip from the event's own pool — weighted so the whole pool gets even
 * exposure over a session (see `ClipSelector`). `null` when the pool is empty.
 */
function pickClip(event: VoiceLineEvent): VoiceClip | null {
  return eventSelectors.get(event)?.next() ?? null;
}

/** Same selection strategy, over the event's `ردود/<event>/` reply pool. */
function pickReply(event: VoiceLineEvent): VoiceClip | null {
  return eventReplySelectors.get(event)?.next() ?? null;
}

function isReplyable(event: VoiceLineTrigger): event is VoiceLineEvent {
  return isRegisteredEvent(event) && REPLYABLE_EVENTS[event] === true;
}

/** The single event that participates in stacked-run reply grouping. */
const EXIT_EVENT = 'إخراج_بيدق' as const;

/** The capture event — top-priority interrupt + its own stacked-run coalescing. */
const CAPTURE_EVENT = 'الأكل' as const;

/**
 * The threat event — queue-tier (like `إخراج_بيدق`), with its own stacked-run
 * coalescing so a burst of near-simultaneous threats produces a single line.
 */
const THREAT_EVENT = 'التهديد' as const;

/**
 * The escape event — queue-tier too, and the closing half of the threat
 * relationship (a previously threatened piece is out of range). It waits out a
 * playing `التهديد` line instead of competing with it, and it outranks
 * `إخراج_بيدق` in the queue — see `insertEscapeByPriority`.
 */
const ESCAPE_EVENT = 'الهروب' as const;

/**
 * The lap-completion event — a piece finished its full circuit and landed on
 * its final home slot (the call site never fires it for the colour-completing
 * arrival). Queue-tier: it never interrupts anything. It coalesces with the
 * standard remaining-wait run rule, and its one special relationship is with a
 * playing `الأكل` line — near/far wait-and-threshold, see the ضمّ branch in
 * `playVoiceLine`.
 */
const FINISH_EVENT = 'ضمّ' as const;

function isExitEvent(event: VoiceLineTrigger): event is typeof EXIT_EVENT {
  return isRegisteredEvent(event) && event === EXIT_EVENT;
}

/**
 * A "foreign" event takes priority over a pending reply. Foreignness is
 * relative to the run whose reply is being protected (`relativeTo`):
 *
 *   • a line of the run's own event is a *continuation* — it re-owns the
 *     reply, it never preempts it. For an `إخراج_بيدق` run that is the
 *     original rule (exit lines were never foreign); for an `الأكل` run it
 *     makes a queued stacked capture line a continuation instead of a
 *     preemption, which is what keeps "one reply per capture-line run" intact;
 *   • any other registered event is foreign (an exit line is foreign to a
 *     capture run, and vice versa; a new registered event such as danger or
 *     taunt is foreign to both — no per-event code needed).
 *
 * Confirmed for `الأكل` vs `إخراج_بيدق`: the capture is registered in
 * `VOICE_EVENTS` and is not the run's event, so it is foreign by construction —
 * a capture that arrives while an exit reply is reserved/pending/gap-running
 * drops that reply. The capture branch in `playVoiceLine` additionally
 * *interrupts* instead of merely preempting-then-queueing, which is its
 * top-priority privilege.
 */
function isForeignVoiceEvent(event: VoiceLineTrigger | 'reply', relativeTo?: VoiceLineEvent): boolean {
  if (event === 'reply') return false;
  if (!isRegisteredEvent(event)) return false;
  if (relativeTo !== undefined && event === relativeTo) return false;
  // No run context (defensive default): preserve the original rule where only
  // non-exit events are foreign.
  if (relativeTo === undefined && event === EXIT_EVENT) return false;
  return true;
}

/**
 * True when an event foreign to `relativeTo`'s run is already playing or queued
 * ahead of the reply path. The reply is not an ordinary queue entry, so any
 * queued foreign event would otherwise have to wait behind the reply; the
 * foreign event wins instead.
 */
function hasForeignVoiceEventInPath(relativeTo?: VoiceLineEvent): boolean {
  if (activeLineInfo && isForeignVoiceEvent(activeLineInfo.event, relativeTo)) return true;
  return queue.some(queued => {
    const event = queued.kind === 'event' ? queued.event : 'reply';
    return isForeignVoiceEvent(event, relativeTo);
  });
}

/** True when another line of the given event is waiting to play, i.e. that run continues. */
function hasQueuedRunLine(event: VoiceLineEvent): boolean {
  return queue.some(queued => queued.kind === 'event' && queued.event === event);
}

/**
 * Queue-tier ordering, first-to-speak:
 *
 *   `الأكل` (interrupts everything; even when stacked it keeps the head of the
 *   queue) → a reply line → **`الهروب`** → every other queue-tier event
 *   (`إخراج_بيدق`, `التهديد`, …).
 *
 * `الهروب` sits above `إخراج_بيدق` because the two constantly contend for the
 * same slot: both are fired from the same move resolution, and an escape is the
 * board-specific beat — it describes a moment that has *already* happened and
 * is being pointed at by a one-shot marker — while `إخراج_بيدق` is a social
 * aside that still reads fine one line later. So when the two collide, the
 * escape plays (or queues ahead of it), and if the queue is at MAX_QUEUE_SIZE
 * with `إخراج_بيدق` holding the last slot, the exit yields that slot outright
 * rather than pushing the escape out. A dropped exit line never starts, so it
 * never reserves a reply of its own; any reply already reserved by the exit
 * line that is *playing* is dropped by the generic foreign-event rule
 * (`hasForeignVoiceEventInPath`) when that line ends — never delayed.
 */
function insertEscapeByPriority(line: QueuedLine): void {
  // Skip past the entries that outrank an escape: الأكل and reply lines.
  let insertAt = 0;
  while (insertAt < queue.length) {
    const entry = queue[insertAt];
    const outranksEscape = entry.kind === 'reply'
      || (entry.kind === 'event' && entry.event === CAPTURE_EVENT);
    if (!outranksEscape) break;
    insertAt++;
  }

  // Queue full: `إخراج_بيدق` yields its slot so the escape is never the line
  // that gets dropped by the cap.
  if (queue.length >= MAX_QUEUE_SIZE) {
    const exitAt = queue.findIndex(q => q.kind === 'event' && q.event === EXIT_EVENT);
    if (exitAt !== -1) {
      queue.splice(exitAt, 1);
      if (exitAt < insertAt) insertAt--;
    }
  }

  // Still full (no exit line to yield): the ordinary cap applies, same as every
  // other queue-tier event.
  if (queue.length >= MAX_QUEUE_SIZE) return;

  queue.splice(insertAt, 0, line);
}

/**
 * Queue-tier ordering for `ضمّ` — same insertion contract as
 * `insertEscapeByPriority`, reached from the far branch of the ضمّ-vs-الأكل
 * rule: the finish line is placed ahead of every other waiting queue-tier line
 * (exits, threats, escapes) but still behind `الأكل` lines and reply lines,
 * which always outrank it.
 *
 * A finished lap is one of the match's milestone beats — the per-piece goal of
 * the whole game — so when the queue is at MAX_QUEUE_SIZE an `إخراج_بيدق` line
 * yields its slot rather than pushing the milestone out (same yield rule the
 * escape uses; a dropped line never starts, so the yielded exit never reserves
 * a reply of its own).
 */
function insertFinishByPriority(line: QueuedLine): void {
  // Skip past the entries that outrank ضمّ: الأكل and reply lines.
  let insertAt = 0;
  while (insertAt < queue.length) {
    const entry = queue[insertAt];
    const outranksFinish = entry.kind === 'reply'
      || (entry.kind === 'event' && entry.event === CAPTURE_EVENT);
    if (!outranksFinish) break;
    insertAt++;
  }

  // Queue full: `إخراج_بيدق` yields its slot so ضمّ is never the line that
  // gets dropped by the cap.
  if (queue.length >= MAX_QUEUE_SIZE) {
    const exitAt = queue.findIndex(q => q.kind === 'event' && q.event === EXIT_EVENT);
    if (exitAt !== -1) {
      queue.splice(exitAt, 1);
      if (exitAt < insertAt) insertAt--;
    }
  }

  // Still full (no exit line to yield): the ordinary cap applies, same as every
  // other queue-tier event.
  if (queue.length >= MAX_QUEUE_SIZE) return;

  queue.splice(insertAt, 0, line);
}

/**
 * Drop the pending reply entirely because a foreign event has taken priority.
 * The reply is never delayed or requeued: if nothing is playing after the drop,
 * the queued foreign line (or the ordinary queue) is drained immediately so the
 * higher-priority event can speak. The run that owned the reply stays alive in
 * preempted form so its continuation lines cannot resurrect the dropped reply.
 */
function cancelPendingReplyForFutures(): void {
  const run = pendingReply ? getReplyRun(pendingReply.event) : null;
  clearPendingReply();
  clearReplyGap();
  if (run) {
    run.preempted = true;
  }
  playNextQueued();
  syncDucking();
}

function addRunActor(run: ReplyRunState, speaker?: number): void {
  if (speaker === undefined) return;
  run.actors.add(speaker);
}

/**
 * Pick a responder among players not involved in the run. Returns null when not
 * enough players are left (e.g. every player has now acted in a stacked run),
 * which drops this run's reply.
 */
function reselectReplySpeaker(reply: PendingReply): PendingReply | null {
  const candidates = reply.playersInGame;
  if (candidates.length === 0) return null;
  const eligible = candidates.filter(player => !reply.actors.has(player));
  if (eligible.length === 0) return null;
  const speaker = eligible[Math.floor(Math.random() * eligible.length)];
  return speaker === reply.speaker ? reply : { ...reply, speaker };
}

/**
 * Reserve + preload the reply for a new replyable primary run that is starting.
 *
 * The probabilistic and quiet-moment gates are intentionally gone: a qualifying
 * run always gets a reply. The only scheduling-time rules left are structural
 * (eligible responder + non-empty reply pool) and the future-event priority
 * check.
 *
 * Nothing is scheduled on a clock here: the reservation is handed to the
 * owner's end callback (`finishLine`). Preloading at this point means the clip
 * is already buffered when the run ends, so the reply starts on the spot
 * instead of waiting on a media fetch in the middle of a dice roll or pawn
 * animation.
 */
function prepareReply(event: VoiceLineEvent, options: VoiceLineContext, owner: HTMLAudioElement): void {
  clearPendingReply();
  clearReplyRun(event);

  const acting = options.speaker;

  // Decide who answers:
  //   • `الأكل`: deterministic — the captured (victim) player answers back at
  //     the captor. No random pick, and no fallback to a random player or to
  //     the captor: no known victim = no reply.
  //   • `إخراج_بيدق`: a uniform pick among the in-game players, excluding the
  //     run's actor.
  let speaker: number | undefined;
  if (event === CAPTURE_EVENT) {
    speaker = options.replySpeaker;
  } else {
    const playersInGame = options.playersInGame ?? [];
    const candidates = playersInGame.filter(player => (acting === undefined ? true : player !== acting));
    if (candidates.length === 0) return; // nobody left to answer = safe no-op
    speaker = candidates[Math.floor(Math.random() * candidates.length)];
  }
  if (speaker === undefined) return;

  const clip = pickReply(event); // empty folder = safe no-op
  if (!clip) return;

  // Future events take priority: if one is already active/queued here, this
  // reply never enters the pending state.
  if (hasForeignVoiceEventInPath(event)) {
    cancelPendingReplyForFutures();
    return;
  }

  const actors = new Set<number>();
  if (acting !== undefined) actors.add(acting);

  const audio = new Audio(clip.url);
  audio.preload = 'auto';
  try { audio.load(); } catch { /* preload is best-effort */ }

  pendingReply = { event, speaker, piece: options.replyPiece, clip, audio, owner, actors, playersInGame: options.playersInGame ?? [] };
  replyRunByEvent[event] = { event, owner, actors, preempted: false };
}

/**
 * Handle a replyable primary that is actually starting to play. Lines get the
 * grouped-run treatment for their own event; other replyable events simply
 * start a new reply.
 */
function onReplyPrimaryStart(event: VoiceLineEvent, options: VoiceLineContext, owner: HTMLAudioElement): void {
  const run = getReplyRun(event);

  // ── `الأكل` — the victim of this line answers back at its captor ──────────
  if (event === CAPTURE_EVENT) {
    if (run && run.owner !== owner) {
      // Stacked continuation: the previous capture line has ended and this
      // line is the next one that survived the coalescing rule. Re-own the
      // reply to this line so it fires from *this* line's end — one reply per
      // surviving capture-line run, 1:1 with CAPTURE_COALESCE_MAX_WAIT_MS.
      addRunActor(run, options.speaker);
      run.owner = owner;

      if (run.preempted) {
        // A foreign event already won and dropped this run's reply.
        // Continuation lines must not resurrect it.
        return;
      }

      if (pendingReply) {
        const victim = options.replySpeaker;
        if (victim === undefined) {
          // The reply must never fall back to a random player or to the
          // captor: no known victim for this line = the run's reply is dropped.
          cancelPendingReplyForFutures();
          return;
        }
        pendingReply.owner = owner;
        pendingReply.actors = run.actors;
        // Deterministic: the most recent victim answers back at the captor.
        pendingReply.speaker = victim;
        // Same for the victim's pawn — the reply echo follows the latest
        // captured piece, 1:1 with the reply speaker above.
        pendingReply.piece = options.replyPiece;
      }

      // If a foreign event was queued while this run was progressing, it wins
      // and the (still-pending) reply is dropped.
      if (hasForeignVoiceEventInPath(event)) {
        cancelPendingReplyForFutures();
      }
      return;
    }

    // No capture run is live (a stacked run is handled above, and a capture
    // line can only be a continuation of the run whose previous line just
    // ended) — this line starts a fresh run.
    prepareReply(event, options, owner);
    return;
  }

  // ── `إخراج_بيدق` — the grouped-run treatment ────────────────────────────
  if (run && run.owner !== owner) {
    // Stacked continuation: the previous exit line has ended and this line is
    // the next one that survived the queue-cancellation rules. Re-own the reply
    // to this line so it fires from *this* line's end, and broaden the actor
    // set so the responder excludes everyone involved in the run.
    addRunActor(run, options.speaker);
    run.owner = owner;

    if (run.preempted) {
      // A future event already won and dropped this run's reply. Continuation
      // lines must not resurrect it.
      return;
    }

    if (pendingReply) {
      pendingReply.owner = owner;
      pendingReply.actors = run.actors;
      // The responder must still exclude every actor involved in the run. If the
      // added actor leaves nobody to answer, the run's reply is dropped.
      const reselected = reselectReplySpeaker(pendingReply);
      if (!reselected) {
        cancelPendingReplyForFutures();
        return;
      }
      pendingReply = reselected;
    }

    // If a foreign event was queued while this run was progressing, it wins and
    // the (still-pending) reply is dropped.
    if (hasForeignVoiceEventInPath(event)) {
      cancelPendingReplyForFutures();
    }
    return;
  }

  // New run (for `إخراج_بيدق`: the very first line of a run, which is always
  // an owner change from null; for any other replyable event: a fresh line
  // simply starts its own reply).
  prepareReply(event, options, owner);
}

/** Fire the reserved reply after a short conversational beat. */
function startReplyGap(): void {
  clearReplyGap();
  const gap = REPLY_GAP_MIN_MS + Math.random() * (REPLY_GAP_MAX_MS - REPLY_GAP_MIN_MS);
  replyGapTimer = setTimeout(() => {
    replyGapTimer = null;
    const reply = pendingReply;
    if (!reply) {
      playNextQueued();
      syncDucking();
      return;
    }
    // A foreign event queued during the gap wins: drop the reply entirely.
    if (hasForeignVoiceEventInPath(reply.event)) {
      clearPendingReply();
      clearReplyRun(reply.event);
      playNextQueued();
      syncDucking();
      return;
    }
    pendingReply = null;
    clearReplyRun(reply.event);
    if (!voiceLinesEnabled || voiceLineVolume <= 0) {
      playNextQueued();
      syncDucking();
      return;
    }
    playClip(
      { kind: 'reply', replyEvent: reply.event, options: { speaker: reply.speaker, replyPiece: reply.piece } },
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
  // The broadcast now also carries which registered event is audible and which
  // board piece carries it, so UIs can target a specific pawn (the capture
  // speaking echo) for exactly the line's audible lifetime. A reply line is
  // announced with the event it answers; an unmigrated primary has no event.
  const speakingEvent = line.kind === 'event'
    ? (isRegisteredEvent(line.event) ? line.event : null)
    : line.replyEvent;
  const speakingPiece = line.kind === 'event' ? line.options.piece : line.options.replyPiece;
  notifySpeaking(line.options.speaker === undefined
    ? null
    : {
        player: line.options.speaker,
        kind: line.kind === 'reply' ? 'reply' : 'primary',
        event: speakingEvent,
        piece: speakingPiece,
      });

  const finish = () => {
    if (activeAudio !== audio) return;
    clearWatchdog();
    activeAudio = null;
    activeLineInfo = null;
    notifySpeaking(null);
    finishLine(audio);
  };
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', finish, { once: true });
  armWatchdog(audio, finish);
  audio.play()?.catch(finish);

  // Only a registered event's primary line can reserve a reply — never a reply.
  if (line.kind === 'event' && isReplyable(line.event)) {
    onReplyPrimaryStart(line.event, line.options, audio);
  }
}

/**
 * Single drain point, run when a clip ends for any reason. A reply reserved by
 * the clip that just ended always wins the next slot; otherwise the ordinary
 * queue drains and the duck is released if nothing else is speaking.
 */
function finishLine(owner: HTMLAudioElement): void {
  if (pendingReply && pendingReply.owner === owner) {
    const runEvent = pendingReply.event;
    // A foreign event queued while this line finished wins over the reply.
    if (hasForeignVoiceEventInPath(runEvent)) {
      cancelPendingReplyForFutures();
      return;
    }

    // If another line of the same run survived the coalescing /
    // queue-cancellation rules and is queued, the run continues: keep the
    // reply pending and let the next line play. `onReplyPrimaryStart` will
    // re-own the reply to that line (one reply per surviving line in the run).
    if (hasQueuedRunLine(runEvent)) {
      const started = playNextQueued();
      syncDucking();
      // If the queued continuation had no playable clip, it never played, so
      // the run actually ended here and the reservation still owns this line.
      if (!started && pendingReply?.owner === owner) {
        clearReplyRun(runEvent);
        startReplyGap();
      }
      return;
    }

    // This was the last surviving line in the run — the reply is now tied to
    // the end of the run, not to this specific line's identity.
    clearReplyRun(runEvent);
    startReplyGap();
    return;
  }
  clearPendingReply(); // a reservation from an older line can never apply here
  // If a preempted run still has a continuation line queued, keep that run's
  // state alive so the continuation line cannot resurrect the dropped reply.
  for (const event of VOICE_EVENTS) {
    if (getReplyRun(event) && hasQueuedRunLine(event)) {
      const started = playNextQueued();
      syncDucking();
      if (!started) {
        clearReplyRun(event);
        playNextQueued();
        syncDucking();
      }
      return;
    }
  }
  clearAllReplyRuns();
  playNextQueued();
  syncDucking();
}

function playNextQueued(): boolean {
  // Loops rather than returning on the first unplayable entry: a queued line
  // whose pool is empty must not stall everything behind it.
  while (!isVoiceBusy() && queue.length > 0) {
    const next = queue.shift();
    if (!next) return false;

    if (next.kind === 'event') {
      if (!isRegisteredEvent(next.event)) continue;
      const clip = pickClip(next.event);
      if (!clip) continue;
      playClip(next, clip);
      return true;
    }

    const clip = pickReply(next.replyEvent);
    if (!clip) continue;
    playClip(next, clip);
    return true;
  }
  return false;
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
        if (q.kind === 'event' && q.event === EXIT_EVENT && q.options.speaker !== undefined) {
          return q.options.speaker === activeSpeaker || q.options.speaker === currentSpeaker;
        }
        return true;
      });
    }
  }

  // ── `الأكل` — top-priority capture event ──────────────────────────────────
  // A capture line never waits behind a foreign line and never delays: it
  // interrupts whatever is currently speaking (primary, reply, or the reply
  // gap) and starts on the spot. Only a *stacked* capture (an `الأكل` line
  // from a previous capture is still audible) defers — coalesced using the
  // CAPTURE_COALESCE_MAX_WAIT_MS run rule below, independent of the
  // `إخراج_بيدق` queue rules.
  if (event === CAPTURE_EVENT) {
    const captureLineActive = activeLineInfo !== null
      && activeLineInfo.event === CAPTURE_EVENT
      && getActiveLineRemainingMs() > 0;

    if (captureLineActive) {
      // Stacked captures — one combined event or one follow-up, decided by how
      // much of the running capture line is left (same shape as the cross-turn
      // `إخراج_بيدق` rule, its own threshold).
      const remainingWaitMs = getActiveLineRemainingMs();

      // At most one `الأكل` line may ever wait in the queue.
      queue = queue.filter(q => !(q.kind === 'event' && q.event === CAPTURE_EVENT));

      if (remainingWaitMs <= CAPTURE_COALESCE_MAX_WAIT_MS) {
        // Short remaining wait → separate events: let the first line finish,
        // then play a fresh capture line (the selector's hard no-repeat rule
        // ensures it is a *different* clip than the one that just played). Insert at
        // the head so it follows the running capture line directly, ahead of
        // any older queue entries — a capture line never waits behind things.
        queue.unshift({ kind: 'event', event, options: context ?? {} });
      }
      // Long remaining wait → combined event: the running line already speaks
      // for this capture too, so the new line is dropped and no follow-up is
      // queued (the filter above also clears any stale queued capture line).

      // The capture run's OWN pending reply survives the coalescing — one
      // reply per surviving capture-line run, decided when the run ends.
      // Only a *different* run's pending reply (an `إخراج_بيدق` reply; it
      // cannot actually coexist with a live capture line — the interrupt
      // below clears it — kept for safety) is dropped by the generic
      // foreign rule, never delayed.
      if (pendingReply && pendingReply.event !== CAPTURE_EVENT) {
        cancelPendingReplyForFutures();
      }
      return;
    }

    // Empty pool = safe no-op — never interrupt just to leave silence.
    const clip = pickClip(event);
    if (!clip) return;

    // Interrupt everything: cut the active line (of any type — primary line,
    // reply line, or the reply gap of a capture or exit run), drop the
    // reserved reply + gap, and mark every live run preempted so its queued
    // tail lines stay reply-silent (same semantics as the generic foreign
    // rule). The new capture line then starts on the spot and its own run —
    // with its own guaranteed reply — is created by `playClip` below.
    stopActiveLineImmediate();
    clearPendingReply();
    clearReplyGap();
    for (const runEvent of VOICE_EVENTS) {
      const run = getReplyRun(runEvent);
      if (run) run.preempted = true;
    }

    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // ── `التهديد` — queue-tier threat event ──────────────────────────────────
  // A threat line behaves like `إخراج_بيدق`: it never interrupts anything.
  // When voice is idle it starts on the spot; when anything else is audible
  // it queues behind it — but only when the active line is expected to
  // finish within the wait window (same threshold and the same "will the
  // active line finish within one conversational beat?" decision as the exit
  // queue rule, so the two queue-tier events share one knob). A longer wait
  // cancels the line outright: a threat warning is tied to a board state
  // that resolves within the next roll or two, so a stale backlog entry is
  // dropped instead of played late.
  //
  // Near-simultaneous threats coalesce with the same remaining-wait run rule
  // (the capture run shape, reusing EXIT_QUEUE_MAX_WAIT_MS instead of the
  // capture's wider 1150 ms window — a threat is a warning about a state,
  // not the event the player most wants heard, so it coalesces slightly more
  // eagerly):
  //   • a threat firing while a `التهديد` line is still audible with
  //     <= EXIT_QUEUE_MAX_WAIT_MS left queues one fresh follow-up line
  //     (at most one threat line ever waits — a newer threat replaces a
  //     stale queued one, and the pick's hard no-repeat rule keeps it a
  //     different clip);
  //   • a threat firing earlier in a running threat line is combined into
  //     the line already playing — no second line, so simultaneous or
  //     near-simultaneous threat bursts always produce one audible line.
  //
  // No speaker-based cancellation here (unlike the exit rules): the call
  // site already gates re-fires to *new* threat pairs (threatSignature
  // diff), so the remaining-wait coalescing above is the only suppression
  // this event needs.
  if (event === THREAT_EVENT) {
    if (isVoiceBusy()) {
      const remainingWaitMs = getActiveLineRemainingMs();
      // At most one threat line may ever wait in the queue.
      queue = queue.filter(q => !(q.kind === 'event' && q.event === THREAT_EVENT));
      if (remainingWaitMs <= EXIT_QUEUE_MAX_WAIT_MS) {
        queue.push({ kind: 'event', event, options: context ?? {} });
      }
      // Longer remaining wait → the burst is combined into the line already
      // playing (and any stale queued threat line is dropped by the filter).
      return;
    }

    // Voice is idle: play immediately.
    const clip = pickClip(event);
    if (!clip) return;
    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // ── `الهروب` — queue-tier escape event (the mirror of `التهديد`) ──────────
  // An escape is the resolution of a threat the board was already tracking: a
  // piece that was inside an attacker's 1-2 square range is out of it now. It
  // never interrupts anything, and it is shaped by three rules:
  //
  // 1. It waits out a playing `التهديد` line. The escape is the *answer* to the
  //    warning that line is announcing, so cutting it short would be nonsense:
  //    whatever the threat line has left, the escape queues and plays the
  //    instant the threat line ends on its own. Never overlapping, never
  //    interrupting — the two lines read as one exchange.
  //
  // 2. It coalesces like every other run event, reusing EXIT_QUEUE_MAX_WAIT_MS
  //    (same "one conversational beat" question as the threat branch, see that
  //    constant): how much of the line that is currently playing is left
  //    decides whether this escape shares that line or gets its own.
  //       • short remaining wait → separate beats: a fresh (different-clip)
  //         escape line is queued and plays once the current line has fully
  //         finished;
  //       • long remaining wait → one combined beat: whatever is playing
  //         already speaks for this escape too (and, when a foreign line is
  //         playing, the escape is stale and dropped instead).
  //
  // 3. It outranks `إخراج_بيدق` when the two contend for the queue — see
  //    `insertEscapeByPriority`.
  //
  // No speaker-based cancellation here (same as the threat branch): the call
  // site already gates re-fires to threat pairs that genuinely resolved, so the
  // remaining-wait coalescing above is the only suppression this event needs.
  if (event === ESCAPE_EVENT) {
    // Empty pool = safe no-op: never queue, and never disturb a line that is
    // already waiting, just to leave silence. (The folder ships empty until the
    // clips are recorded.)
    if ((eventPools.get(event) ?? []).length === 0) return;

    if (isVoiceBusy()) {
      // At most one `الهروب` line may ever wait in the queue — a newer escape
      // re-owns the pending slot (its speaker/piece follow the newest piece
      // that actually got away).
      queue = queue.filter(q => !(q.kind === 'event' && q.event === ESCAPE_EVENT));

      const waitingOnThreatLine = activeLineInfo?.event === THREAT_EVENT;
      const remainingWaitMs = getActiveLineRemainingMs();

      // Rule 1 (a playing threat line is waited out in full) OR rule 2 (the
      // current line finishes within one conversational beat).
      if (waitingOnThreatLine || remainingWaitMs <= EXIT_QUEUE_MAX_WAIT_MS) {
        insertEscapeByPriority({ kind: 'event', event, options: context ?? {} });
      }
      // Otherwise: one combined beat (an `الهروب` line already playing speaks
      // for this escape too) or a stale line (anything else still has a long
      // way to run) — both are covered by the filter above clearing the queue.
      return;
    }

    // Voice is idle: play immediately.
    const clip = pickClip(event);
    if (!clip) return;
    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // ── `ضمّ` — queue-tier lap-completion event ────────────────────────────────
  // A piece completed its full circuit and landed on its final home slot (the
  // call site suppresses the colour-completing arrival — that moment belongs
  // to the victory event, not this one). It never interrupts anything, and it
  // is shaped by three rules:
  //
  // 1. Run-based coalescing, the same shape as `التهديد`/`الهروب`: a `ضمّ`
  //    firing while a `ضمّ` line is still audible with
  //    <= EXIT_QUEUE_MAX_WAIT_MS left is a separate event — one fresh
  //    (different-clip) follow-up line is queued; a `ضمّ` firing earlier in
  //    the running line is combined into it — the two finishes are one beat
  //    and the running line already speaks for both. At most one `ضمّ` line
  //    ever waits: a newer finish re-owns the pending slot.
  //
  // 2. Near/far priority vs a playing `الأكل` line (the realistic collision:
  //    a capture earns the captor an extra turn, and that very turn can carry
  //    one of its pieces home). `الأكل` is never interrupted — this is queue
  //    ordering, not preemption — but a long capture exchange never delays the
  //    milestone either. How much of the running `الأكل` line is left decides:
  //      • <= EXIT_QUEUE_MAX_WAIT_MS → queue normally: the capture line is
  //        about to end, so the ordinary queue already delivers `ضمّ` right
  //        after it (a reserved capture reply yields by the standing
  //        future-event priority rule — a foreign event queued ahead drops a
  //        pending reply, it is never delayed);
  //      • >  EXIT_QUEUE_MAX_WAIT_MS → `ضمّ` takes priority instead: the
  //        pending capture reply is dropped on the spot and `ضمّ` is inserted
  //        ahead of every other waiting line, so it plays the instant the
  //        `الأكل` line ends naturally — it never sits through the rest of a
  //        long capture exchange (primary + gap + reply) nor behind queued
  //        exits/threats.
  //
  // 3. Any other audible line (an exit/threat/escape line, or a reply of any
  //    event): the default queue-tier behavior — queue if there is room. A
  //    milestone is never dropped just because an unrelated line is long, but
  //    the MAX_QUEUE_SIZE cap still applies.
  if (event === FINISH_EVENT) {
    // Empty pool = safe no-op: never queue, never cancel a capture reply, and
    // never disturb a line that is already waiting, just to leave silence.
    // (The folder ships empty until the clips are recorded.)
    if ((eventPools.get(event) ?? []).length === 0) return;

    if (isVoiceBusy()) {
      // At most one `ضمّ` line may ever wait in the queue — a newer finish
      // re-owns the pending slot (the same convention as the threat / escape /
      // exit branches: a burst of finishes colliding behind one busy line is
      // one beat, the newest piece's; a genuinely separate second finish
      // arrives once the first `ضمّ` line is audible and is decided by the
      // run rule below).
      queue = queue.filter(q => !(q.kind === 'event' && q.event === FINISH_EVENT));

      // Rule 1 — coalescing vs an audible ضمّ line.
      if (activeLineInfo?.event === FINISH_EVENT) {
        if (getActiveLineRemainingMs() <= EXIT_QUEUE_MAX_WAIT_MS) {
          queue.push({ kind: 'event', event, options: context ?? {} });
        }
        // Longer remaining wait → one combined beat: the running `ضمّ` line
        // already speaks for this finish too (the filter above also clears any
        // stale queued ضمّ line).
        return;
      }

      // Rule 2 — near/far priority vs a playing الأكل line.
      if (activeLineInfo?.event === CAPTURE_EVENT) {
        if (getActiveLineRemainingMs() <= EXIT_QUEUE_MAX_WAIT_MS) {
          // Near: the capture line is nearly over — ordinary queueing already
          // delivers ضمّ right after it.
          queue.push({ kind: 'event', event, options: context ?? {} });
        } else {
          // Far: ضمّ takes priority over the reserved capture reply (dropped,
          // never delayed — the standing future-event rule) and over every
          // queued line, while the `الأكل` line itself keeps playing to its
          // natural end.
          if (pendingReply && pendingReply.event === CAPTURE_EVENT) {
            cancelPendingReplyForFutures();
          }
          insertFinishByPriority({ kind: 'event', event, options: context ?? {} });
        }
        return;
      }

      // Rule 3 — any other audible line (or the primary→reply gap): the
      // default queue-tier behavior, identical to the generic branch below.
      if (queue.length < MAX_QUEUE_SIZE) {
        queue.push({ kind: 'event', event, options: context ?? {} });
        cancelPendingReplyForFutures();
      }
      return;
    }

    // Voice is idle: play immediately.
    const clip = pickClip(event);
    if (!clip) return;
    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // Refined queueing rules specific to `إخراج_بيدق` primary lines
  if (event === EXIT_EVENT) {
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

      // The comparison is against whatever line is currently playing — an
      // exit line, a foreign line, or a capture reply (ردود/الأكل) line. That
      // is the intended interaction with the capture reply: an exit landing
      // with a short stretch of reply left (<= EXIT_QUEUE_MAX_WAIT_MS) queues
      // and plays right after the reply; an exit landing with a longer
      // stretch of reply left is cancelled entirely (and, since a cancelled
      // line never starts, never reserves one, its own reply can never fire).
      const remainingWaitMs = getActiveLineRemainingMs();

      // If A's line is expected to finish soon after B's exit (short gap <= EXIT_QUEUE_MAX_WAIT_MS):
      if (remainingWaitMs <= EXIT_QUEUE_MAX_WAIT_MS) {
        // At most one `إخراج_بيدق` line should ever be queued waiting behind the currently-playing one.
        // Evaluate fresh: replace any existing queued `إخراج_بيدق` line.
        queue = queue.filter(q => !(q.kind === 'event' && q.event === EXIT_EVENT));
        queue.push({ kind: 'event', event, options: context ?? {} });
      } else {
        // A's line will take longer to finish (long wait > EXIT_QUEUE_MAX_WAIT_MS):
        // Cancel B's line entirely (do not queue it) and clear any stale queued exit line.
        queue = queue.filter(q => !(q.kind === 'event' && q.event === EXIT_EVENT));
      }
      return;
    }

    // Audio system is not busy: play immediately
    if (speaker !== undefined) {
      lastExitSpeaker = speaker;
    }
    const clip = pickClip(event);
    if (!clip) return;
    playClip({ kind: 'event', event, options: context ?? {} }, clip);
    return;
  }

  // Default queueing logic for non-إخراج_بيدق voice events.
  //
  // Future-event priority: any event outside the إخراج_بيدق/reply system wins
  // over a pending exit reply, but only when that event actually gets to play
  // or occupies a queued slot. A foreign line that is dropped by MAX_QUEUE_SIZE
  // is not playing or queued ahead, so it does not preempt an existing reply.
  if (isVoiceBusy()) {
    if (queue.length < MAX_QUEUE_SIZE) {
      queue.push({ kind: 'event', event, options: context ?? {} });
      cancelPendingReplyForFutures();
    }
    return;
  }

  // Not busy: cancel any stale pending reply, then play immediately.
  cancelPendingReplyForFutures();

  // The cancel above may have drained a queued exit and started a fresh run; if
  // so, queue this foreign event behind it (that run's reply is dropped).
  if (isVoiceBusy()) {
    if (queue.length < MAX_QUEUE_SIZE) {
      queue.push({ kind: 'event', event, options: context ?? {} });
      cancelPendingReplyForFutures();
    }
    return;
  }

  const clip = pickClip(event);
  if (!clip) return;
  playClip({ kind: 'event', event, options: context ?? {} }, clip);
}

export function stopVoiceLines(): void {
  queue = [];
  clearWatchdog();
  clearReplyGap();
  clearPendingReply();
  clearAllReplyRuns();
  activeLineInfo = null;
  lastExitSpeaker = null;
  if (activeAudio) {
    const audio = activeAudio;
    // Null first: the `pause` below must not be mistaken for a natural end by
    // the element's own handlers.
    activeAudio = null;
    audio.pause();
  }
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
