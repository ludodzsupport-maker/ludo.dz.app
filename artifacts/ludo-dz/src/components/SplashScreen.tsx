/**
 * SplashScreen — "The Ludo Eclipse"
 *
 * Design concept: a deep indigo/emerald night sky, textured with a
 * whisper-faint isometric lattice of Ludo board squares for depth. At
 * its centre, the logo sits behind a static, polished-gold "solar
 * eclipse" bezel — no spinning parts. Instead, the logo ignites from
 * behind: a rhythmic, breathing pulse of light in the four signature
 * player colours (Red, Green, Blue, Gold) bleeds out from under the
 * gold ring, blooming and fading like a living aurora. The four corner
 * pawns return as frosted glass medallions, each lit by a bright neon
 * glow in its own colour — static, but luminous. A wave of four
 * classic loading dots pulses and floats along the bottom, sequencing
 * through the game's colours as they go.
 *
 * Content, hierarchy, the four player colours, corner positions, and
 * all title/subtitle copy are unchanged — only the presentation layer
 * is new.
 */

import { motion, useReducedMotion } from "framer-motion";
import { GamePiece } from "./GamePiece";
import type { CSSProperties } from "react";

// ── Brand palette ──────────────────────────────────────────────────────
const PC = {
  red  : "#DC143C",
  green: "#00A651",
  blue : "#1E90FF",
  gold : "#FFD700",
} as const;

// ── Polished gold-metal accents for the eclipse bezel ───────────────────
const GOLD = {
  deep: "#7D5700", // rich brass shadow
  base: "#C9A227", // border gold
  gilt: "#FFE49A", // gilt highlight
};

// ── Isometric Ludo-square lattice (data URI, no spaces → no encoding hell) ──
// A fine diamond grid (squares in isometric projection) plus a larger
// second scale for depth — both rendered in ultra-faint gold so they
// read as texture, never as decoration.
const ISO_FINE =
  `url("data:image/svg+xml,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='32'%3E` +
  `%3Cpolygon points='28,0,56,16,28,32,0,16' fill='none' stroke='%23C9A227' stroke-width='0.6' stroke-opacity='.05'/%3E` +
  `%3Cline x1='28' y1='0' x2='28' y2='32' stroke='%23C9A227' stroke-opacity='.03' stroke-width='0.5'/%3E` +
  `%3C/svg%3E") center/56px 32px repeat`;

const ISO_LARGE =
  `url("data:image/svg+xml,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='168' height='96'%3E` +
  `%3Cpolygon points='84,0,168,48,84,96,0,48' fill='none' stroke='%23C9A227' stroke-width='0.6' stroke-opacity='.028'/%3E` +
  `%3C/svg%3E") center/168px 96px repeat`;

// ── Small style helper — perfectly centres an absolutely-positioned
//    square layer of a given size, regardless of its parent's size ──────
function centered(size: number): CSSProperties {
  return {
    position : "absolute", left: "50%", top: "50%",
    width    : size, height: size,
    transform: "translate(-50%, -50%)",
  };
}

// ─────────────────────────────────────────────────────────────────────
// EclipseCore — the centrepiece:
//   • a base aurora glow that ignites once from behind the bezel
//   • a breathing multicolour bloom layered on top (grows & fades)
//   • a static, polished-gold "solar eclipse" bezel ring (never spins)
//   • a bright corona-edge highlight catching the aurora's light
//   • a glassmorphism logo disc
// ─────────────────────────────────────────────────────────────────────
function EclipseCore({ logoPath, reduced }: { logoPath: string; reduced: boolean }) {
  const OUTER = 232;              // bezel outer diameter
  const BAND  = 15;                // bezel ring band width
  const R_IN  = OUTER / 2 - BAND;  // bezel inner radius
  const AURA  = 306;               // breathing aurora diameter (bleeds past the bezel)
  const DISC  = 184;               // glassmorphism logo disc diameter

  const ringMask =
    `radial-gradient(circle at center,` +
    ` transparent ${R_IN - 1}px,` +
    ` white ${R_IN + 1}px,` +
    ` white ${OUTER / 2}px,` +
    ` transparent ${OUTER / 2 + 1}px)`;

  return (
    <motion.div
      style={{ position: "relative", width: OUTER, height: OUTER }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 210, damping: 19, delay: 0.2 }}
    >
      {/* base ignited aurora — the logo "igniting" from behind, once */}
      <motion.div
        style={{
          ...centered(AURA), borderRadius: "50%",
          background: `conic-gradient(from -45deg, ${PC.red}, ${PC.gold} 25%, ${PC.green} 50%, ${PC.blue} 75%, ${PC.red} 100%)`,
          filter: "blur(46px) saturate(1.35)",
          willChange: "opacity, transform",
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: reduced ? 0.65 : 0.72, scale: 1 }}
        transition={{ duration: 1.3, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* breathing bloom — rhythmic grow/fade layered on the base glow */}
      {!reduced && (
        <motion.div
          style={{
            ...centered(AURA), borderRadius: "50%",
            background: `conic-gradient(from 45deg, ${PC.gold}, ${PC.red} 25%, ${PC.blue} 50%, ${PC.green} 75%, ${PC.gold} 100%)`,
            filter: "blur(50px) saturate(1.3)",
            willChange: "opacity, transform",
          }}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.55, 0], scale: [1, 1.16, 1] }}
          transition={{ duration: 4.8, delay: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* weight shadow beneath the metal ring */}
      <div style={{ ...centered(OUTER), borderRadius: "50%", boxShadow: "0 16px 36px rgba(0,0,0,0.65)" }} />

      {/* polished gold "solar eclipse" bezel ring — static, never rotates */}
      <div
        style={{
          ...centered(OUTER), borderRadius: "50%",
          background: `conic-gradient(from -90deg, ${GOLD.deep} 0%, ${GOLD.gilt} 22%, ${GOLD.base} 45%, ${GOLD.gilt} 68%, ${GOLD.deep} 88%, ${GOLD.base} 100%)`,
          WebkitMask: ringMask,
          mask: ringMask,
          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -3px 7px rgba(0,0,0,0.5)",
        }}
      />

      {/* bright corona-edge highlight, catching the aurora's glow */}
      <motion.div
        style={{
          ...centered(R_IN * 2 + 3), borderRadius: "50%",
          border: `1.5px solid ${GOLD.gilt}`,
          boxShadow: `0 0 10px ${GOLD.gilt}, 0 0 3px rgba(255,255,255,0.5)`,
          pointerEvents: "none",
        }}
        animate={reduced ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
      />

      {/* glassmorphism logo disc */}
      <div
        style={{
          ...centered(DISC), zIndex: 2, borderRadius: "50%",
          background: "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(4,18,60,0.68) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255,255,255,0.22)",
          boxShadow: [
            "0 10px 40px rgba(0,0,0,0.7)",
            "inset 0 1.5px 0 rgba(255,255,255,0.30)",
            "inset 0 -6px 22px rgba(0,0,30,0.45)",
          ].join(", "),
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}
      >
        {/* top-gloss arc */}
        <div
          style={{
            position: "absolute", top: 0, left: "12%", right: "12%", height: "42%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 100%)",
            borderRadius: "50%", pointerEvents: "none",
          }}
        />
        <img
          src={logoPath}
          alt="Ludo DZ"
          style={{
            width: "68%", height: "68%", objectFit: "contain",
            position: "relative", zIndex: 0,
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.75))",
          }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CornerPawn — a frosted-glass medallion holding one corner piece, lit
// by a bright neon glow in its own colour. Static position — luminous,
// not moving.
// ─────────────────────────────────────────────────────────────────────
interface CornerDef { color: string; pos: CSSProperties; delay: number; }

const CORNERS: CornerDef[] = [
  { color: PC.red,   pos: { top:    "5%", left:  "6%" }, delay: 0.55 },
  { color: PC.green, pos: { top:    "5%", right: "6%" }, delay: 0.70 },
  { color: PC.blue,  pos: { bottom: "9%", left:  "6%" }, delay: 0.85 },
  { color: PC.gold,  pos: { bottom: "9%", right: "6%" }, delay: 1.00 },
];

function CornerPawn({ color, pos, delay, reduced }: CornerDef & { reduced: boolean }) {
  return (
    <motion.div
      style={{ position: "absolute", ...pos, width: 66, height: 66 }}
      initial={{ opacity: 0, scale: 0.25 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 230, damping: 17 }}
    >
      {/* frosted glass roundel */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(13px)",
          WebkitBackdropFilter: "blur(13px)",
          border: "1px solid rgba(255,255,255,0.28)",
          boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -4px 10px rgba(0,0,0,0.30)",
        }}
      />
      {/* neon glow matching the piece colour — static position, breathing luminance */}
      <motion.div
        style={{
          position: "absolute", inset: -7, borderRadius: "50%",
          boxShadow: `0 0 18px 2px ${color}, 0 0 32px 6px ${color}88`,
          pointerEvents: "none",
        }}
        animate={reduced ? {} : { opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay }}
      />
      <div
        style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
        }}
      >
        <GamePiece color={color} className="w-8 h-11" />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WaveLoadingDots — 4 dots that pulse, float vertically in a travelling
// wave, and sequence through the game's colours as they go.
// ─────────────────────────────────────────────────────────────────────
function WaveLoadingDots({ reduced }: { reduced: boolean }) {
  const SEQUENCE = [PC.red, PC.green, PC.blue, PC.gold, PC.red];
  return (
    <motion.div
      style={{ display: "flex", gap: 14, alignItems: "center" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.15, duration: 0.5 }}
    >
      {[0, 1, 2, 3].map(i => (
        <motion.div
          key={i}
          style={{ width: 11, height: 11, borderRadius: "50%", willChange: "transform" }}
          animate={
            reduced
              ? { backgroundColor: PC.gold, boxShadow: `0 0 10px ${PC.gold}` }
              : {
                  y: [0, -9, 0],
                  scale: [1, 1.4, 1],
                  backgroundColor: SEQUENCE,
                  boxShadow: SEQUENCE.map(c => `0 0 16px ${c}, 0 0 5px ${c}`),
                }
          }
          transition={
            reduced
              ? {}
              : {
                  y:               { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.17 },
                  scale:           { duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.17 },
                  backgroundColor: { duration: 3.2, repeat: Infinity, ease: "linear",     delay: i * 0.8  },
                  boxShadow:       { duration: 3.2, repeat: Infinity, ease: "linear",     delay: i * 0.8  },
                }
          }
        />
      ))}
    </motion.div>
  );
}

// Title: "LUDO DZ" — last two chars in gold gradient
const TITLE: { ch: string; gold: boolean }[] = [
  { ch: "L", gold: false }, { ch: "U", gold: false },
  { ch: "D", gold: false }, { ch: "O", gold: false },
  { ch: "\u00A0", gold: false },                   // non-breaking space
  { ch: "D", gold: true  }, { ch: "Z", gold: true  },
];

// ─────────────────────────────────────────────────────────────────────
// SplashScreen — main export
// ─────────────────────────────────────────────────────────────────────
interface SplashScreenProps { lang: "fr" | "ar"; }

export function SplashScreen({ lang }: SplashScreenProps) {
  const logoPath   = import.meta.env.BASE_URL + "ludo-logo.png";
  const reduced    = useReducedMotion() ?? false;
  const subtitle   = lang === "fr" ? "Le Ludo Algérien"      : "لودو جزائري";
  const loadingTxt = lang === "fr" ? "Chargement en cours"   : "جارٍ التحميل";

  return (
    <motion.div
      style={{
        position: "absolute", inset: 0, zIndex: 50, overflow: "hidden",
        // Isometric Ludo-square lattice (two scales) over a deep,
        // deepened blue → emerald → near-black night gradient.
        background: `${ISO_LARGE}, ${ISO_FINE},
          radial-gradient(
            ellipse 130% 100% at 50% 36%,
            #123957 0%, #0a2d49 18%, #073234 36%,
            #052c22 56%, #02170f 78%, #000504 100%
          )`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >

      {/* ── Corner pawns — frosted glass, static, luminous ──────────── */}
      {CORNERS.map((c, i) => (
        <CornerPawn key={i} {...c} reduced={reduced} />
      ))}

      {/* ── Centred content column ───────────────────────────────────── */}
      <div
        style={{
          position: "relative", zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 16,
        }}
      >

        {/* ① Eclipse bezel: static gold ring + breathing colour aurora */}
        <EclipseCore logoPath={logoPath} reduced={reduced} />

        {/* ② "LUDO DZ" — per-letter spring stagger, gold letters shimmer */}
        <motion.div
          style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden : {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.65 } },
          }}
        >
          {!reduced && (
            <style>{`
              @keyframes ludoSplashGoldShimmer {
                0%   { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
              }
            `}</style>
          )}
          {TITLE.map(({ ch, gold }, i) => (
            <motion.span
              key={i}
              style={{
                fontFamily   : "'Rajdhani', 'Cairo', sans-serif",
                fontWeight   : 700,
                fontSize     : ch === "\u00A0" ? 20 : 72,
                display      : "inline-block",
                color        : gold ? "transparent" : "white",
                background   : gold
                  ? "linear-gradient(170deg, #FFF8DC 0%, #FFE55C 22%, #FFBC00 55%, #FF9500 82%, #C9861A 100%)"
                  : undefined,
                backgroundSize      : gold ? "220% 100%" : undefined,
                WebkitBackgroundClip: gold ? "text" : undefined,
                backgroundClip      : gold ? "text" : undefined,
                textShadow   : gold
                  ? undefined
                  : "0 0 40px rgba(255,255,255,0.28), 2px 5px 0px rgba(0,0,0,0.55)",
                letterSpacing: "0.14em",
                filter       : gold
                  ? "drop-shadow(0 3px 16px rgba(255,180,40,0.95)) drop-shadow(0 0 22px rgba(255,220,120,0.5))"
                  : undefined,
                animationName          : gold && !reduced ? "ludoSplashGoldShimmer" : undefined,
                animationDuration      : gold && !reduced ? "3.2s" : undefined,
                animationIterationCount: gold && !reduced ? "infinite" : undefined,
                animationTimingFunction: gold && !reduced ? "ease-in-out" : undefined,
                willChange   : "transform, opacity",
              } as CSSProperties}
              variants={
                reduced
                  ? { hidden: {}, visible: {} }
                  : {
                      hidden : { opacity: 0, y: 38, scale: 0.6 },
                      visible: {
                        opacity: 1, y: 0, scale: 1,
                        transition: { type: "spring", stiffness: 350, damping: 16 },
                      },
                    }
              }
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>

        {/* ③ Tagline */}
        <motion.p
          style={{
            fontFamily   : "'Cairo', 'Rajdhani', sans-serif",
            fontSize     : 11,
            fontWeight   : 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color        : "rgba(255,244,214,0.46)",
            margin       : "-4px 0 2px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.55 }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {subtitle}
        </motion.p>

        {/* ④ Loading dots — pulse, float in a wave, sequence through colours */}
        <WaveLoadingDots reduced={reduced} />

        {/* ⑤ Loading label */}
        <motion.p
          style={{
            fontFamily   : "'Cairo', 'Rajdhani', sans-serif",
            fontSize     : 10,
            fontWeight   : 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color        : "rgba(255,238,190,0.28)",
            margin       : "-4px 0 0",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.5 }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {loadingTxt}
        </motion.p>

      </div>
    </motion.div>
  );
}
