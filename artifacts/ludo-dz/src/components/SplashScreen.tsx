/**
 * SplashScreen — "Destiny Die"
 *
 * Design concept: a cinematic, jewel-black stage for a single hero
 * object — a tumbling 3D die, cast from dark glass and gold, lit from
 * within by a slow-shifting glow in the four signature player colours.
 * It tumbles in with weight and drama, lands with a burst of light,
 * then settles into a slow, continuous showcase spin — alive for the
 * whole load, never static. Four minimal glowing corner brackets frame
 * the stage (Red·TL, Blue·TR, Gold·BR, Green·BL), and a soft field of
 * drifting light motes gives the space depth. Loading is shown as a
 * shimmering light sweeping through a glass track — no dots, no rings.
 *
 * Content, hierarchy, the four player colours, and all title/subtitle
 * copy are unchanged — only the presentation layer is new.
 */

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import type { CSSProperties } from "react";

// ── Brand palette ──────────────────────────────────────────────────────
const PC = {
  red  : "#DC143C",
  green: "#00A651",
  blue : "#1E90FF",
  gold : "#FFD700",
} as const;

// ── Die geometry ────────────────────────────────────────────────────────
const CUBE = 124;              // cube edge length
const HALF = CUBE / 2;
const GLOW = CUBE + 150;       // inner core-glow / stage diameter

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
// Die faces — classic pip layouts on a 3×3 grid, opposite faces sum to 7
// ─────────────────────────────────────────────────────────────────────
const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

const FACES: Array<{ n: number; transform: string }> = [
  { n: 1, transform: `translateZ(${HALF}px)` },                 // front
  { n: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` }, // back
  { n: 2, transform: `rotateY(90deg) translateZ(${HALF}px)` },  // right
  { n: 5, transform: `rotateY(-90deg) translateZ(${HALF}px)` }, // left
  { n: 3, transform: `rotateX(90deg) translateZ(${HALF}px)` },  // top
  { n: 4, transform: `rotateX(-90deg) translateZ(${HALF}px)` }, // bottom
];

function DieFace({ n, transform }: { n: number; transform: string }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, transform, backfaceVisibility: "hidden",
        borderRadius: 20,
        background: "linear-gradient(155deg, rgba(74,60,106,0.95) 0%, rgba(30,22,46,0.97) 55%, rgba(9,6,15,0.98) 100%)",
        border: "1.5px solid rgba(255,213,128,0.38)",
        boxShadow: "inset 0 2px 5px rgba(255,255,255,0.22), inset 0 -9px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)",
        padding: 18,
      }}
    >
      {Array.from({ length: 9 }).map((_, idx) => {
        const col = idx % 3, row = Math.floor(idx / 3);
        const active = PIP_LAYOUTS[n].some(([c, r]) => c === col && r === row);
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {active && (
              <div
                style={{
                  width: 13, height: 13, borderRadius: "50%",
                  background: "radial-gradient(circle at 32% 28%, #FFF6D8 0%, #FFD700 52%, #B8860B 100%)",
                  boxShadow: "0 0 8px 1px rgba(255,215,0,0.85), inset 0 1px 1px rgba(255,255,255,0.6)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TumblingDie — dramatic multi-axis tumble on mount, lands, then spins
// slowly forever on the vertical axis like a showcase display piece.
// ─────────────────────────────────────────────────────────────────────
function TumblingDie({ reduced }: { reduced: boolean }) {
  const controls = useAnimationControls();

  useEffect(() => {
    if (reduced) { controls.set({ rotateX: -20, rotateY: 32 }); return; }
    let alive = true;
    (async () => {
      await controls.start({
        rotateX: [-60, 250, 490, -20 + 720],
        rotateY: [-40, 320, 640, 32 + 1080],
        transition: { duration: 1.7, ease: [0.22, 1, 0.36, 1] },
      });
      if (!alive) return;
      controls.start({
        rotateY: [32 + 1080, 32 + 1080 + 360],
        transition: { duration: 11, ease: "linear", repeat: Infinity },
      });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div style={{ width: CUBE, height: CUBE, position: "relative", perspective: 900 }}>
      <motion.div
        style={{ width: CUBE, height: CUBE, position: "relative", transformStyle: "preserve-3d", willChange: "transform" }}
        initial={{ rotateX: -60, rotateY: -40 }}
        animate={controls}
      >
        {FACES.map(f => <DieFace key={f.n} n={f.n} transform={f.transform} />)}
      </motion.div>
    </div>
  );
}

// A living light source behind the die — slow colour-cycling rotation
// plus a gentle breathing pulse, blurred into a soft glow.
function CoreGlow({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      style={{
        ...centered(GLOW), borderRadius: "50%",
        background: `conic-gradient(from 0deg, ${PC.red}, ${PC.gold} 25%, ${PC.blue} 50%, ${PC.green} 75%, ${PC.red} 100%)`,
        filter: "blur(52px) saturate(1.4)", willChange: "transform, opacity",
      }}
      initial={{ opacity: 0 }}
      animate={reduced ? { opacity: 0.4 } : { opacity: [0.32, 0.56, 0.32], rotate: [0, 360] }}
      transition={
        reduced
          ? { duration: 1 }
          : {
              opacity: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
              rotate  : { duration: 22, repeat: Infinity, ease: "linear" },
            }
      }
    />
  );
}

// One-shot shockwave rings + a soft flash, fired the instant the die lands.
function ImpactBurst({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <>
      <motion.div
        style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 50%, rgba(255,244,214,0.4), transparent 58%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.5, delay: 1.62, ease: "easeOut" }}
      />
      {[0, 0.12].map((extra, i) => (
        <motion.div
          key={i}
          style={{ ...centered(CUBE), borderRadius: "50%", border: "2px solid rgba(255,222,140,0.85)", pointerEvents: "none" }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.5, 2.2] }}
          transition={{ duration: 0.9, delay: 1.65 + extra, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

function DiceHero({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      style={{ position: "relative", width: GLOW, height: GLOW, display: "flex", alignItems: "center", justifyContent: "center" }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <CoreGlow reduced={reduced} />
      <ImpactBurst reduced={reduced} />
      <TumblingDie reduced={reduced} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CornerBracket — a minimal glowing viewfinder-style corner, one per
// player colour, framing the stage. Red·TL, Blue·TR, Gold·BR, Green·BL.
// ─────────────────────────────────────────────────────────────────────
type Corner = "tl" | "tr" | "br" | "bl";

const BRACKET_POS: Record<Corner, CSSProperties> = {
  tl: { top: 26, left: 26, borderTopLeftRadius: 12 },
  tr: { top: 26, right: 26, borderTopRightRadius: 12 },
  br: { bottom: 30, right: 26, borderBottomRightRadius: 12 },
  bl: { bottom: 30, left: 26, borderBottomLeftRadius: 12 },
};

const BRACKET_BORDER: Record<Corner, (c: string) => CSSProperties> = {
  tl: c => ({ borderTop: `3px solid ${c}`, borderLeft: `3px solid ${c}` }),
  tr: c => ({ borderTop: `3px solid ${c}`, borderRight: `3px solid ${c}` }),
  br: c => ({ borderBottom: `3px solid ${c}`, borderRight: `3px solid ${c}` }),
  bl: c => ({ borderBottom: `3px solid ${c}`, borderLeft: `3px solid ${c}` }),
};

const CORNER_DEFS: { corner: Corner; color: string; delay: number }[] = [
  { corner: "tl", color: PC.red,  delay: 0.50 },
  { corner: "tr", color: PC.blue, delay: 0.62 },
  { corner: "br", color: PC.gold, delay: 0.74 },
  { corner: "bl", color: PC.green, delay: 0.86 },
];

function CornerBracket({ corner, color, delay, reduced }: { corner: Corner; color: string; delay: number; reduced: boolean }) {
  return (
    <motion.div
      style={{ position: "absolute", width: 34, height: 34, ...BRACKET_POS[corner] }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
    >
      <motion.div
        style={{ position: "absolute", inset: 0, ...BRACKET_BORDER[corner](color), filter: `drop-shadow(0 0 6px ${color})` }}
        animate={reduced ? { opacity: 0.75 } : { opacity: [0.45, 0.9, 0.45] }}
        transition={reduced ? {} : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BokehField — a faint scatter of drifting light motes for depth.
// ─────────────────────────────────────────────────────────────────────
const BOKEH: { x: string; y: string; size: number; dur: number; delay: number; opacity: number }[] = [
  { x: "12%", y: "78%", size: 5, dur: 9,    delay: 0,   opacity: 0.5  },
  { x: "85%", y: "70%", size: 4, dur: 11,   delay: 1.5, opacity: 0.4  },
  { x: "22%", y: "18%", size: 3, dur: 8,    delay: 0.6, opacity: 0.35 },
  { x: "78%", y: "22%", size: 6, dur: 12,   delay: 2.2, opacity: 0.45 },
  { x: "50%", y: "88%", size: 4, dur: 10,   delay: 0.9, opacity: 0.4  },
  { x: "8%",  y: "45%", size: 3, dur: 9.5,  delay: 1.8, opacity: 0.3  },
  { x: "92%", y: "48%", size: 4, dur: 10.5, delay: 0.3, opacity: 0.35 },
];

function BokehField({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <>
      {BOKEH.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute", left: b.x, top: b.y, width: b.size, height: b.size, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,238,200,0.9), transparent 70%)",
            filter: "blur(1px)", pointerEvents: "none",
          }}
          animate={{ y: [0, -26, 0], opacity: [0, b.opacity, 0] }}
          transition={{ duration: b.dur, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LightSweepBar — an indeterminate loading indicator: a glass track
// with a multicolour band of light sweeping back and forth.
// ─────────────────────────────────────────────────────────────────────
function LightSweepBar({ reduced }: { reduced: boolean }) {
  return (
    <div
      style={{
        width: 172, height: 5, borderRadius: 99,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
        overflow: "hidden", position: "relative",
      }}
    >
      <motion.div
        style={{
          position: "absolute", top: 0, bottom: 0, width: "36%", borderRadius: 99,
          background: `linear-gradient(90deg, transparent, ${PC.red}, ${PC.gold}, ${PC.blue}, ${PC.green}, transparent)`,
        }}
        animate={reduced ? { left: "32%" } : { left: ["-36%", "100%"] }}
        transition={reduced ? {} : { duration: 1.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
    </div>
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
  const reduced    = useReducedMotion() ?? false;
  const subtitle   = lang === "fr" ? "Le Ludo Algérien"    : "لودو جزائري";
  const loadingTxt = lang === "fr" ? "Chargement en cours" : "جارٍ التحميل";

  return (
    <motion.div
      style={{
        position: "absolute", inset: 0, zIndex: 50, overflow: "hidden",
        background: `radial-gradient(
          ellipse 130% 90% at 50% 32%,
          #201333 0%, #170d26 26%, #0d0817 50%, #060410 74%, #020103 100%
        )`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
      // TEMP DEBUG - remove after diagnosis: confirms whether this root
      // fade-in ever completes on-device (or never fires at all, which
      // would point at Framer Motion never resolving the animation rather
      // than a pure CSS layout collapse).
      onAnimationComplete={() =>
        (window as any).__diagLog?.('SplashScreen fade-in animation complete')
      }
    >
      {/* ── Ambient depth ─────────────────────────────────────────────── */}
      <BokehField reduced={reduced} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 150px 50px rgba(0,0,0,0.65)", pointerEvents: "none" }} />

      {/* ── Corner brackets — Red·TL Blue·TR Gold·BR Green·BL ─────────── */}
      {CORNER_DEFS.map(c => (
        <CornerBracket key={c.corner} {...c} reduced={reduced} />
      ))}

      {/* ── Centred content column ───────────────────────────────────── */}
      <div
        style={{
          position: "relative", zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 20,
        }}
      >

        {/* ① Hero: tumbling, glowing 3D die */}
        <DiceHero reduced={reduced} />

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
                color        : gold ? "transparent" : "#F3EEFF",
                background   : gold
                  ? "linear-gradient(170deg, #FFF8DC 0%, #FFE55C 22%, #FFBC00 55%, #FF9500 82%, #C9861A 100%)"
                  : undefined,
                backgroundSize      : gold ? "220% 100%" : undefined,
                WebkitBackgroundClip: gold ? "text" : undefined,
                backgroundClip      : gold ? "text" : undefined,
                textShadow   : gold
                  ? undefined
                  : "0 0 34px rgba(168,130,255,0.40), 0 5px 14px rgba(0,0,0,0.65)",
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
            color        : "rgba(230,222,255,0.50)",
            margin       : "-4px 0 2px",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.55 }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {subtitle}
        </motion.p>

        {/* ④ Loading indicator — a shimmer of light sweeping a glass track */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.5 }}
        >
          <LightSweepBar reduced={reduced} />
        </motion.div>

        {/* ⑤ Loading label */}
        <motion.p
          style={{
            fontFamily   : "'Cairo', 'Rajdhani', sans-serif",
            fontSize     : 10,
            fontWeight   : 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color        : "rgba(230,222,255,0.30)",
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
