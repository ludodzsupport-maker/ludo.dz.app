// MascotCharacter — the illustrated per-colour characters (Red, Blue, Yellow,
// Green) as a standalone presentation component, extracted from the former
// board-side CornerMascot. Everything about the characters is preserved: the
// same artwork, per-colour theming, glow treatment, and the layered motion
// model (landing settle → permanent base-life breath/sway → mood gestures
// that all start and end at the shared neutral pose so mood changes
// cross-fade instead of hard-cutting). What is gone is the gameplay plumbing
// this component used to carry: the clip window, hide/peek/climb offsets and
// one-shot board events. Presentation contexts just pick a mood.
//
// Sizing note: gestures were tuned around a ~50px character and scaled by
// height, so they read as charm, not noise, at any size.
import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import * as E from "../lib/ludo-engine";
import * as DZ from "../lib/board-theme-dz";

export type MascotMood = "alert" | "excited" | "joy" | "sad";

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

interface MascotCharacterProps {
  /** Which colour's character to show (0 Red, 1 Blue, 2 Yellow, 3 Green). */
  player: number;
  /** The character's expression — held until the prop changes. */
  mood?: MascotMood;
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  size: number;
  /** Board-theme glow treatment (classic drop-shadow halo, DZ gold, neon).
   *  Exactly one should be true; defaults to the classic halo. */
  isClassic?: boolean;
  isDz?: boolean;
  isNeon?: boolean;
  /** Changing this key plays a one-shot friendly "wave hello". Pass the
   *  selection/occasion it accompanies (e.g. the chosen colour index). */
  greetKey?: string | number;
}

export const MascotCharacter = memo(function MascotCharacter({
  player, mood = "alert", size, isClassic = true, isDz = false, isNeon = false, greetKey,
}: MascotCharacterProps) {
  const still = !!useReducedMotion();

  // ── Greeting — a one-shot "wave hello" on mount and whenever greetKey
  // changes (e.g. a new colour is picked). The short delay lets the landing
  // settle land before the wave starts.
  const [greeting, setGreeting] = useState(false);
  const greetTimer1 = useRef<number | undefined>(undefined);
  const greetTimer2 = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (still) return;
    window.clearTimeout(greetTimer1.current);
    window.clearTimeout(greetTimer2.current);
    greetTimer1.current = window.setTimeout(() => setGreeting(true), 280);
    greetTimer2.current = window.setTimeout(() => setGreeting(false), 1320);
    return () => {
      window.clearTimeout(greetTimer1.current);
      window.clearTimeout(greetTimer2.current);
    };
  }, [greetKey, still]);
  useEffect(() => () => {
    window.clearTimeout(greetTimer1.current);
    window.clearTimeout(greetTimer2.current);
  }, []);

  // ── Geometry ──────────────────────────────────────────────────────────────
  const mascotH = Math.round(size);
  const mascotW = Math.round(mascotH * MASCOT_ASPECT);
  // Gesture aim: alternate the lean per character so a row of mascots does
  // not all sway in lock-step the same way.
  const leanSign = player % 2 === 0 ? 1 : -1;

  // ── Per-theme glow (the art keeps its player colour; the light adapts) ───
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

  // Sadness desaturates the character so the droop reads even in motion.
  const sadFilter = mood === "sad" ? "saturate(0.55) brightness(0.92)" : undefined;

  const { png, webp } = MASCOT_ASSETS[player] ?? MASCOT_ASSETS[3];
  const pngPath  = import.meta.env.BASE_URL + png;
  const webpPath = import.meta.env.BASE_URL + webp;

  // The character's own <picture>.
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

  // ── Gestures — mood-driven body language ───────────────────────────────────
  // Three stacked transform layers (all pivoting on the character's base):
  //   1. landing — a one-shot squash-and-settle on mount, absorbing the
  //      arrival like a real footfall;
  //   2. base life — a permanent breath/sway loop. It never restarts on mood
  //      changes, so expression switches blend over a continuously alive
  //      idle instead of cutting from loop to loop. Its per-property periods
  //      are mutually desynchronised (quasi-aperiodic), which reads as
  //      breathing rather than ticking;
  //   3. gesture — the mood expression. Keyframe tracks start at their first
  //      keyframe, so every looping gesture starts AND ends at the same
  //      neutral pose: transitions cross-fade instead of popping. Held poses
  //      (sad) use single-value targets, which blend both in and out.
  const gesture: "greet" | "joy" | "sad" | "excited" | "idle" =
    greeting ? "greet" : mood === "alert" ? "idle" : mood;

  const lean = leanSign * 2.2; // degrees

  // 1. Landing settle — squash on impact, tiny over-raise, settle to rest.
  const landingAnim = still
    ? { scaleY: 1, scaleX: 1 }
    : { scaleY: [0.955, 1.012, 1], scaleX: [1.045, 0.992, 1] };
  const landingTransition = still
    ? { duration: 0.18 }
    : { duration: 0.52, times: [0, 0.42, 1], ease: "easeOut" as const };

  // 2. Base life — always-on, independent of the mood. Small amplitudes:
  //    this is the floor the expressions ride on, not a gesture.
  const baseAnim = still
    ? { y: 0, rotate: 0, scaleY: 1, scaleX: 1 }
    : {
        y: [0, -0.9, 0.2, 0],
        rotate: [0, 0.55 * leanSign, -0.42 * leanSign, 0],
        scaleY: [1, 1.008, 0.995, 1],
        scaleX: 1,
      };
  const baseTransition = still
    ? { duration: 0.3 }
    : {
        y:      { duration: 3.7, times: [0, 0.38, 0.72, 1], repeat: Infinity, ease: "easeInOut" as const },
        rotate: { duration: 6.3, times: [0, 0.42, 0.78, 1], repeat: Infinity, ease: "easeInOut" as const },
        scaleY: { duration: 4.6, times: [0, 0.38, 0.72, 1], repeat: Infinity, ease: "easeInOut" as const },
      };

  // 3. Mood gestures — neutral-anchored so switches blend through rest.
  const gestureAnim =
    still
      ? { y: 0, rotate: 0, scaleY: 1, scaleX: 1 }
      : gesture === "greet"
      ? { // "wave hello": quick friendly sway + a small hop
          y: [0, -2.2, 0, -1, 0],
          rotate: [0, 4.5 * leanSign, -3.5 * leanSign, 2.5 * leanSign, 0],
          scaleY: 1,
          scaleX: 1,
        }
      : gesture === "joy"
      ? { // arms-up cheer: hop + stretch toward the sky + a wiggle. Loops
          // with a short breather between bursts — a sustained celebration
          // without turning frantic; the base-life layer fills the pauses.
          y: [0, -5.6, 0, -3, 0],
          rotate: [0, 2.5 * leanSign, -2 * leanSign, 0],
          scaleY: [1, 1.045, 1, 1.018, 1],
          scaleX: 1,
        }
      : gesture === "sad"
      ? { // deflated droop: sink, hunch and hang the head — a held pose that
          // blends in from rest and back out when the mood changes.
          y: 2.6,
          rotate: -1.6 * leanSign,
          scaleY: 0.972,
          scaleX: 1.012,
        }
      : gesture === "excited"
      ? { // eager bouncing on the toes with a gentle board-ward lean
          y: [0.8, -2.4, 0.8],
          rotate: [0, lean, 0],
          scaleY: [1, 0.99, 1],
          scaleX: 1,
        }
      : { // calm: slow breath + a lazy sway (rides on the base life layer,
          // so this stays the quietest of the gestures)
          y: [0, -1.1, 0],
          rotate: [0, 0.85 * leanSign, 0, -0.65 * leanSign, 0],
          scaleY: 1,
          scaleX: 1,
        };

  const gestureTransition =
    still
      ? { duration: 0.24, ease: "easeOut" as const }
      : gesture === "greet"
      ? { duration: 1.0, times: [0, 0.28, 0.55, 0.78, 1], ease: "easeInOut" as const }
      : gesture === "joy"
      ? { duration: 0.62, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeInOut" as const, repeat: Infinity, repeatDelay: 0.55 }
      : gesture === "sad"
      ? { duration: 0.6, ease: "easeOut" as const }
      : gesture === "excited"
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
    ? { duration: 0.2 }
    : mood === "sad"
      ? { duration: 0.6, ease: "easeOut" as const }
      : mood === "joy"
        ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" as const }
        : mood === "excited"
          ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div
      aria-hidden
      data-mascot-character={player}
      data-mascot-character-mood={mood}
      style={{
        position: "relative",
        width: mascotW,
        height: mascotH,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
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
                    transition={{ duration: 0.7, delay: s.delay, repeat: Infinity, repeatDelay: 0.9, ease: "easeOut" as const }}
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
    </div>
  );
});
