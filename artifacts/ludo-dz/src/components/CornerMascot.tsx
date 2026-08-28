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
// Motion model (the "climb to peek")
// ----------------------------------
// The character lives just outside its panel, hidden behind a clip window with
// only a small sliver idling over the panel's outer edge. On its colour's turn
// it does a chin-up into view, looking toward the board; when the turn passes
// it slides back down to the idle sliver. Everything animates on
// transform/opacity/filter only (no layout thrash), and prefers-reduced-motion
// swaps the climb for a simple fade.
//
// Orientation
// -----------
//   • Top panels (gaze "down") → mascot stands ABOVE the panel, head up,
//     peeking over the panel's top edge and looking down at the board.
//   • Bottom panels (gaze "up") → mascot stands BELOW the panel, head up,
//     peeking up at the board from under the panel's bottom edge.
// The head therefore always ends up on the board-facing side, so the character
// reads as looking toward the board in all four corners.

import { memo, useEffect, useState } from "react";
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

// How much of the character pokes over the panel edge while hidden — the
// "fingertips" idle cue. A small sliver so the corner still hints that someone
// is waiting there, without covering the card.
const IDLE_SLIVER = 0.28;

interface CornerMascotProps {
  player: number;
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
  // A captured piece keeps the mascot peeking long enough to show the droop
  // before it retreats (the turn has already passed to another colour).
  const visible = active || overrideMood === "sad";

  // ── Geometry ──────────────────────────────────────────────────────────────
  // The character sits in a clip window just outside the panel's outer edge:
  //   • top panels    → window ABOVE the panel (window bottom = panel top)
  //   • bottom panels → window BELOW the panel (window top = panel bottom)
  const mascotH = Math.round(panelH * 0.62); // full character height
  const mascotW = Math.round(mascotH * MASCOT_ASPECT);
  const sliver  = Math.max(6, Math.round(mascotH * IDLE_SLIVER));
  const sidePos = gaze === "up" ? { top: panelH } : { bottom: panelH };
  // Hide direction: top panels slide UP out of the window, bottom panels DOWN.
  const dirUp   = gaze === "down";
  const yHidden = dirUp ? -mascotH : mascotH;
  const yIdle   = dirUp ? -(mascotH - sliver) : (mascotH - sliver);

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
  // Hidden-but-alive: under normal motion the character idles with a sliver
  // peeking; under reduced-motion it simply fades out (no looping motion).
  const climbTarget = still
    ? { opacity: visible ? 1 : 0 }
    : visible
      ? { y: 0, opacity: 1 }
      : { y: yIdle, opacity: 0.92 };
  const climbTransition = still
    ? { duration: 0.14 }
    : visible
      ? { type: "spring" as const, stiffness: 300, damping: 26, mass: 0.95 }
      : { duration: 0.3, ease: "easeIn" as const };

  // ── Inner life: idle breath, rolling excitement, joy hop, sad droop ──────
  const innerAnim = still
    ? {}
    : mood === "joy"
      ? { y: [0, -6, 0, -3, 0] }
      : mood === "sad"
        ? { y: 2.5 }
        : mood === "excited"
          ? { y: [0, -1.8, 0] }
          : { y: [0, -1.2, 0] };
  const innerTransition = still
    ? {}
    : mood === "joy"
      ? { duration: 0.6, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeInOut" as const, repeat: 2, repeatDelay: 0.08 }
      : mood === "sad"
        ? { duration: 0.35, ease: "easeOut" as const }
        : mood === "excited"
          ? { duration: 0.32, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  // Idle sliver fidget — a faint bob while waiting (hidden, motion allowed).
  const idleBob = still || visible ? {} : { y: dirUp ? [0, 1.4, 0] : [0, -1.4, 0] };

  // Glow pulse — quiet breath, brighter for excited/joy.
  const glowAnim = still
    ? { filter: glowFilter(glowStrength) }
    : mood === "sad"
      ? { filter: glowFilter(0.3) }
      : mood === "joy"
        ? { filter: [glowFilter(0.7), glowFilter(1), glowFilter(0.7)] }
        : mood === "excited"
          ? { filter: [glowFilter(0.5), glowFilter(0.85), glowFilter(0.5)] }
          : { filter: [glowFilter(0.3), glowFilter(0.6), glowFilter(0.3)] };
  const glowTransition = still
    ? { duration: 0.14 }
    : mood === "sad"
      ? { duration: 0.35 }
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

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        ...sidePos,
        width,
        height: mascotH,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {/* Climb layer — slides the whole character in/out of the clip window */}
      <motion.div
        initial={still ? { opacity: 0 } : { y: yHidden, opacity: 0 }}
        animate={climbTarget}
        transition={climbTransition}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: mascotH,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          willChange: "transform, opacity",
        }}
      >
        {/* Inner-life layer — breath / excitement / joy hop / droop */}
        <motion.div
          animate={innerAnim}
          transition={innerTransition}
          style={{ width: "100%", height: mascotH, position: "relative", willChange: "transform" }}
        >
          {/* Idle sliver fidget — only while hidden under normal motion */}
          <motion.div
            animate={idleBob}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "100%", height: mascotH, position: "relative" }}
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
                  }}
                />
              </picture>
            </motion.div>
          </motion.div>

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
    </div>
  );
});
