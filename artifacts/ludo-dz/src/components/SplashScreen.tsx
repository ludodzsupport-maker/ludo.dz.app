/**
 * SplashScreen — "Midnight Royale" redesign (Premium Zellige Edition)
 *
 * Design concept: deep space canvas fading from indigo-blue into deep
 * Algerian emerald, an Islamic geometric tile pattern layered at two
 * scales, a rotating gold zellige "jewel cage" with an astrolabe-style
 * bezel and a crescent-and-star crest surrounding the untouched central
 * logo, four multifaceted gems orbiting in the mid-ground as a
 * sequential-glow loading indicator, cinematic spotlighting with drifting
 * dust/light-trail particles, and corner pawns polished into glowing
 * jewel-toned resin, linked by fine shimmering light lines.
 *
 * Content, hierarchy, the four player colours, and corner positions are
 * unchanged from the original — only the surrounding presentation layer
 * was elevated.
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

// ── Premium gold-metal / deep-emerald accents (matches the DZ board's
//    Algerian identity: rich brass, gilt, deep green) ──────────────────
const GOLD = {
  deep : "#7D5700", // rich brass shadow
  base : "#C9A227", // border gold
  gilt : "#FFE49A", // gilt highlight
};

// ── Islamic diamond-lattice tile (data URI, no spaces → no encoding hell) ──
// Two nested rhombuses create a subtle geometric tessellation.
const TILE =
  `url("data:image/svg+xml,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E` +
  `%3Cpolygon points='24,2,46,24,24,46,2,24' fill='none' stroke='white' stroke-width='1' stroke-opacity='.07'/%3E` +
  `%3Cpolygon points='24,13,35,24,24,35,13,24' fill='none' stroke='white' stroke-width='.7' stroke-opacity='.04'/%3E` +
  `%3C/svg%3E") center/48px 48px repeat`;

// Larger-scale zellige octagon layer — breaks up the fine lattice's
// repetition with a second, gold-tinted geometric scale (real zellige
// tilework is built from several layered scales, never just one).
const TILE_LARGE =
  `url("data:image/svg+xml,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='168' height='168'%3E` +
  `%3Cpolygon points='84,14,134,34,154,84,134,134,84,154,34,134,14,84,34,34' fill='none' stroke='%23C9A227' stroke-width='0.6' stroke-opacity='.05'/%3E` +
  `%3Ccircle cx='84' cy='84' r='34' fill='none' stroke='%23C9A227' stroke-width='0.5' stroke-opacity='.045'/%3E` +
  `%3C/svg%3E") center/168px 168px repeat`;

// ── Small geometry helpers (self-contained — deliberately not shared
//    with the board renderer, so this file has zero coupling to game code) ──
function starPoints(cx: number, cy: number, rOuter: number, rInner: number, spikes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function crescentPath(cx: number, cy: number, r: number): string {
  const inner = r * 0.72;
  const offset = r * 0.42;
  return (
    `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z ` +
    `M ${cx - inner + offset},${cy} a ${inner},${inner} 0 1,0 ${inner * 2},0 a ${inner},${inner} 0 1,0 ${-inner * 2},0 Z`
  );
}

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
// Spotlight — soft cinematic glow focused behind the central logo
// ─────────────────────────────────────────────────────────────────────
function Spotlight() {
  return (
    <div
      style={{
        position: "absolute", width: 560, height: 560,
        left: "50%", top: "32%", transform: "translate(-50%,-50%)",
        background:
          "radial-gradient(circle, rgba(255,230,170,0.14) 0%, rgba(255,190,90,0.06) 42%, transparent 72%)",
        pointerEvents: "none", filter: "blur(2px)",
      }}
    />
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
// LightTrail — a thin drifting streak of light (cinematic particulate)
// ─────────────────────────────────────────────────────────────────────
function LightTrail({ x, y, rotate, delay, length = 90 }: {
  x: number; y: number; rotate: number; delay: number; length?: number;
}) {
  return (
    <motion.div
      style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: length, height: 1.4,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,225,160,0.55) 50%, transparent 100%)",
        transform: `rotate(${rotate}deg)`,
        pointerEvents: "none",
      }}
      animate={{ opacity: [0, 0.85, 0], x: [0, 36] }}
      transition={{ duration: 4.6, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// DustMotes — fine drifting particles for cinematic atmosphere
// ─────────────────────────────────────────────────────────────────────
function DustMotes() {
  const motes = Array.from({ length: 14 }).map((_, i) => ({
    x: (i * 37) % 100,
    y: 16 + ((i * 53) % 74),
    size: 1.3 + (i % 3) * 0.5,
    delay: (i % 7) * 0.6,
    dur: 6 + (i % 4),
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {motes.map((m, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute", left: `${m.x}%`, top: `${m.y}%`,
            width: m.size, height: m.size, borderRadius: "50%",
            background: "rgba(255,238,200,0.85)", filter: "blur(0.4px)",
          }}
          animate={{ opacity: [0, 0.7, 0], y: [0, -50] }}
          transition={{ duration: m.dur, repeat: Infinity, delay: m.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ZelligeCage — rotating gold octagram "jewel cage" with an astrolabe
// tick bezel and a fixed crescent-and-star crest, surrounding the ring.
// ─────────────────────────────────────────────────────────────────────
function ZelligeCage({ reduced }: { reduced: boolean }) {
  const SIZE = 260;
  const C = SIZE / 2;
  const offset = (SIZE - 220) / 2;

  return (
    <div
      style={{
        position: "absolute", width: SIZE, height: SIZE,
        top: -offset, left: -offset, pointerEvents: "none",
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="splash-cage-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={GOLD.deep} />
            <stop offset="25%"  stopColor={GOLD.base} />
            <stop offset="50%"  stopColor={GOLD.gilt} />
            <stop offset="75%"  stopColor={GOLD.base} />
            <stop offset="100%" stopColor={GOLD.deep} />
          </linearGradient>
          <radialGradient id="splash-cage-glow" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor={GOLD.base} stopOpacity="0" />
            <stop offset="100%" stopColor={GOLD.base} stopOpacity="0.16" />
          </radialGradient>
        </defs>

        {/* ambient gold wash, fixed */}
        <circle cx={C} cy={C} r={C} fill="url(#splash-cage-glow)" />

        {/* rotating cage: octagram + astrolabe tick bezel + glint arc */}
        <motion.g
          style={{ transformOrigin: `${C}px ${C}px` }}
          animate={reduced ? {} : { rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        >
          {/* deep-emboss shadow layer, offset for a heavy, pressed-metal look */}
          <polygon
            points={starPoints(C + 1.6, C + 1.6, 118, 92, 8)}
            fill="none" stroke="#2E1F00" strokeOpacity="0.45" strokeWidth="3.5" strokeLinejoin="round"
          />
          {/* main gold octagram cage */}
          <polygon
            points={starPoints(C, C, 118, 92, 8)}
            fill="none" stroke="url(#splash-cage-gold)" strokeWidth="3" strokeLinejoin="round"
          />
          {/* bright bevel rim catching the light */}
          <polygon
            points={starPoints(C - 1, C - 1, 118, 92, 8)}
            fill="none" stroke="#FFF3D2" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round"
          />
          {/* astrolabe-style tick bezel */}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (Math.PI / 12) * i;
            const rO = 82;
            const rI = i % 2 === 0 ? 71 : 76;
            return (
              <line
                key={i}
                x1={C + rO * Math.cos(a)} y1={C + rO * Math.sin(a)}
                x2={C + rI * Math.cos(a)} y2={C + rI * Math.sin(a)}
                stroke={GOLD.base} strokeOpacity="0.55" strokeWidth="1"
              />
            );
          })}
          {/* travelling glint — a short bright arc that sweeps the ring as it
              rotates, reading as light catching the polished metal */}
          <circle
            cx={C} cy={C} r={104} fill="none" stroke="url(#splash-cage-gold)"
            strokeWidth="2.4" strokeDasharray="16 316" strokeLinecap="round" opacity="0.95"
          />
        </motion.g>

        {/* fixed crescent-and-star crest at the top — does not rotate */}
        <g transform={`translate(${C}, 15)`}>
          <path d={crescentPath(0, 0, 6.5)} fill={GOLD.gilt} fillRule="evenodd" opacity="0.95" />
          <polygon points={starPoints(10, -1, 3.6, 1.4, 5)} fill={GOLD.gilt} opacity="0.95" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gem — a single faceted, glowing jewel used by OrbitingGems
// ─────────────────────────────────────────────────────────────────────
function Gem({ color, delay, reduced }: { color: string; delay: number; reduced: boolean }) {
  const gradId = `splash-gem-${color.replace("#", "")}`;
  return (
    <motion.div
      style={{ position: "relative", width: 26, height: 26 }}
      animate={reduced ? {} : { scale: [1, 1.24, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      {/* soft colour bloom behind the gem */}
      <div
        style={{
          position: "absolute", inset: -9, borderRadius: "50%",
          background: color, opacity: 0.38, filter: "blur(9px)",
        }}
      />
      {/* sequential glow ring — doubles the gem as a loading indicator */}
      {!reduced && (
        <motion.div
          style={{
            position: "absolute", inset: -6, borderRadius: "50%",
            border: `1.5px solid ${color}`,
          }}
          animate={{ opacity: [0, 0.75, 0], scale: [0.82, 1.3, 0.82] }}
          transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      )}
      <svg viewBox="0 0 26 26" width={26} height={26} style={{ position: "relative", display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="35%"  stopColor={color} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* emerald-cut kite silhouette */}
        <polygon points="13,1 24,9.5 13,25 2,9.5" fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
        {/* top facet highlight */}
        <polygon points="13,1 19,9.5 13,12 7,9.5" fill="rgba(255,255,255,0.42)" />
        {/* centre crease */}
        <line x1="13" y1="1" x2="13" y2="25" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      </svg>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OrbitingGems — four large jewels revolving in the mid-ground; their
// staggered pulse/glow sequence functions as the loading indicator.
// ─────────────────────────────────────────────────────────────────────
function OrbitingGems({ reduced }: { reduced: boolean }) {
  const SIZE = 320;
  const RADIUS = 148;
  const offset = (SIZE - 220) / 2;
  const gems = [
    { color: PC.red,   angle: -40, delay: 0    },
    { color: PC.blue,  angle:  50, delay: 0.55 },
    { color: PC.green, angle: 140, delay: 1.10 },
    { color: PC.gold,  angle: 230, delay: 1.65 },
  ];

  return (
    <div
      style={{
        position: "absolute", width: SIZE, height: SIZE,
        top: -offset, left: -offset, pointerEvents: "none",
      }}
    >
      {/* refined orbital guide path */}
      <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="splash-orbit-guide" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={GOLD.base} stopOpacity="0" />
            <stop offset="50%"  stopColor={GOLD.gilt} stopOpacity="0.5" />
            <stop offset="100%" stopColor={GOLD.base} stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
          stroke="url(#splash-orbit-guide)" strokeWidth="1" strokeDasharray="2 7" opacity="0.55"
        />
      </svg>

      <motion.div
        style={{ position: "absolute", inset: 0 }}
        animate={reduced ? {} : { rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {gems.map((g, i) => (
          <div
            key={i}
            style={{
              position: "absolute", top: "50%", left: "50%", width: 0, height: 0,
              transform: `rotate(${g.angle}deg)`,
            }}
          >
            <div style={{ position: "absolute", left: RADIUS, top: 0, transform: "translate(-50%,-50%)" }}>
              <Gem color={g.color} delay={g.delay} reduced={reduced} />
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SpinningRing — the centrepiece:
//   • gold zellige cage + orbiting gems surrounding everything (new)
//   • rotating 4-colour conic gradient masked to a donut ring
//   • pulsing halo glow
//   • glassmorphism logo disc with sweeping glare
// ─────────────────────────────────────────────────────────────────────
function SpinningRing({ logoPath, reduced }: { logoPath: string; reduced: boolean }) {
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

      {/* Orbiting jewels — largest radius, sits furthest back */}
      <OrbitingGems reduced={reduced} />

      {/* Gold zellige jewel-cage — surrounds the ring proper */}
      <ZelligeCage reduced={reduced} />

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
// CornerConnectors — fine shimmering gold lines tying the four corner
// pawns together into a single frame, reinforcing the "cage" motif.
// ─────────────────────────────────────────────────────────────────────
function CornerConnectors({ reduced }: { reduced: boolean }) {
  const pts = [
    { x: 9,  y: 10 }, // TL
    { x: 91, y: 10 }, // TR
    { x: 91, y: 88 }, // BR
    { x: 9,  y: 88 }, // BL
  ];
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <linearGradient id="splash-connector-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={GOLD.gilt} stopOpacity="0.5" />
          <stop offset="50%"  stopColor={GOLD.base} stopOpacity="0.2" />
          <stop offset="100%" stopColor={GOLD.gilt} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={`${pts[a].x}%`} y1={`${pts[a].y}%`}
          x2={`${pts[b].x}%`} y2={`${pts[b].y}%`}
          stroke="url(#splash-connector-grad)" strokeWidth="1" strokeDasharray="1 5"
          animate={reduced ? {} : { strokeDashoffset: [0, -60] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
        />
      ))}
    </svg>
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

const LIGHT_TRAILS = [
  { x: 14, y: 30, rotate: -24, delay: 0.3, length: 90 },
  { x: 70, y: 22, rotate:  18, delay: 1.8, length: 70 },
  { x: 24, y: 66, rotate:  32, delay: 3.1, length: 80 },
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
        // Three background layers: fine tile, larger zellige tile, gradient below
        background: `${TILE}, ${TILE_LARGE},
          radial-gradient(
            ellipse 130% 100% at 50% 38%,
            #17415f 0%, #0d3350 20%, #0a3a3c 40%,
            #073226 60%, #04201a 80%, #010a08 100%
          )`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >

      {/* ── Layer 0: cinematic spotlight behind the logo ────────────── */}
      <Spotlight />

      {/* ── Layer 1: aurora ambient blobs ───────────────────────────── */}
      {!reduced && <Aurora />}

      {/* ── Layer 2: scattered sparkles + light trails + dust ───────── */}
      {!reduced && SPARKLES.map((s, i) => <Sparkle key={i} {...s} />)}
      {!reduced && LIGHT_TRAILS.map((t, i) => <LightTrail key={i} {...t} />)}
      {!reduced && <DustMotes />}

      {/* ── Layer 3: fine gold lines framing the four corners ───────── */}
      <CornerConnectors reduced={reduced} />

      {/* ── Layer 4: corner player pieces, polished to jewel resin ──── */}
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
            <div style={{ position: "relative", filter: `saturate(1.3) contrast(1.06) drop-shadow(0 0 9px ${p.color}66)` }}>
              {/* glowing, grounded base */}
              <motion.div
                style={{
                  position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)",
                  width: 30, height: 9, borderRadius: "50%",
                  background: `radial-gradient(ellipse, ${p.color}bb 0%, ${p.color}22 55%, transparent 75%)`,
                  filter: "blur(3px)",
                }}
                animate={reduced ? {} : { opacity: [0.5, 0.95, 0.5] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
              />
              {/* GamePiece renders an SVG viewBox 0 0 100 150; w-7 h-10 = 28×40 px */}
              <GamePiece color={p.color} className="w-7 h-10" />
            </div>
          </motion.div>
        </motion.div>
      ))}

      {/* ── Layer 5: centred content column ─────────────────────────── */}
      <div
        style={{
          position: "relative", zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 16,
        }}
      >

        {/* ① Logo ring, gold cage & orbiting gems */}
        <SpinningRing logoPath={logoPath} reduced={reduced} />

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

        {/* ④ Loading dots (4 player colours) — preserved as simple, static-role indicators */}
        <LoadingDots reduced={reduced} />

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
