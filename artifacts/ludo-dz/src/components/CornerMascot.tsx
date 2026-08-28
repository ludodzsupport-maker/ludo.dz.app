// ─── CornerMascot — animated 3D mascots for the four dice-roll panels ──────
// One consistent "peek-over-the-card" character, recoloured/reshaded per board
// theme (Classic / DZ / Neon) exactly like the existing pieces and dice cards.
//
// Visual language
// ---------------
// The glossy, dimensional look is built the same way the board's pawns and
// dice are: a radial body gradient that runs white-hotspot → light tint →
// player colour → deep shade, plus a soft core shadow, a bright specular
// highlight with a hot-spot, and a rim light that reads as light bouncing off
// the card. A crisp theme outline (Classic border / DZ gold / Neon neon) keeps
// the silhouette clean at the tiny corner-panel scale.
//
// Motion model (the "climb to peek")
// ----------------------------------
// The mascot lives behind its card, out of sight, with only four fingertips
// idling over the card's inner edge. When its colour's turn starts it does a
// chin-up: the hands rise and grip the edge first, then the head/body is
// pulled up behind them into a peek that looks toward the dice/board. When the
// turn passes it lets go and slides back down. Everything animates on
// transform/opacity only (no layout thrash), and prefers-reduced-motion swaps
// the climb for a simple fade.
//
// Orientation
// -----------
// The character is authored once in "canonical" pose (mascot above the card,
// hands gripping the card's top edge, head above the hands). Top panels sit
// above the board, so their mascot must instead hang below the card and look
// DOWN at the board — that case reuses the same artwork mirrored vertically
// (hands end up on top, gripping the card's bottom edge), while the face and
// the crown sprout are drawn separately so they stay upright and on the crown
// in both orientations. The eyes (gaze) always point toward the board.

import { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import * as E from "../lib/ludo-engine";
import * as DZ from "../lib/board-theme-dz";

// Classic palette — mirrors the module-level constants in GameBoardScreen.
// Kept local (rather than imported) to avoid a cross-file import cycle; the
// values are identical to the dice cards'.
const CL_SOLID  = ["#C31024", "#1542B0", "#E8A800", "#1C6B2E"] as const;
const CL_LIGHT  = ["#FAECEE", "#E2ECFF", "#FFF4D8", "#E4F5EA"] as const;
const CL_BORDER = ["#8A0B1E", "#0C3082", "#9C6E00", "#10481C"] as const;

// Lighten (positive) / darken (negative) a hex colour by percent (−100…100).
// Same algorithm as GameBoardScreen.shadeColor — kept local so this component
// stays self-contained and never needs to import from its own host screen.
function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

/** A one-shot mood event raised by CornerDice (six roll / capture / captured),
 *  targeted at a single corner via `player`. */
export type MascotEvent = { player: number; kind: "six" | "capture" | "captured"; id: number } | null;

type Mood = "alert" | "excited" | "joy" | "sad";

interface CornerMascotProps {
  player: number;
  isClassic: boolean;
  isDz: boolean;
  isNeon: boolean;
  /** Mascot width in px (already viewport-scaled) — drives every dimension. */
  width: number;
  /** Panel height in px — used to anchor the mascot to the card's inner edge. */
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

// ── Geometry (SVG user units, viewBox 0 0 100 60) ──────────────────────────
// Canonical pose: card edge along the bottom of the viewBox (y = 60), mascot
// above it with the head up. Hiding = translating the whole character past the
// edge (clipped). For top panels the artwork is mirrored vertically so the
// edge is effectively at the top instead.
const VB_W = 100;
const VB_H = 60;
const HIDE = 56;
const HEAD = { cx: 50, cy: 24, r: 18 };

/** Facial features for a given mood. Upright at all times; only the gaze
 *  (pupil offset toward the board) flips between top and bottom panels. */
function Face({ mood, gaze, iris, deep }: { mood: Mood; gaze: "down" | "up"; iris: string; deep: string }) {
  const gazeDy = gaze === "down" ? 1 : -1;

  if (mood === "joy") {
    return (
      <g>
        {/* Happy closed eyes (∩ arcs) */}
        <path d="M 37 22 Q 41.5 18.5 46 22" stroke={deep} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <path d="M 54 22 Q 58.5 18.5 63 22" stroke={deep} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        {/* Big open grin + tongue */}
        <path d="M 44 28 Q 50 23 56 28 L 56 32.5 Q 50 37.5 44 32.5 Z" fill={deep} />
        <ellipse cx="50" cy="33" rx="3" ry="1.5" fill="#ff8b80" />
      </g>
    );
  }

  if (mood === "sad") {
    return (
      <g>
        {/* Worried brows — inner ends raised */}
        <path d="M 37 16 Q 41 13 45 15" stroke={deep} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M 63 16 Q 59 13 55 15" stroke={deep} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Downcast eyes */}
        <circle cx="41" cy="23" r="5.2" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
        <circle cx="59" cy="23" r="5.2" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
        <circle cx="41" cy="24.2" r="2.2" fill={iris} />
        <circle cx="59" cy="24.2" r="2.2" fill={iris} />
        <circle cx="41" cy="24.5" r="1.1" fill={deep} />
        <circle cx="59" cy="24.5" r="1.1" fill={deep} />
        {/* Frown */}
        <path d="M 46 34 Q 50 31 54 34" stroke={deep} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* Tear */}
        <path d="M 64 25 C 62.6 28 62.6 30 64 30 C 65.4 30 65.4 28 64 25 Z" fill="#7ec8ff" />
      </g>
    );
  }

  if (mood === "excited") {
    return (
      <g>
        {/* Raised brows */}
        <path d="M 37 14 Q 41 11 45 13" stroke={deep} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M 63 14 Q 59 11 55 13" stroke={deep} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Wide eager eyes */}
        <circle cx="41" cy="22" r="5.8" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
        <circle cx="59" cy="22" r="5.8" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
        <circle cx="41" cy={22 + gazeDy} r="2.8" fill={iris} />
        <circle cx="59" cy={22 + gazeDy} r="2.8" fill={iris} />
        <circle cx="41" cy={22 + gazeDy} r="1.4" fill={deep} />
        <circle cx="59" cy={22 + gazeDy} r="1.4" fill={deep} />
        <circle cx="39.8" cy="20.4" r="1" fill="#fff" />
        <circle cx="57.8" cy="20.4" r="1" fill="#fff" />
        {/* Open excited grin */}
        <path d="M 45 29 Q 50 25 55 29 L 55 33 Q 50 37 45 33 Z" fill={deep} />
        <ellipse cx="50" cy="33" rx="2.6" ry="1.3" fill="#ff8b80" />
      </g>
    );
  }

  // alert / neutral — curious, looking toward the dice/board
  return (
    <g>
      <path d="M 37 15 Q 41 12.5 45 14.5" stroke={deep} strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <path d="M 63 15 Q 59 12.5 55 14.5" stroke={deep} strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <circle cx="41" cy="22" r="5.4" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
      <circle cx="59" cy="22" r="5.4" fill="#fff" stroke={deep} strokeWidth="0.7" strokeOpacity="0.35" />
      <circle cx="41" cy={22 + gazeDy} r="2.4" fill={iris} />
      <circle cx="59" cy={22 + gazeDy} r="2.4" fill={iris} />
      <circle cx="41" cy={22 + gazeDy} r="1.2" fill={deep} />
      <circle cx="59" cy={22 + gazeDy} r="1.2" fill={deep} />
      <circle cx="39.8" cy="20.4" r="0.9" fill="#fff" />
      <circle cx="57.8" cy="20.4" r="0.9" fill="#fff" />
      {/* Gentle smile */}
      <path d="M 46 30.5 Q 50 33.5 54 30.5" stroke={deep} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </g>
  );
}

export const CornerMascot = memo(function CornerMascot({
  player, isClassic, isDz, isNeon,
  width, panelH, active, rolling, anticipating, gaze, event, paused,
}: CornerMascotProps) {
  // `still` covers both reduced-motion and the Neon exit-modal pause: looping
  // motion stops, but the mascot (and its mood) stays fully present.
  const still = !!useReducedMotion() || !!paused;

  // Timed celebration / disappointment override, cleared after it plays out.
  const [overrideMood, setOverrideMood] = useState<Mood | null>(null);
  useEffect(() => {
    if (!event) return;
    setOverrideMood(event.kind === "captured" ? "sad" : "joy");
    const ms = event.kind === "captured" ? 1600 : 1500;
    const t = window.setTimeout(() => setOverrideMood(null), ms);
    return () => window.clearTimeout(t);
  }, [event]);

  const mood: Mood = overrideMood ?? (rolling || anticipating ? "excited" : "alert");
  // A captured piece keeps the mascot peeking long enough to show the pout
  // before it retreats (the turn has already passed to another colour).
  const visible = active || overrideMood === "sad";

  // ── Per-theme palette (one design, recoloured per board style) ───────────
  const body    = isClassic ? CL_SOLID[player] : isDz ? DZ.HOME_COLORS[player] : E.PLAYER_COLORS[player];
  const outline = isClassic ? CL_BORDER[player] : isDz ? DZ.BORDER_GOLD : E.PLAYER_NEONS[player];
  const accent  = isClassic ? CL_LIGHT[player] : isDz ? DZ.BORDER_GOLD : E.PLAYER_NEONS[player];
  const iris    = shadeColor(body, -34);
  const deep    = "#211009";

  // ── Orientation ──────────────────────────────────────────────────────────
  // The mascot peeks over its panel's OUTER edge (the edge facing the screen
  // margin, never the board), so it never covers any board cells:
  //   • Top panels (gaze "down") → mascot sits ABOVE the panel, head up,
  //     peeking over the panel's top edge and looking down at the board.
  //     Canonical pose, hide = slide up past the top edge.
  //   • Bottom panels (gaze "up") → mascot hangs BELOW the panel, head down,
  //     peeking over the panel's bottom edge and looking up at the board.
  //     Artwork mirrored vertically, hide = slide down past the bottom edge.
  const mirrored   = gaze === "up";
  const headY      = mirrored ? 36 : 24;
  // Silhouette mirror: canonical artwork (head at top) → head at bottom.
  const mirror     = mirrored ? "translate(0,60) scale(1,-1)" : undefined;
  // Everything drawn upright (face, crown sprout, head shading) is authored in
  // canonical coordinates (head centre cy 24) and shifted onto the live head.
  const headShift  = mirrored ? "translate(0,12)" : undefined; // head cy 24 → 36
  const hideY      = mirrored ? HIDE : -HIDE;
  const height     = (width * VB_H) / VB_W;
  const sidePos    = mirrored ? { top: panelH } : { bottom: panelH };

  // ── Climb / retreat targets (transform/opacity only) ─────────────────────
  const rise          = still ? { opacity: visible ? 1 : 0 } : { y: visible ? 0 : hideY };
  const riseInitial   = still ? { opacity: 0 } : { y: hideY };
  const armsTransition = still
    ? { duration: 0.14 }
    : visible
      ? { type: "spring" as const, stiffness: 360, damping: 26, mass: 0.9 }
      : { duration: 0.26, ease: "easeIn" as const };
  const bodyTransition = still
    ? { duration: 0.14 }
    : visible
      ? { type: "spring" as const, stiffness: 250, damping: 24, mass: 1.05, delay: 0.08 }
      : { duration: 0.3, ease: "easeIn" as const };

  // Inner life: idle breathing, rolling excitement, or the joy hop.
  const innerAnim = still
    ? {}
    : mood === "joy"
      ? { y: [0, -4, 0, -2, 0] }
      : rolling
        ? { y: [0, -0.8, 0] }
        : visible
          ? { y: [0, -1.2, 0] }
          : { y: 0 };
  const innerTransition = still
    ? {}
    : mood === "joy"
      ? { duration: 0.6, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeInOut" as const, repeat: 2, repeatDelay: 0.08 }
      : rolling
        ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" as const }
        : visible
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 0.3 };

  // Fingertips fidget away from the card's edge (up in canonical, down when
  // the mascot hangs below the card).
  const fingerBob = still ? {} : { y: mirrored ? [0, 1.2, 0] : [0, -1.2, 0] };

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      style={{
        position: "absolute",
        left: 0,
        ...sidePos,
        display: "block",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <defs>
        <radialGradient id={`mascot-body-${player}`} cx="36%" cy="24%" r="88%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="16%"  stopColor={shadeColor(body, 22)} />
          <stop offset="48%"  stopColor={body} />
          <stop offset="80%"  stopColor={shadeColor(body, -26)} />
          <stop offset="100%" stopColor={shadeColor(body, -52)} />
        </radialGradient>
        {isNeon && (
          <radialGradient id={`mascot-glow-${player}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={outline} stopOpacity="0.5" />
            <stop offset="100%" stopColor={outline} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      <g>
        {/* Idle fingertips — the only hint while hidden; they curl away on the climb */}
        <motion.g
          initial={{ opacity: 0.9 }}
          animate={still ? { opacity: visible ? 0 : 0.9 } : { opacity: visible ? 0 : 0.95 }}
          transition={{ duration: 0.18 }}
        >
          <motion.g animate={fingerBob} transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}>
            <g transform={mirror}>
              {[20, 25, 75, 80].map((x) => (
                <circle key={x} cx={x} cy={57.5} r={2} fill={shadeColor(body, -10)} />
              ))}
            </g>
          </motion.g>
        </motion.g>

        {/* Arms + hands — rise to grip first */}
        <motion.g initial={riseInitial} animate={rise} transition={armsTransition} style={{ willChange: "transform" }}>
          <g transform={mirror}>
            {/* Left arm + hand */}
            <path d="M 41 36 Q 33 44 26 52" stroke={shadeColor(body, -34)} strokeWidth="9.5" strokeLinecap="round" />
            <path d="M 41 36 Q 33 44 26 52" stroke={shadeColor(body, -6)} strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="26" cy="52" r="6" fill={shadeColor(body, -6)} stroke={shadeColor(body, -34)} strokeWidth="1.2" />
            <ellipse cx="24.6" cy="50.5" rx="2.2" ry="1.5" fill="#fff" opacity="0.4" />
            {/* Right arm + hand — lifts to cheer on joy */}
            <motion.g
              animate={{ rotate: mood === "joy" ? -72 : 0 }}
              transition={still ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }}
              style={{ transformOrigin: "59px 36px" }}
            >
              <path d="M 59 36 Q 67 44 74 52" stroke={shadeColor(body, -34)} strokeWidth="9.5" strokeLinecap="round" />
              <path d="M 59 36 Q 67 44 74 52" stroke={shadeColor(body, -6)} strokeWidth="7.5" strokeLinecap="round" />
              <circle cx="74" cy="52" r="6" fill={shadeColor(body, -6)} stroke={shadeColor(body, -34)} strokeWidth="1.2" />
              <ellipse cx="72.6" cy="50.5" rx="2.2" ry="1.5" fill="#fff" opacity="0.4" />
            </motion.g>
          </g>
        </motion.g>

        {/* Head + body — pulled up behind the gripping hands */}
        <motion.g initial={riseInitial} animate={rise} transition={bodyTransition} style={{ willChange: "transform" }}>
          <motion.g animate={innerAnim} transition={innerTransition}>
            {/* Silhouette (glow + head circle + outline) — mirrored for the
                hanging orientation so it lands on the live head position. */}
            <g transform={mirror}>
              {isNeon && <circle cx={HEAD.cx} cy={HEAD.cy} r="26" fill={`url(#mascot-glow-${player})`} />}
              <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={`url(#mascot-body-${player})`}
                stroke={outline} strokeWidth="1.6" strokeOpacity="0.9" />
            </g>

            {/* Shading + face + sprout — drawn upright (light stays top-left) and
                shifted onto the head centre in both orientations. */}
            <g transform={headShift}>
              {/* Core shadow — asymmetric shading opposite the highlight */}
              <ellipse cx="56" cy="36" rx="12" ry="6" fill="#000" opacity="0.12" />
              {/* Rim light — light bouncing off the card toward the mascot */}
              <path d="M 36 34 Q 50 41 64 34" stroke={shadeColor(body, 30)} strokeWidth="1.6"
                strokeOpacity="0.5" strokeLinecap="round" fill="none" />
              {/* Specular highlight + hot-spot — the lacquered-sheen cue */}
              <ellipse cx="42" cy="15.5" rx="5.5" ry="3.8" fill="#fff" opacity="0.72" />
              <circle cx="39.5" cy="13.5" r="1.7" fill="#fff" opacity="0.95" />

              {/* Crown sprout — upright on the crown in both orientations */}
              <ellipse cx="47" cy="7.2" rx="1.9" ry="3.1" fill={accent} stroke={shadeColor(body, -40)} strokeWidth="0.5"
                transform="rotate(-20 47 7.2)" />
              <ellipse cx="53" cy="7.2" rx="1.9" ry="3.1" fill={accent} stroke={shadeColor(body, -40)} strokeWidth="0.5"
                transform="rotate(20 53 7.2)" />

              {/* Face — crossfades between moods, eyes glance toward the board */}
              <motion.g
                key={mood}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: still ? 0.05 : 0.15 }}
                style={{ transformOrigin: `50px ${headY}px` }}
              >
                <Face mood={mood} gaze={gaze} iris={iris} deep={deep} />
              </motion.g>
            </g>
          </motion.g>
        </motion.g>
      </g>
    </svg>
  );
});
