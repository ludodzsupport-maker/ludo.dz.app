import { motion, useReducedMotion } from "framer-motion";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];
const GOLD = "#FFD700";

export function StartupWelcomeScreen() {
  const reduced = useReducedMotion();

  return (
    <motion.section
      className="absolute inset-0 z-30 grid min-h-[100dvh] place-items-center overflow-hidden bg-[#03040b] text-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.18 : 0.46, ease: EASE_OUT }}
      aria-label="LUDO DZ"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(255,215,0,0.18), transparent 24%), radial-gradient(circle at 22% 24%, rgba(220,20,60,0.16), transparent 32%), radial-gradient(circle at 78% 30%, rgba(30,144,255,0.17), transparent 34%), radial-gradient(circle at 52% 86%, rgba(0,166,81,0.20), transparent 36%), linear-gradient(180deg, #03040b 0%, #070913 52%, #020306 100%)",
        }}
      />

      <motion.div
        className="absolute h-[min(74vw,320px)] w-[min(74vw,320px)] rounded-full border border-[#ffd700]/15"
        initial={{ opacity: 0, scale: 0.64, rotate: -18 }}
        animate={
          reduced
            ? { opacity: 0.36, scale: 0.92, rotate: 0 }
            : { opacity: [0, 0.42, 0.3], scale: [0.64, 1, 1.06], rotate: [-18, 4, 10] }
        }
        transition={{ duration: reduced ? 0.2 : 1.1, ease: EASE_OUT }}
      />

      <motion.div
        className="absolute h-[min(54vw,232px)] w-[min(54vw,232px)] rounded-full"
        style={{
          background:
            "conic-gradient(from 18deg, rgba(220,20,60,0.0), rgba(220,20,60,0.42), rgba(255,215,0,0.52), rgba(30,144,255,0.42), rgba(0,166,81,0.45), rgba(220,20,60,0.0))",
          filter: "blur(26px) saturate(1.28)",
        }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={reduced ? { opacity: 0.38, scale: 0.92 } : { opacity: [0, 0.48, 0.34], scale: [0.7, 1, 1.08], rotate: [0, 22] }}
        transition={{ duration: reduced ? 0.2 : 1.25, ease: "easeOut" }}
      />

      <div className="relative z-10 grid place-items-center px-8 text-center">
        <motion.div
          className="mb-5 h-px w-[min(64vw,260px)] bg-gradient-to-r from-transparent via-[#ffd700]/70 to-transparent"
          initial={{ opacity: 0, scaleX: 0.18 }}
          animate={{ opacity: reduced ? 0.48 : [0, 0.9, 0.52], scaleX: reduced ? 0.9 : [0.18, 1, 0.92] }}
          transition={{ duration: reduced ? 0.16 : 0.72, ease: EASE_OUT }}
        />

        <motion.p
          className="font-heading text-[10px] font-bold uppercase tracking-[0.46em] text-[#ffd700]/78"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.44, delay: reduced ? 0 : 0.18, ease: "easeOut" }}
        >
          Bienvenue
        </motion.p>

        <motion.h1
          className="mt-3 font-heading text-[clamp(3.35rem,18vw,5.35rem)] font-black leading-none tracking-[-0.085em] text-white"
          style={{
            textShadow:
              `0 0 14px rgba(255,215,0,0.34), 0 0 42px rgba(255,215,0,0.18), 0 14px 36px rgba(0,0,0,0.82)`,
          }}
          initial={{ opacity: 0, y: 14, scale: 0.92, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: reduced ? 0.14 : 0.58, delay: reduced ? 0 : 0.28, ease: EASE_OUT }}
        >
          LUDO DZ
        </motion.h1>

        <motion.div
          className="mt-5 grid h-1.5 w-32 overflow-hidden rounded-full bg-white/10"
          initial={{ opacity: 0, scaleX: 0.24 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: reduced ? 0.12 : 0.46, delay: reduced ? 0 : 0.48, ease: "easeOut" }}
        >
          <motion.div
            className="h-full w-full rounded-full"
            style={{ background: `linear-gradient(90deg, #DC143C, ${GOLD}, #00A651)` }}
            initial={{ x: "-100%" }}
            animate={{ x: reduced ? "0%" : ["-100%", "0%", "8%"] }}
            transition={{ duration: reduced ? 0.12 : 0.7, delay: reduced ? 0 : 0.58, ease: EASE_OUT }}
          />
        </motion.div>
      </div>
    </motion.section>
  );
}
