// ─── CornerMascot — illustrated mascots for the four dice-roll panels ──────
// One illustrated character per player colour, matching the polished raster
// characters on the home/splash screen:
//   • Red    → mascot-red.png     (red pawn, fez + chest medal, one raised arm)
//   • Blue   → mascot-blue.png    (blue pawn in a hooded djellaba, white band)
//   • Yellow → mascot-yellow.png  (yellow pawn, laurel + victory trophy aloft)
//   • Green  → pawn-character.png (the ORIGINAL home-screen turban character,
//                                   reused verbatim for the matching colour)
//
// The artwork is the same cel-shaded, rendered style as the home screen — full
// pawn silhouette, headwear, expressive faces, layered shading — rendered as
// transparent rasters, never primitive shapes.
//
// Motion model ("hide → climb to peek → retreat")
// -----------------------------------------------
// The character lives hidden behind/under its dice card. At idle only a tiny
// hint remains — the top of the head (or the trophy tip for Yellow) barely
// peeking over the card's edge — so every corner still whispers "someone is
// waiting here" without exposing the character. When its colour takes the
// turn, the character climbs UP from behind the card into full view and looks
// toward the board; when the turn passes it retreats back DOWN out of sight,
// leaving the head-top hint behind. Everything animates on transform/opacity/
// filter only, and prefers-reduced-motion swaps the climb for a simple fade.
//
// Orientation (unchanged from the original corner-mascot behaviour)
// -----------------------------------------------------------------
//   • Top panels (gaze "down") → the clip window sits ABOVE the card. Active,
//     the character stands on the card's top edge, looking down over the card
//     at the board beyond it. Hidden, it has sunk down behind the card.
//   • Bottom panels (gaze "up") → the clip window sits BELOW the card. Active,
//     the character has risen until its head reaches the card's bottom edge,
//     looking up over the card at the board. Hidden, it has sunk below.
// In both cases the character hides DOWNWARD behind the card and climbs
// UPWARD to peek, so the peekaboo read is identical at all four corners.
//
// Gestures
// --------
// While visible, the character performs small hand-gesture-flavoured body
// language driven by the wired mood states: a friendly sway "wave" right
// after climbing up, an eager bounce and lean toward the board while waiting
// to roll, a shiver of excitement while the die tumbles, an arms-up victory
// hop + stretch on a six or a capture (with sparkles), and a deflated droop
// when its own piece is captured. Amplitudes stay small on purpose: the
// mascot renders around 30×50 px, so gestures must read as charm, not noise.

import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import * as E from "../lib/ludo-engine";
import * as DZ from "../lib/board-theme-dz";

/** A one-shot mood event raised by CornerDice (six roll / capture / captured),
 *  targeted at a single corner via `player`. */
export type MascotEvent = { player: number; kind: "six" | "capture" | "captured"; id: number } | null;

type Mood = "alert" | "excited" | "joy" | "sad";

// Player 3 (Green) reuses the original home-screen turban character; the other
// three are companion illustrations in the same family (see public/). Each has
// a webp companion for browsers that support it.
const MASCOT_ASSETS: Record<number, { png: string; webp: string }> = {
  0: { png: "mascot-red.png",     webp: "mascot-red.webp" },
  1: { png: "mascot-blue.png",    webp: "mascot-blue.webp" },
  2: { png: "mascot-yellow.png",  webp: "mascot-yellow.webp" },
  3: { png: "pawn-character.png", webp: "pawn-character.webp" },
};

// The illustrated characters are taller than wide (≈ 0.558 width/height across
// all four). `objectFit: contain` keeps every asset on its own aspect ratio, so
// the slight per-character differences letterbox invisibly (transparent art).
const MASCOT_ASPECT = 0.558;

// How much of the character's head stays visible at idle — the "barely
// peeking" hint hugging the card's edge while the character hides behind it.
const IDLE_HINT = 0.14;

// Clip headroom on the window's far side (away from the card) so hops, the
// climb spring's tiny overshoot and the joy stretch never flatten the head
// against an invisible clip edge.
const HEADROOM = 8;

interface CornerMascotProps {
  player: number;
  /** Which corner the card sits at — used to aim gestures toward the board. */
  anchor: "tl" | "tr" | "bl" | "br";
  isClassic: boolean;
  isDz: boolean;
  isNeon: boolean;
  /** Panel width in px (already viewport-scaled) — the mascot is centred on it. */
  width: number;
  /** Panel height in px — the mascot's own height is derived from this. */
  panelH: number;
  /** This colour currently holds the turn. */
  active: boolean;
  /** This colour's die is tumbling right now. */
  rolling: boolean;
  /** Waiting for the human to tap the die (about-to-roll anticipation). */
  anticipating: boolean;
  /** Which way the board sits: "down" for top panels, "up" for bottom panels. */
  gaze: "down" | "up";
  /** One-shot celebration / disappointment event. */
  event: MascotEvent;
  /** Neon exit-modal stillness (freeze loops behind the modal). */
  paused?: boolean;
}

export const CornerMascot = memo(function CornerMascot({
  player, anchor, isClassic, isDz, isNeon,
  width, panelH, active, rolling, anticipating, gaze, event, paused,
}: CornerMascotProps) {
  // `still` covers both reduced-motion and the Neon exit-modal pause: looping
  // motion stops, but the mascot (and its mood) stays fully present.
  const still = !!useReducedMotion() || !!paused;

  // Timed celebration / disappointment override, cleared after it plays out.
  // The clear-timer lives in a ref and is NEVER cancelled by the effect's
  // cleanup: when another corner's event supersedes this one, this corner's
  // `event` prop goes non-null → null, and a cleanup-based timer would be
  // cleared while the new effect run early-returns on `!event` — stranding
  // the mood forever (a "sad" mascot would peek and never retreat). Instead
  // the timeout always fires (or is replaced by this corner's OWN next
  // event); only unmount clears it early.
  const [overrideMood, setOverrideMood] = useState<Mood | null>(null);
  const moodTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!event) return;
    setOverrideMood(event.kind === "captured" ? "sad" : "joy");
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(
      () => setOverrideMood(null),
      event.kind === "captured" ? 1600 : 1500,
    );
  }, [event]);
  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  const mood: Mood = overrideMood ?? (rolling || anticipating ? "excited" : "alert");
  // A captured piece keeps the mascot peeking long enough to show the droop
  // before it retreats (the turn has already passed to another colour).
  const visible = active || overrideMood === "sad";

  // ── Greeting — a one-shot "wave hello" right after climbing into view ────
  // Fires only on the false→true edge of `active` (never for the sad-override
  // peek), and only when motion is allowed. The short delay lets the climb
  // land before the wave starts.
  const [greeting, setGreeting] = useState(false);
  const prevActive = useRef(false);
  useEffect(() => {
    const rose = active && !prevActive.current;
    prevActive.current = active;
    if (!rose || still) return;
    let t1: number | undefined;
    let t2: number | undefined;
    t1 = window.setTimeout(() => setGreeting(true), 300);
    t2 = window.setTimeout(() => setGreeting(false), 1300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [active, still]);

  // ── Geometry ──────────────────────────────────────────────────────────────
  // The character lives in a clip window glued to the card's board-facing
  // edge: above the card for top panels, below it for bottom panels. The
  // window is one character tall plus headroom; the character is anchored to
  // the card-adjacent edge so that at rest (y = 0) it stands fully in view,
  // and translating DOWN by its full height drops it out of sight behind the
  // card (top panels) or below the card (bottom panels).
  const mascotH = Math.round(panelH * 0.62); // full character height
  const mascotW = Math.round(mascotH * MASCOT_ASPECT);
  const winH    = mascotH + HEADROOM;        // clip window height
  const hintH   = Math.max(5, Math.round(mascotH * IDLE_HINT));
  const sidePos = gaze === "up" ? { top: panelH } : { bottom: panelH };
  // Both orientations hide downward and climb upward, so the hidden offset is
  // one uniform travel past the far edge of the window.
  const yHidden = winH + 2;

  // Gesture aim: lean/bob toward the board's centre — left-hand panels lean
  // right, right-hand panels lean left (a small in-plane cue that reads as
  // pointing/looking at the board from that corner).
  const leanSign = anchor === "tl" || anchor === "bl" ? 1 : -1;

  // ── Per-theme glow (the art keeps its player colour; the light adapts) ────
  const neon   = E.PLAYER_NEONS[player];
  const col    = E.PLAYER_COLORS[player];
  const glow   = isClassic ? col : isDz ? DZ.BORDER_GOLD : neon;

  const glowFilter = (t: number) =>
    isClassic
      ? `drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 0 ${Math.round(4 + t * 12)}px ${glow}${Math.round(t * 70).toString(16).padStart(2, "0")})`
      : isDz
      ? `drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 0 ${Math.round(3 + t * 12)}px ${glow}${Math.round(t * 90).toString(16).padStart(2, "0")})`
      : `drop-shadow(0 0 ${Math.round(3 + t * 12)}px ${glow}${Math.round(t * 130).toString(16).padStart(2, "0")}) drop-shadow(0 4px 10px rgba(0,0,0,0.5))`;

  const glowStrength = mood === "joy" ? 1 : mood === "sad" ? 0.3 : mood === "excited" ? 0.7 : 0.45;

  // ── Climb / retreat (transform + opacity only) ───────────────────────────
  // Hidden = translated fully past the card edge (clipped by the window);
  // visible = standing in the window. The retreat runs through a tiny upward
  // "duck" first (anticipation) before dropping out of sight, which reads as
  // the character crouching behind the card instead of being yanked down.
  // Reduced-motion swaps the climb for a plain fade.
  const climbTarget = still
    ? { opacity: visible ? 1 : 0 }
    : visible
      ? { y: 0, opacity: 1 }
      : { y: [0, -2.5, yHidden], opacity: 1 };
  const climbTransition = still
    ? { duration: 0.16 }
    : visible
      ? { type: "spring" as const, stiffness: 340, damping: 28, mass: 0.9 }
      : { duration: 0.46, times: [0, 0.2, 1], ease: ["easeOut" as const, "easeIn" as const] };

  // ── Gestures — mood-driven body language while visible ───────────────────
  // Three stacked transform layers (all pivoting on the character's base so
  // the mascot stays planted at the card's edge):
  //   1. landing — a one-shot squash-and-settle each time the character
  //      climbs into view, absorbing the arrival like a real footfall;
  //   2. base life — a permanent breath/sway loop while visible. It never
  //      restarts on mood changes, so expression switches blend over a
  //      continuously alive idle instead of cutting from loop to loop. Its
  //      per-property periods are mutually desynchronised (quasi-aperiodic),
  //      which reads as breathing rather than ticking;
  //   3. gesture — the mood expression. Every gesture's keyframes start AND
  //      end at the same neutral pose, so switching moods tweens through the
  //      shared resting shape: transitions cross-fade instead of popping.
  // Keyed loops stop the moment the character hides, so nothing animates
  // off-screen. Bottom panels (gaze "up") keep hops small: their head-side
  // clip edge is the card itself, so a big jump would decapitate the bounce.
  const gesture: "greet" | "joy" | "sad" | "roll" | "anticipate" | "idle" | "hidden" =
    !visible            ? "hidden"
    : greeting          ? "greet"
    : mood === "joy"    ? "joy"
    : mood === "sad"    ? "sad"
    : rolling           ? "roll"
    : anticipating      ? "anticipate"
    : "idle";

  const lean = leanSign * 2.2; // degrees, toward the board
  const hop = <T,>(top: T, bottom: T) => (gaze === "up" ? bottom : top);

  // 1. Landing settle — squash on impact, tiny over-raise, settle to rest.
  const landingAnim =
    still || !visible
      ? { scaleY: 1, scaleX: 1 }
      : { scaleY: [0.955, 1.012, 1], scaleX: [1.045, 0.992, 1] };
  const landingTransition =
    still || !visible
      ? { duration: 0.18 }
      : { duration: 0.52, times: [0, 0.42, 1], ease: "easeOut" as const };

  // 2. Base life — always-on while visible, independent of the mood. Small
  //    amplitudes: this is the floor the expressions ride on, not a gesture.
  const baseAnim =
    still || !visible
      ? { y: 0, rotate: 0, scaleY: 1, scaleX: 1 }
      : {
          y: [0, hop(-0.9, -0.6), 0.2, 0],
          rotate: [0, 0.55 * leanSign, -0.42 * leanSign, 0],
          scaleY: [1, 1.008, 0.995, 1],
          scaleX: 1,
        };
  const baseTransition =
    still || !visible
      ? { duration: 0.3 }
      : {
          y:      { duration: 3.7, times: [0, 0.38, 0.72, 1], repeat: Infinity, ease: "easeInOut" as const },
          rotate: { duration: 6.3, times: [0, 0.42, 0.78, 1], repeat: Infinity, ease: "easeInOut" as const },
          scaleY: { duration: 4.6, times: [0, 0.38, 0.72, 1], repeat: Infinity, ease: "easeInOut" as const },
        };

  // 3. Mood gestures — neutral-anchored so switches blend through rest.
  const gestureAnim =
    still || gesture === "hidden"
      ? { y: 0, rotate: 0, scaleY: 1, scaleX: 1 }
      : gesture === "greet"
      ? { // "wave hello": quick friendly sway + a small hop
          y: [0, hop(-2.2, -1.6), 0, hop(-1, -0.7), 0],
          rotate: [0, 4.5 * leanSign, -3.5 * leanSign, 2.5 * leanSign, 0],
          scaleY: 1,
          scaleX: 1,
        }
      : gesture === "joy"
      ? { // arms-up cheer: hop + stretch toward the sky + a wiggle
          y: hop([0, -5.6, 0, -3, 0], [0, -1.2, 0, -0.6, 0]),
          rotate: [0, 2.5 * leanSign, -2 * leanSign, 0],
          scaleY: [1, 1.045, 1, 1.018, 1],
          scaleX: 1,
        }
      : gesture === "sad"
      ? { // deflated droop: blends in from rest, holds, and — crucially —
          // blends back out to rest BEFORE the 1.6s mood override expires.
          // Keyframe tracks start at their first keyframe, so a held pose
          // that never returns to neutral would hard-cut when the next mood
          // takes over; this self-contained envelope ends where it started.
          y: [0, 2.6, 2.6, 0],
          rotate: [0, -1.6 * leanSign, -1.6 * leanSign, 0],
          scaleY: [1, 0.972, 0.972, 1],
          scaleX: [1, 1.012, 1.012, 1],
        }
      : gesture === "roll"
      ? { // die is tumbling: excited shiver — fast hop synced to the die,
          // slower lean oscillation so the two never visibly lock together
          y: [0, hop(-1.8, -1.3), 0],
          rotate: [0, lean * 0.6, 0],
          scaleY: [1, 0.988, 1],
          scaleX: [1, 1.02, 1],
        }
      : gesture === "anticipate"
      ? { // about to roll: eager bouncing on the toes, leaning toward the board
          y: [hop(0.8, 0.6), hop(-2.4, -1.6), hop(0.8, 0.6)],
          rotate: [0, lean, 0],
          scaleY: [1, 0.99, 1],
          scaleX: 1,
        }
      : { // visible & calm: slow breath + a lazy sway (rides on the base
          // life layer, so this stays the quietest of the gestures)
          y: [0, hop(-1.1, -0.8), 0],
          rotate: [0, 0.85 * leanSign, 0, -0.65 * leanSign, 0],
          scaleY: 1,
          scaleX: 1,
        };

  const gestureTransition =
    still || gesture === "hidden"
      ? { duration: 0.24, ease: "easeOut" as const }
      : gesture === "greet"
      ? { duration: 1.0, times: [0, 0.28, 0.55, 0.78, 1], ease: "easeInOut" as const }
      : gesture === "joy"
      ? { duration: 0.62, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeInOut" as const, repeat: 2, repeatDelay: 0.08 }
      : gesture === "sad"
      ? { duration: 1.5, times: [0, 0.22, 0.72, 1], ease: ["easeOut" as const, "linear" as const, "easeInOut" as const] }
      : gesture === "roll"
      ? {
          y:      { duration: 0.5, times: [0, 0.42, 1], repeat: Infinity, ease: "easeInOut" as const },
          rotate: { duration: 1.05, times: [0, 0.5, 1], repeat: Infinity, ease: "easeInOut" as const },
          scaleY: { duration: 0.5, times: [0, 0.42, 1], repeat: Infinity, ease: "easeInOut" as const },
          scaleX: { duration: 0.5, times: [0, 0.42, 1], repeat: Infinity, ease: "easeInOut" as const },
        }
      : gesture === "anticipate"
      ? {
          y:      { duration: 0.38, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 0.42, ease: "easeInOut" as const },
          rotate: { duration: 1.9, times: [0, 0.5, 1], repeat: Infinity, ease: "easeInOut" as const },
          scaleY: { duration: 0.38, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 0.42, ease: "easeInOut" as const },
        }
      : {
          y:      { duration: 2.8, times: [0, 0.42, 1], repeat: Infinity, ease: "easeInOut" as const },
          rotate: { duration: 5.6, times: [0, 0.28, 0.62, 1], repeat: Infinity, ease: "easeInOut" as const },
        };

  // ── Glow pulse — quiet breath, brighter for excited/joy ──────────────────
  // Frozen (static filter) while hidden or still, so no filter loops run on a
  // character that is not on stage.
  const glowAnim = still || !visible
    ? { filter: glowFilter(glowStrength) }
    : mood === "sad"
      ? { filter: glowFilter(0.3) }
      : mood === "joy"
        ? { filter: [glowFilter(0.7), glowFilter(1), glowFilter(0.7)] }
        : mood === "excited"
          ? { filter: [glowFilter(0.5), glowFilter(0.85), glowFilter(0.5)] }
          : { filter: [glowFilter(0.3), glowFilter(0.6), glowFilter(0.3)] };
  const glowTransition = still || !visible
    ? { duration: 0.2 }
    : mood === "sad"
      ? { duration: 0.6, ease: "easeOut" as const }
      : mood === "joy"
        ? { duration: 0.4, repeat: 3, ease: "easeInOut" as const }
        : mood === "excited"
          ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  const { png, webp } = MASCOT_ASSETS[player] ?? MASCOT_ASSETS[3];
  const pngPath  = import.meta.env.BASE_URL + png;
  const webpPath = import.meta.env.BASE_URL + webp;
  // Sadness desaturates the character so the droop reads even in motion.
  const sadFilter = mood === "sad" ? "saturate(0.55) brightness(0.92)" : undefined;

  // The character's own <picture> (base + hint share it via a tiny helper).
  const art = (artStyle?: React.CSSProperties) => (
    <picture style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <source srcSet={webpPath} type="image/webp" />
      <img
        src={pngPath}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{
          width: mascotW,
          height: mascotH,
          objectFit: "contain",
          filter: sadFilter,
          userSelect: "none",
          pointerEvents: "none",
          ...artStyle,
        }}
      />
    </picture>
  );

  return (
    <div
      aria-hidden
      data-mascot={player}
      data-mascot-mood={mood}
      style={{
        position: "absolute",
        left: 0,
        ...sidePos,
        width,
        height: winH,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {/* Idle peek hint — the top of the head (trophy tip for Yellow) barely
          peeking over the card's edge while the character hides behind it.
          Crossfades with the climbing character: as it rises, its head passes
          through this exact strip (same art, same position), so the handoff is
          pixel-identical. Slides toward the card as it goes. */}
      <motion.div
        data-mascot-hint
        initial={false}
        animate={{
          opacity: visible ? 0 : 0.92,
          y: visible ? (gaze === "down" ? hintH : -hintH) : 0,
        }}
        transition={visible ? { duration: 0.12, ease: "easeIn" as const } : { duration: 0.34, delay: 0.3, ease: "easeOut" as const }}
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: hintH,
          ...(gaze === "up" ? { top: 0 } : { bottom: 0 }),
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* Gentle bob so the hint feels alive — disabled for reduced motion. */}
        <motion.div
          animate={still ? {} : { y: [0, 0.9, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "100%",
            height: mascotH,
            display: "flex",
            justifyContent: "center",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
          }}
        >
          {art()}
        </motion.div>
      </motion.div>

      {/* Climb layer — slides the whole character in/out of the clip window */}
      <motion.div
        data-mascot-stage
        initial={still ? { opacity: 0 } : { y: yHidden, opacity: 0 }}
        animate={climbTarget}
        transition={climbTransition}
        style={{
          position: "absolute",
          left: 0,
          ...(gaze === "up" ? { top: 0 } : { bottom: 0 }),
          width: "100%",
          height: mascotH,
          display: "flex",
          alignItems: gaze === "up" ? "flex-start" : "flex-end",
          justifyContent: "center",
          willChange: "transform, opacity",
        }}
      >
        {/* Landing layer — one-shot squash-and-settle each time the character
            climbs into view (absorbs the arrival like a footfall). */}
        <motion.div
          animate={landingAnim}
          transition={landingTransition}
          style={{
            width: "100%",
            height: mascotH,
            position: "relative",
            transformOrigin: "50% 100%",
            willChange: "transform",
          }}
        >
        {/* Base-life layer — the permanent breath/sway the expressions ride
            on. Runs while visible regardless of mood, so expression changes
            cross-fade over a continuously moving idle instead of hard-cutting
            from one loop to the next. */}
        <motion.div
          animate={baseAnim}
          transition={baseTransition}
          style={{
            width: "100%",
            height: mascotH,
            position: "relative",
            transformOrigin: "50% 100%",
            willChange: "transform",
          }}
        >
        {/* Gesture layer — wave / cheer / droop / eager bounce, pivoting on
            the character's base (the card-adjacent edge). */}
        <motion.div
          animate={gestureAnim}
          transition={gestureTransition}
          style={{
            width: "100%",
            height: mascotH,
            position: "relative",
            transformOrigin: "50% 100%",
            willChange: "transform",
          }}
        >
          {/* Glow layer — the themed light around the character */}
          <motion.div
            animate={glowAnim}
            transition={glowTransition}
            style={{
              width: "100%",
              height: mascotH,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              filter: glowFilter(glowStrength),
              willChange: "filter",
            }}
          >
            {art()}
          </motion.div>

          {/* Wave arcs — two small "hello!" arcs beside the head, a one-shot
              accent for the greeting sway only. */}
          {greeting && !still && (
            <>
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 0.85, 0], scale: [0.4, 1, 1.15] }}
                  transition={{ duration: 0.7, delay: 0.12 + i * 0.16, ease: "easeOut" as const }}
                  style={{
                    position: "absolute",
                    right: `${3 + i * 5}%`,
                    top: `${16 + i * 9}%`,
                    width: 5 + i,
                    height: 9 + i * 2,
                    borderRadius: "50%",
                    border: `1.5px solid ${glow}`,
                    borderLeftColor: "transparent",
                    pointerEvents: "none",
                  }}
                />
              ))}
            </>
          )}

          {/* Celebration sparkles — twinkle around the mascot on joy */}
          {mood === "joy" && !still && (
            <>
              {[
                { left: "2%",  top: "10%", delay: 0,    color: "#FFE27A" },
                { right: "0%", top: "26%", delay: 0.12, color: "#FFFFFF" },
                { left: "14%", top: "46%", delay: 0.22, color: "#FFD36E" },
                { right: "12%", top: "58%", delay: 0.3, color: "#FFF3B0" },
              ].map((s, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, delay: s.delay, repeat: 2, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: s.color,
                    boxShadow: `0 0 8px ${s.color}`,
                    ...(s.left !== undefined ? { left: s.left } : { right: s.right }),
                    top: s.top,
                    pointerEvents: "none",
                  }}
                />
              ))}
            </>
          )}
        </motion.div>
        </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
});
