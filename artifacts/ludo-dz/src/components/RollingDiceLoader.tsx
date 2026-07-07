import { motion, useReducedMotion } from "framer-motion";

// ─── Layout constants ───────────────────────────────────────────────────
const D    = 72;            // die side length (px)
const H    = D / 2;         // 36px — half-side (face offset from centre)
const TURNS = 3;            // quarter-turns per leg
const TRAVEL = TURNS * D;   // 216px total travel
const LEG  = 2.1;           // seconds for one leg (right or left)
const BH   = 13;            // max bounce height (px)
const BD   = LEG / TURNS;   // seconds per bounce  (= per quarter-turn)

// ─── Pip coordinates [x%, y%] on each face ──────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 20], [72, 20], [28, 50], [72, 50], [28, 80], [72, 80]],
};

// ─── Single die face ────────────────────────────────────────────────────
function Face({ n, tx, pc }: { n: number; tx: string; pc: string }) {
  return (
    <div
      style={{
        position : "absolute",
        inset    : 0,
        transform: tx,
        width    : D,
        height   : D,
        borderRadius: 13,
        // Warm ivory gradient — feels expensive in 3-D
        background: "linear-gradient(145deg, #ffffff 0%, #f4f0eb 60%, #ebe5dc 100%)",
        border    : "2.5px solid rgba(255,255,255,0.95)",
        boxShadow : [
          "inset 0 3px 2px rgba(255,255,255,1)",
          "inset 0 -4px 6px rgba(0,0,0,0.10)",
          "0 0 0 1.5px rgba(0,0,0,0.09)",
        ].join(", "),
        overflow: "hidden",
      }}
    >
      {/* ── Top-gloss sheen ── */}
      <div
        style={{
          position    : "absolute",
          top: 0, left: 0, right: 0,
          height      : "44%",
          background  : "linear-gradient(180deg,rgba(255,255,255,0.72) 0%,transparent 100%)",
          borderRadius: "11px 11px 65% 65%",
          pointerEvents: "none",
        }}
      />
      {/* ── Bottom-edge shadow ── */}
      <div
        style={{
          position    : "absolute",
          bottom: 0, left: 0, right: 0,
          height      : "20%",
          background  : "linear-gradient(0deg,rgba(0,0,0,0.06) 0%,transparent 100%)",
          borderRadius: "0 0 11px 11px",
          pointerEvents: "none",
        }}
      />
      {/* ── Pips ── */}
      {(PIPS[n] ?? []).map(([x, y], i) => (
        <div
          key={i}
          style={{
            position    : "absolute",
            left        : `${x}%`,
            top         : `${y}%`,
            width       : D * 0.175,
            height      : D * 0.175,
            marginLeft  : `${-(D * 0.0875)}px`,
            marginTop   : `${-(D * 0.0875)}px`,
            borderRadius: "50%",
            // Radial gradient gives each pip a subtle 3-D bubble look
            background  : `radial-gradient(circle at 35% 28%, ${pc}99, ${pc})`,
            boxShadow   : "0 1px 3px rgba(0,0,0,0.50), inset 0 1px 1px rgba(255,255,255,0.18)",
          }}
        />
      ))}
    </div>
  );
}

// ─── CSS 3-D cube (six faces) ────────────────────────────────────────────
// Face assignment (standard Western dice):
//   Front 1 | Back 6 | Top 5 | Bottom 2 | Right 3 | Left 4
// When the parent rotates rotateX:
//   0°  → face 1  (front)     visible
//   -90° → face 2  (bottom)   visible
//   -180° → face 6 (back)     visible
//   -270° → face 5 (top)      visible
function Cube({ pc }: { pc: string }) {
  return (
    <div style={{ width: D, height: D, position: "relative", transformStyle: "preserve-3d" }}>
      <Face n={1} pc={pc} tx={`translateZ(${H}px)`} />
      <Face n={6} pc={pc} tx={`rotateY(180deg) translateZ(${H}px)`} />
      <Face n={5} pc={pc} tx={`rotateX(90deg) translateZ(${H}px)`} />
      <Face n={2} pc={pc} tx={`rotateX(-90deg) translateZ(${H}px)`} />
      <Face n={3} pc={pc} tx={`rotateY(90deg) translateZ(${H}px)`} />
      <Face n={4} pc={pc} tx={`rotateY(-90deg) translateZ(${H}px)`} />
    </div>
  );
}

// ─── Main exported component ─────────────────────────────────────────────
export function RollingDiceLoader({ lang }: { lang: "fr" | "ar" }) {
  const label        = lang === "fr" ? "Chargement" : "جارٍ التحميل";
  const reducedMotion = useReducedMotion();

  // Shared transition factories — collapsed to instant when reduced-motion is on
  const xTrans = reducedMotion
    ? { duration: 0 }
    : { duration: LEG, repeat: Infinity, repeatType: "mirror" as const, ease: "linear" as const };
  const bTrans = reducedMotion
    ? { duration: 0 }
    : { duration: BD,  repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay: 0.85, duration: 0.55, ease: "easeOut" }}
      className="flex flex-col items-center gap-5 mt-4"
    >
      {/* ══ Track area ══════════════════════════════════════════════════ */}
      <div style={{ width: TRAVEL + D, height: D + BH + 24, position: "relative" }}>

        {/* ── Faint golden ground-glow line ── */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: D * 0.3, right: D * 0.3,
            height: 4, borderRadius: 2,
            background:
              "linear-gradient(90deg,transparent,rgba(255,215,0,0.20) 25%,rgba(255,215,0,0.38) 50%,rgba(255,215,0,0.20) 75%,transparent)",
            filter: "blur(1.5px)",
          }}
        />

        {/* ── Drop-shadow ellipse: follows X + pulses with bounce ── */}
        <motion.div
          style={{
            position    : "absolute",
            bottom      : 3,
            left        : D * 0.08,
            width       : D * 0.84,
            height      : 11,
            borderRadius: "50%",
            background  : "radial-gradient(ellipse,rgba(0,0,0,0.65) 0%,transparent 68%)",
            transformOrigin: "center",
            willChange  : "transform, opacity",
          }}
          animate={{
            x      : [0, TRAVEL],
            scaleX : [1, 0.45, 1],
            opacity: [0.55, 0.14, 0.55],
          }}
          transition={{
            x      : xTrans,
            scaleX : bTrans,
            opacity: bTrans,
          }}
        />

        {/* ── Die: X movement ── */}
        <motion.div
          style={{ position: "absolute", bottom: 10, left: 0, willChange: "transform" }}
          animate={{ x: [0, TRAVEL] }}
          transition={xTrans}
        >
          {/* ── Y bounce (one cycle per quarter-turn edge) ── */}
          <motion.div
            style={{ willChange: "transform" }}
            animate={{ y: [0, -BH, 0] }}
            transition={bTrans}
          >
            {/* ── Perspective wrapper (no filter — would break preserve-3d) ── */}
            <div style={{ perspective: 520, perspectiveOrigin: "50% 50%" }}>
              {/* ── rotateX rolling ── */}
              <motion.div
                style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                animate={{ rotateX: [0, -(TURNS * 90)] }}
                transition={xTrans}
              >
                <Cube pc="#DC143C" />
              </motion.div>
            </div>

            {/* ── Per-die corner glow (lives outside preserve-3d so filter is safe) ── */}
            <motion.div
              style={{
                position     : "absolute",
                inset        : -6,
                borderRadius : 18,
                background   : "transparent",
                pointerEvents: "none",
                filter       : "blur(4px)",
              }}
              animate={{ opacity: [0.0, 0.30, 0.0] }}
              transition={bTrans}
            >
              <div
                style={{
                  position: "absolute", inset: 0, borderRadius: 18,
                  background:
                    "radial-gradient(ellipse at 50% 50%,rgba(255,215,0,0.55) 0%,transparent 70%)",
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* ══ Label + pulsing gold dots ═══════════════════════════════════ */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-white/70 font-sans font-bold text-xs tracking-[0.2em] uppercase select-none"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {label}
        </span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-dz-gold"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.5, 0.6] }}
              transition={{
                duration: 1.2,
                repeat  : Infinity,
                delay   : i * 0.3,
                ease    : "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
