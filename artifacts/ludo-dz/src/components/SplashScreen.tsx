/**
 * SplashScreen — "Midnight Royale" redesign
 *
 * Design concept: deep space canvas, Islamic geometric tile pattern,
 * four-colour aurora, spinning conic logo ring with glassmorphism,
 * spring-staggered title lettering, player-dot loading indicator.
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

// ── Islamic diamond-lattice tile (data URI, no spaces → no encoding hell) ──
// Two nested rhombuses create a subtle geometric tessellation.
const TILE =
  `url("data:image/svg+xml,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E` +
  `%3Cpolygon points='24,2,46,24,24,46,2,24' fill='none' stroke='white' stroke-width='1' stroke-opacity='.07'/%3E` +
  `%3Cpolygon points='24,13,35,24,24,35,13,24' fill='none' stroke='white' stroke-width='.7' stroke-opacity='.04'/%3E` +
  `%3C/svg%3E") center/48px 48px repeat`;

// ─────────────────────────────────────────────────────────────────────
// Aurora — four large blurred ambient blobs (one per player colour)
// ─────────────────────────────────────────────────────────────────────
function Aurora() {
  const blobs = [
    { x: "-8%",  y: "-10%", c: "rgba(220,20,60,0.30)",  s: 360, dur: 9  },
    { x: "64%",  y:  "-8%", c: "rgba(0,166,81,0.24)",   s: 310, dur: 11 },
    { x: "-5%",  y:  "58%", c: "rgba(30,144,255,0.20)", s: 390, dur: 13 },
    { x: "60%",  y:  "55%", c: "rgba(255,215,0,0.16)",  s: 250, dur: 8  },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute", left: b.x, top: b.y,
            width: b.s, height: b.s, borderRadius: "50%",
            background: b.c, filter: "blur(80px)",
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0.7, 1, 0.78, 0.7], scale: [1, 1.12, 0.94, 1] }}
          transition={{
            duration: b.dur, repeat: Infinity,
            repeatType: "mirror", delay: i * 0.2, ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sparkle — twinkling 5-point star
// ─────────────────────────────────────────────────────────────────────
function Sparkle({ x, y, delay, size = 5, color = "rgba(255,255,255,0.75)" }: {
  x: number; y: number; delay: number; size?: number; color?: string;
}) {
  return (
    <motion.div
      style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: size, height: size, pointerEvents: "none",
        background: color,
        clipPath:
          "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
      }}
      animate={{ opacity: [0, 1, 0], scale: [0.4, 1.3, 0.4] }}
      transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// SpinningRing — the centrepiece:
//   • rotating 4-colour conic gradient masked to a donut ring
//   • pulsing halo glow
//   • glassmorphism logo disc with sweeping glare
// ─────────────────────────────────────────────────────────────────────
function SpinningRing({ logoPath }: { logoPath: string }) {
  // Container 220 px. Logo disc 190 px. Ring: r 93 → 110.
  const OUTER = 220;
  const INNER = 190;
  const R_IN  = 93;   // inner ring edge (px from centre)
  const R_OUT = 110;  // outer ring edge = OUTER / 2

  const maskGradient =
    `radial-gradient(circle at center,` +
    ` transparent ${R_IN - 1}px,` +
    ` white ${R_IN + 1}px,` +
    ` white ${R_OUT}px,` +
    ` transparent ${R_OUT + 1}px)`;

  return (
    <motion.div
      style={{
        position: "relative", width: OUTER, height: OUTER,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      initial={{ scale: 0.15, opacity: 0, rotate: -30 }}
      animate={{ scale: 1,    opacity: 1, rotate:   0 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.25 }}
    >

      {/* Pulsing ambient halo */}
      <motion.div
        style={{
          position: "absolute", inset: -28, borderRadius: "50%",
          background:
            "radial-gradient(circle," +
            " rgba(255,215,0,0.09) 25%," +
            " rgba(30,80,255,0.08) 55%," +
            " transparent 72%)",
          pointerEvents: "none",
        }}
        animate={{ scale: [1, 1.07, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Rotating 4-colour conic ring (donut-masked) */}
      <motion.div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(
            from 0deg,
            ${PC.red}   0deg,
            ${PC.gold}  90deg,
            ${PC.blue}  180deg,
            ${PC.green} 270deg,
            ${PC.red}   360deg
          )`,
          WebkitMask: maskGradient,
          mask: maskGradient,
          filter: "brightness(1.1) saturate(1.2)",
          willChange: "transform",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />

      {/* Thin inner accent ring (static depth cue) */}
      <div
        style={{
          position: "absolute", inset: 7, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.11)",
          pointerEvents: "none", zIndex: 1,
        }}
      />

      {/* Glassmorphism logo disc */}
      <div
        style={{
          position: "relative", zIndex: 2,
          width: INNER, height: INNER, borderRadius: "50%",
          background:
            "linear-gradient(145deg," +
            " rgba(255,255,255,0.10) 0%," +
            " rgba(4,18,60,0.65) 100%)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: "1.5px solid rgba(255,255,255,0.22)",
          boxShadow: [
            "0 12px 50px rgba(0,0,0,0.72)",
            "inset 0 1.5px 0 rgba(255,255,255,0.30)",
            "inset 0 -6px 24px rgba(0,0,30,0.45)",
          ].join(", "),
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Top-gloss arc */}
        <div
          style={{
            position: "absolute", top: 0, left: "12%", right: "12%", height: "42%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)",
            borderRadius: "50%", pointerEvents: "none",
          }}
        />

        {/* Sweeping lens-flare glare */}
        <motion.div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(115deg," +
              " transparent 28%," +
              " rgba(255,255,255,0.16) 50%," +
              " transparent 72%)",
            pointerEvents: "none", zIndex: 1,
            willChange: "transform",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{
            duration: 1.6, repeat: Infinity, repeatDelay: 5.5,
            ease: "easeInOut",
          }}
        />

        {/* Logo image */}
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
// LoadingDots — 4 player-coloured dots pulsing in wave sequence
// ─────────────────────────────────────────────────────────────────────
function LoadingDots({ reduced }: { reduced: boolean }) {
  const colours = [PC.red, PC.green, PC.blue, PC.gold];
  return (
    <motion.div
      style={{ display: "flex", gap: 14, alignItems: "center" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1,  y: 0  }}
      transition={{ delay: 1.1, duration: 0.5 }}
    >
      {colours.map((colour, i) => (
        <motion.div
          key={i}
          style={{
            width: 11, height: 11, borderRadius: "50%",
            background: colour,
            willChange: "transform, opacity, box-shadow",
          }}
          animate={reduced ? {} : {
            scale    : [1, 1.7, 1],
            opacity  : [0.45, 1, 0.45],
            boxShadow: [
              `0 0 5px ${colour}77`,
              `0 0 20px ${colour}, 0 0 8px ${colour}`,
              `0 0 5px ${colour}77`,
            ],
          }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Static placement data
// ─────────────────────────────────────────────────────────────────────
const SPARKLES = [
  { x:  9, y: 14, delay: 0.0, size: 5, color: PC.gold  },
  { x: 83, y: 10, delay: 0.7, size: 4, color: "rgba(255,255,255,0.85)" },
  { x: 91, y: 70, delay: 1.2, size: 5, color: PC.red   },
  { x:  6, y: 73, delay: 0.4, size: 4, color: PC.blue  },
  { x: 46, y:  5, delay: 0.9, size: 5, color: PC.green },
  { x: 74, y: 88, delay: 1.5, size: 4, color: PC.gold  },
  { x: 18, y: 90, delay: 0.6, size: 4, color: "rgba(255,255,255,0.70)" },
  { x: 57, y: 86, delay: 1.8, size: 3, color: PC.red   },
];

interface CornerDef { color: string; pos: CSSProperties; delay: number; bobDur: number; }
const CORNERS: CornerDef[] = [
  { color: PC.red,   pos: { top:    "4%", left:  "5%" }, delay: 0.70, bobDur: 3.4 },
  { color: PC.green, pos: { top:    "4%", right: "5%" }, delay: 0.90, bobDur: 3.8 },
  { color: PC.blue,  pos: { bottom: "8%", left:  "5%" }, delay: 1.05, bobDur: 3.6 },
  { color: PC.gold,  pos: { bottom: "8%", right: "5%" }, delay: 1.20, bobDur: 4.0 },
];

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
        // Two background layers: tile on top, gradient below
        background: `${TILE},
          radial-gradient(
            ellipse 110% 90% at 50% 56%,
            #0f2d6b 0%, #0a1628 48%, #020a1a 100%
          )`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >

      {/* ── Layer 1: aurora ambient blobs ───────────────────────────── */}
      {!reduced && <Aurora />}

      {/* ── Layer 2: scattered sparkles ─────────────────────────────── */}
      {!reduced && SPARKLES.map((s, i) => <Sparkle key={i} {...s} />)}

      {/* ── Layer 3: corner player pieces ───────────────────────────── */}
      {CORNERS.map((p, i) => (
        <motion.div
          key={i}
          style={{ position: "absolute", ...p.pos }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: 0.82, scale: 1 }}
          transition={{
            delay: p.delay, type: "spring",
            stiffness: 260, damping: 18,
          }}
        >
          <motion.div
            animate={reduced ? {} : { y: [0, -12, 0] }}
            transition={{
              delay: p.delay + 0.7, duration: p.bobDur,
              repeat: Infinity, ease: "easeInOut",
            }}
          >
            {/* GamePiece renders an SVG viewBox 0 0 100 150; w-7 h-10 = 28×40 px */}
            <GamePiece color={p.color} className="w-7 h-10" />
          </motion.div>
        </motion.div>
      ))}

      {/* ── Layer 4: centred content column ─────────────────────────── */}
      <div
        style={{
          position: "relative", zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 16,
        }}
      >

        {/* ① Logo ring */}
        <SpinningRing logoPath={logoPath} />

        {/* ② "LUDO DZ" — per-letter spring stagger */}
        <motion.div
          style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden : {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.65 } },
          }}
        >
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
                  ? "linear-gradient(170deg, #FFE55C 0%, #FFBC00 50%, #FF8C00 100%)"
                  : undefined,
                WebkitBackgroundClip: gold ? "text" : undefined,
                backgroundClip      : gold ? "text" : undefined,
                textShadow   : gold
                  ? undefined
                  : "0 0 40px rgba(255,255,255,0.28), 2px 5px 0px rgba(0,0,0,0.55)",
                letterSpacing: "0.14em",
                filter       : gold
                  ? "drop-shadow(0 3px 14px rgba(255,160,0,0.88))"
                  : undefined,
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
            fontWeight   : 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color        : "rgba(255,255,255,0.42)",
            margin       : "-4px 0 2px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.55 }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {subtitle}
        </motion.p>

        {/* ④ Loading dots (4 player colours) */}
        <LoadingDots reduced={reduced} />

        {/* ⑤ Loading label */}
        <motion.p
          style={{
            fontFamily   : "'Cairo', 'Rajdhani', sans-serif",
            fontSize     : 10,
            fontWeight   : 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color        : "rgba(255,255,255,0.24)",
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
