import { motion, useReducedMotion } from "framer-motion";

interface SplashScreenProps {
  lang: "fr" | "ar";
}

const PARTICLES = [
  { left: "14%", top: "24%", size: 2, delay: 0.02, drift: -18 },
  { left: "72%", top: "18%", size: 3, delay: 0.08, drift: 16 },
  { left: "84%", top: "58%", size: 2, delay: 0.14, drift: -12 },
  { left: "24%", top: "72%", size: 4, delay: 0.1, drift: 20 },
  { left: "48%", top: "14%", size: 2, delay: 0.18, drift: 14 },
  { left: "10%", top: "54%", size: 3, delay: 0.2, drift: -16 },
  { left: "64%", top: "78%", size: 2, delay: 0.04, drift: 18 },
  { left: "38%", top: "86%", size: 3, delay: 0.16, drift: -14 },
];

export function SplashScreen({ lang }: SplashScreenProps) {
  const reduced = useReducedMotion() ?? false;
  const subtitle = lang === "ar" ? "لعبة الجزائر" : "Le Ludo Algérien";

  return (
    <motion.div
      className="absolute inset-0 z-50 overflow-hidden bg-[#02070b]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 1.025, filter: reduced ? "none" : "blur(12px)" }}
      transition={{ duration: reduced ? 0.16 : 0.36, ease: [0.22, 1, 0.36, 1] }}
      aria-label="LUDO DZ"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(0,166,81,0.24),transparent_28%),radial-gradient(circle_at_28%_26%,rgba(30,144,255,0.26),transparent_31%),radial-gradient(circle_at_72%_72%,rgba(255,215,0,0.15),transparent_26%),linear-gradient(155deg,#031722_0%,#03070d_48%,#00180d_100%)]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl"
        style={{ background: "conic-gradient(from 210deg, #1E90FF, #00A651, #FFD700, #00A651, #1E90FF)" }}
        animate={reduced ? { opacity: 0.42 } : { rotate: 38, scale: [0.88, 1.08, 0.96], opacity: [0.28, 0.72, 0.38] }}
        transition={reduced ? { duration: 0.01 } : { duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute inset-x-[-20%] top-1/2 h-px bg-gradient-to-r from-transparent via-[#7fffd4]/80 to-transparent"
        initial={{ opacity: 0, scaleX: 0.2 }}
        animate={{ opacity: reduced ? 0.35 : [0, 0.95, 0.28], scaleX: reduced ? 0.78 : [0.18, 1, 0.82] }}
        transition={{ duration: reduced ? 0.01 : 0.52, ease: "easeOut" }}
      />

      {!reduced && PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-[#d8fff2] shadow-[0_0_14px_rgba(127,255,212,0.95)]"
          style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size }}
          initial={{ opacity: 0, y: 10, scale: 0.4 }}
          animate={{ opacity: [0, 0.9, 0], y: particle.drift, scale: [0.4, 1.4, 0.2] }}
          transition={{ duration: 0.68, delay: particle.delay, ease: "easeOut" }}
        />
      ))}

      <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
        <motion.div
          className="relative grid place-items-center"
          initial={{ opacity: 0, y: 14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0.01 : 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="absolute h-28 w-64 rounded-[50%] border border-[#7fffd4]/25 shadow-[0_0_44px_rgba(0,166,81,0.38),inset_0_0_26px_rgba(30,144,255,0.2)]"
            animate={reduced ? { opacity: 0.45 } : { opacity: [0.18, 0.7, 0.28], scaleX: [0.78, 1.05, 0.96], scaleY: [0.7, 1, 0.82] }}
            transition={{ duration: 0.62, ease: "easeOut" }}
          />
          <h1 className="relative font-heading text-[clamp(3.2rem,17vw,5.4rem)] font-bold leading-none tracking-[0.18em] text-[#f4fff9] [text-shadow:0_0_22px_rgba(127,255,212,0.45),0_8px_30px_rgba(0,0,0,0.8)]">
            LUDO <span className="bg-gradient-to-b from-[#fff7c2] via-[#ffd700] to-[#ad7800] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(255,215,0,0.7)]">DZ</span>
          </h1>
          <motion.p
            className="mt-4 font-heading text-[0.68rem] font-semibold uppercase tracking-[0.52em] text-[#9fffe0]/70"
            dir={lang === "ar" ? "rtl" : "ltr"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.18, duration: 0.24 }}
          >
            {subtitle}
          </motion.p>
        </motion.div>
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),transparent_12%,transparent_82%,rgba(0,0,0,0.4)),radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
    </motion.div>
  );
}
