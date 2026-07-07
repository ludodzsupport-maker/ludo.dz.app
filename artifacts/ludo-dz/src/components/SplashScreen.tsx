import { motion } from "framer-motion";
import { RollingDiceLoader } from "./RollingDiceLoader";

interface SplashScreenProps {
  lang: "fr" | "ar";
}

export function SplashScreen({ lang }: SplashScreenProps) {
  const logoPath = import.meta.env.BASE_URL + "ludo-logo.png";
  const rays = Array.from({ length: 12 });

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1E90FF] via-[#0047AB] to-[#1a0a3d]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* ── Rotating light-ray background ──────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none mix-blend-screen">
        <motion.div
          className="relative w-[800px] h-[800px]"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          {rays.map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 origin-left"
              style={{
                width     : "400px",
                height    : "40px",
                marginTop : "-20px",
                background: "linear-gradient(90deg,rgba(255,255,255,0.8) 0%,rgba(255,255,255,0) 100%)",
                transform : `rotate(${i * 30}deg)`,
                clipPath  : "polygon(0 40%,100% 0,100% 100%,0 60%)",
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* ── Main content column ─────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-8">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.2, y: 50, opacity: 0, rotate: -15 }}
          animate={{ scale: 1,   y: 0,  opacity: 1, rotate: 0   }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="relative drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)]"
        >
          <div className="w-40 h-40 bg-white/10 rounded-3xl p-4 backdrop-blur-sm border-2 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-white/10 opacity-70 z-10" />
            <img
              src={logoPath}
              alt="Ludo DZ Logo"
              className="w-full h-full object-contain relative z-0 drop-shadow-xl"
              onError={e => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement?.classList.add("bg-dz-green", "border-dz-gold");
              }}
            />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.5 }}
          className="mt-6 mb-2 drop-shadow-title"
        >
          <h1 className="text-6xl font-heading text-white tracking-wider text-shadow-glow">
            LUDO <span className="text-dz-gold">DZ</span>
          </h1>
        </motion.div>

        {/* ── Premium rolling-dice loader (replaces progress bar) ─── */}
        <RollingDiceLoader lang={lang} />
      </div>

      {/* ── Decorative ambient floaters ─────────────────────────────── */}
      <motion.div
        className="absolute top-20 left-10 text-dz-gold opacity-50 text-2xl select-none"
        animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >★</motion.div>
      <motion.div
        className="absolute bottom-40 right-10 text-sky-blue opacity-50 text-3xl select-none"
        animate={{ y: [0, 20, 0], rotate: [0, -15, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >☽</motion.div>
    </motion.div>
  );
}
