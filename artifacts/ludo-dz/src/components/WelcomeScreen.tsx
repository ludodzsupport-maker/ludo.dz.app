import { memo } from "react";
import { motion } from "framer-motion";
import { GamePiece } from "./GamePiece";
import { Settings, Trophy, Info } from "lucide-react";
import { playIconTap, playPrimaryAction } from "../lib/sound-manager";

interface WelcomeScreenProps {
  lang: "fr" | "ar";
  onPlay?: () => void;
  onSettings?: () => void;
  onAbout?: () => void;
}

// ─── Board watermark (identical to Settings / GameMode) ───────────────────────
const BoardWatermark = memo(function BoardWatermark() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="flex flex-1">
          {Array.from({ length: 15 }).map((_, j) => {
            const isCenter = i >= 6 && i <= 8 && j >= 6 && j <= 8;
            const isHome =
              (i < 6 && j < 6) || (i < 6 && j > 8) ||
              (i > 8 && j < 6) || (i > 8 && j > 8);
            let bg = "border border-white/20";
            if (isCenter)  bg = "bg-white/40 border border-white/20";
            else if (isHome) bg = "border-2 border-white/30";
            return <div key={j} className={`flex-1 ${bg}`} />;
          })}
        </div>
      ))}
    </div>
  );
});

// ─── Screen variants — same curve as Settings & GameMode ──────────────────────
const screenVariants = {
  hidden:  { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0, x: -60,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.22 } },
};

const itemVariants = {
  hidden:  { y: 24, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 280, damping: 22 } },
};

// ─── Reusable shimmer strip ───────────────────────────────────────────────────
function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
      }}
      animate={{ backgroundPosition: ["200% 0", "-100% 0"] }}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function WelcomeScreen({ lang, onPlay, onSettings, onAbout }: WelcomeScreenProps) {
  const logoPath     = import.meta.env.BASE_URL + "ludo-logo.png";
  const pawnCharPath = import.meta.env.BASE_URL + "pawn-character.png";
  const pawnCharWebp = import.meta.env.BASE_URL + "pawn-character.webp";
  const dir          = lang === "ar" ? "rtl" : "ltr";

  const t = {
    play:        lang === "fr" ? "Jouer"      : "العب",
    playTag:     lang === "fr" ? "MULTIJOUEUR": "متعدد اللاعبين",
    playDesc:    lang === "fr" ? "Choisissez votre mode de jeu" : "اختر طريقة لعبك",
    settings:    lang === "fr" ? "Paramètres" : "إعدادات",
    leaderboard: lang === "fr" ? "Classement" : "التصنيف",
    about:       lang === "fr" ? "À propos"   : "حول",
    tagline:     lang === "fr" ? "Le Ludo Algérien" : "لعبة الجزائر",
  };

  // Secondary button definitions
  const secondaryBtns = [
    {
      Icon:    Settings,
      label:   t.settings,
      neon:    "#B44FFF",
      cardBg:  "linear-gradient(145deg,#0e0025 0%,#200048 100%)",
      onClick: onSettings ? () => { playIconTap(); onSettings(); } : undefined,
    },
    {
      Icon:    Trophy,
      label:   t.leaderboard,
      neon:    "#FFD700",
      cardBg:  "linear-gradient(145deg,#1a1200 0%,#352400 100%)",
      onClick: undefined as (() => void) | undefined,
    },
    {
      Icon:    Info,
      label:   t.about,
      neon:    "#00A550",
      cardBg:  "linear-gradient(145deg,#001408 0%,#002210 100%)",
      onClick: onAbout ? () => { playIconTap(); onAbout(); } : undefined,
    },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(175deg, #1a1040 0%, #0d2a5e 42%, #003a1c 100%)" }}
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      dir={dir}
    >
      <BoardWatermark />

      {/* ── Floating background pieces (same as GameMode) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-8 -right-8 opacity-20 w-28 h-28 blur-[2px]"
          animate={{ y: [0, 35, 0], rotate: [0, 40, 0], x: [0, -15, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>
        <motion.div
          className="absolute top-1/3 -left-14 opacity-15 w-36 h-36 blur-[3px]"
          animate={{ y: [0, -45, 0], rotate: [0, -25, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        >
          <GamePiece color="#DC143C" />
        </motion.div>
        <motion.div
          className="absolute -bottom-10 right-1/4 opacity-20 w-24 h-24 blur-[2px]"
          animate={{ y: [0, 25, 0], rotate: [0, 60, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        >
          <GamePiece color="#FFD700" />
        </motion.div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-20 flex flex-col items-center justify-start h-full w-full pt-10 pb-6 px-4 overflow-y-auto">

        {/* ══ HERO ══ */}
        <motion.div
          className="flex flex-col items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Floating trio */}
          <motion.div
            className="flex items-end justify-center mb-6"
            style={{ gap: "clamp(8px, 4vw, 18px)" }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* ── LEFT: Proud Algerian pawn mascot — traditional chèche, charismatic wink & flag robe ── */}
            <motion.div
              className="flex-shrink-0"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              style={{ width: "clamp(52px, 14vw, 68px)", height: "clamp(78px, 21vw, 102px)" }}
            >
              <motion.div
                className="w-full h-full relative flex items-center justify-center"
                animate={{
                  filter: [
                    "drop-shadow(0 0 10px rgba(0,165,80,0.38)) drop-shadow(0 6px 14px rgba(0,0,0,0.60))",
                    "drop-shadow(0 0 22px rgba(0,165,80,0.68)) drop-shadow(0 6px 14px rgba(0,0,0,0.60))",
                    "drop-shadow(0 0 10px rgba(0,165,80,0.38)) drop-shadow(0 6px 14px rgba(0,0,0,0.60))",
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              >
                <picture className="w-full h-full flex items-center justify-center">
                  <source srcSet={pawnCharWebp} type="image/webp" />
                  <img
                    src={pawnCharPath}
                    alt="Pion Algérien"
                    className="w-full h-full object-contain select-none pointer-events-none"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                </picture>
              </motion.div>
            </motion.div>

            {/* ── CENTER: Logo card — premium neon-card treatment ── */}
            <motion.div
              className="relative flex-shrink-0 rounded-3xl overflow-hidden"
              style={{
                width:  "clamp(130px, 36vw, 158px)",
                height: "clamp(130px, 36vw, 158px)",
                background:
                  "linear-gradient(145deg, #040d22 0%, #071a45 55%, #042210 100%)",
                border: "1px solid rgba(30,144,255,0.32)",
              }}
              animate={{
                boxShadow: [
                  "0 12px 40px rgba(0,0,0,0.65), 0 0 24px rgba(30,144,255,0.22)",
                  "0 12px 40px rgba(0,0,0,0.65), 0 0 48px rgba(30,144,255,0.46)",
                  "0 12px 40px rgba(0,0,0,0.65), 0 0 24px rgba(30,144,255,0.22)",
                ],
              }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* top accent stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px] z-10"
                style={{ background: "linear-gradient(90deg, transparent, #1E90FF, transparent)" }}
              />
              {/* corner ambient glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(circle at top left, rgba(30,144,255,0.18), transparent 60%)" }}
              />
              {/* shimmer sweep */}
              <Shimmer />
              {/* logo image with neon depth */}
              <div className="absolute inset-0 flex items-center justify-center p-5">
                <motion.div
                  className="w-full h-full"
                  animate={{
                    filter: [
                      "drop-shadow(0 0 10px rgba(30,144,255,0.45)) drop-shadow(0 4px 20px rgba(0,0,0,0.70))",
                      "drop-shadow(0 0 22px rgba(30,144,255,0.70)) drop-shadow(0 4px 20px rgba(0,0,0,0.70))",
                      "drop-shadow(0 0 10px rgba(30,144,255,0.45)) drop-shadow(0 4px 20px rgba(0,0,0,0.70))",
                    ],
                  }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src={logoPath}
                    alt="Ludo DZ"
                    className="w-full h-full object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </motion.div>
              </div>
            </motion.div>

            {/* ── RIGHT: Trophy — neon-gold treatment ── */}
            <motion.div
              className="flex-shrink-0"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
              style={{ width: "clamp(52px, 14vw, 68px)", height: "clamp(68px, 18vw, 90px)" }}
            >
              <motion.div
                style={{ width: "100%", height: "100%" }}
                animate={{
                  filter: [
                    "drop-shadow(0 0 8px rgba(255,215,0,0.38)) drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
                    "drop-shadow(0 0 18px rgba(255,215,0,0.65)) drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
                    "drop-shadow(0 0 8px rgba(255,215,0,0.38)) drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
                  ],
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <svg width="100%" height="100%" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="50" cy="126" rx="28" ry="4" fill="rgba(0,0,0,0.22)"/>
                  <rect x="24" y="110" width="52" height="8"  rx="3" fill="#b07800" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5"/>
                  <rect x="20" y="116" width="60" height="7"  rx="3" fill="#8a5c00" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5"/>
                  <rect x="26" y="111" width="48" height="2.5" rx="1" fill="white" opacity="0.25"/>
                  <rect x="41" y="90"  width="18" height="22" rx="3" fill="#cc8800" stroke="rgba(0,0,0,0.28)" strokeWidth="2"/>
                  <rect x="43" y="91"  width="6"  height="20" rx="2" fill="white" opacity="0.22"/>
                  <path d="M 22 46 Q 2 52 2 67 Q 2 80 22 76"   stroke="rgba(0,0,0,0.28)" strokeWidth="10" strokeLinecap="round" fill="none"/>
                  <path d="M 22 46 Q 4 52 4 67 Q 4 79 22 76"   stroke="#cc8800" strokeWidth="8" strokeLinecap="round" fill="none"/>
                  <path d="M 22 48 Q 8 54 8 67 Q 8 77 22 74"   stroke="white"   strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35"/>
                  <path d="M 78 46 Q 98 52 98 67 Q 98 80 78 76" stroke="rgba(0,0,0,0.28)" strokeWidth="10" strokeLinecap="round" fill="none"/>
                  <path d="M 78 46 Q 96 52 96 67 Q 96 79 78 76" stroke="#cc8800" strokeWidth="8" strokeLinecap="round" fill="none"/>
                  <path d="M 78 48 Q 92 54 92 67 Q 92 77 78 74" stroke="white"   strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35"/>
                  <path d="M 18 18 Q 13 46 16 63 Q 24 90 50 92 Q 76 90 84 63 Q 87 46 82 18 Z" fill="rgba(0,0,0,0.25)" transform="translate(1,2)"/>
                  <path d="M 18 18 Q 13 46 16 63 Q 24 90 50 92 Q 76 90 84 63 Q 87 46 82 18 Z" fill="#FFD700"/>
                  <path d="M 22 20 Q 17 46 20 62 Q 28 86 50 88 Q 72 86 80 62 Q 83 46 78 20 Z" fill="#FFC107" opacity="0.55"/>
                  <path d="M 26 22 Q 23 46 25 60 Q 30 78 44 85" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.30"/>
                  <path d="M 26 22 Q 23 46 25 58"                stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.50"/>
                  <path d="M 18 18 Q 50 10 82 18" stroke="rgba(0,0,0,0.22)" strokeWidth="7" strokeLinecap="round" fill="none"/>
                  <path d="M 18 18 Q 50 10 82 18" stroke="#FFD700"           strokeWidth="5" strokeLinecap="round" fill="none"/>
                  <path d="M 20 17 Q 50  9 80 17" stroke="white"             strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
                  <circle cx="50" cy="56" r="22" fill="rgba(0,0,0,0.28)" transform="translate(1,2)"/>
                  <circle cx="50" cy="56" r="22" fill="#DC143C" stroke="#FFD700" strokeWidth="3"/>
                  <circle cx="50" cy="56" r="19" fill="#DC143C"/>
                  <path d="M 32 45 Q 50 38 68 45" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.32"/>
                  <text x="50" y="64" textAnchor="middle" fontSize="22" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif" letterSpacing="2">VS</text>
                  <text x="36" y="10" textAnchor="middle" fontSize="13" fill="#FFD700" fontFamily="Arial">★</text>
                  <text x="50" y="6"  textAnchor="middle" fontSize="15" fill="#FFD700" fontFamily="Arial">★</text>
                  <text x="64" y="10" textAnchor="middle" fontSize="13" fill="#FFD700" fontFamily="Arial">★</text>
                </svg>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* ── Title block ── */}
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-2">
            <h1
              className="font-heading text-white text-center leading-none"
              style={{
                fontSize:   "clamp(42px, 12vw, 58px)",
                fontWeight: 800,
                letterSpacing: "0.15em",
                textShadow:
                  "0 0 28px rgba(30,144,255,0.55), 0 0 56px rgba(30,144,255,0.22), 0 4px 20px rgba(0,0,0,0.70)",
              }}
            >
              LUDO DZ
            </h1>

            {/* neon rule */}
            <div className="flex items-center gap-2.5 w-44">
              <div
                className="h-px flex-1"
                style={{ background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.65))" }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "#1E90FF" }}
                animate={{ boxShadow: ["0 0 6px #1E90FF", "0 0 14px #1E90FF", "0 0 6px #1E90FF"] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <div
                className="h-px flex-1"
                style={{ background: "linear-gradient(270deg, transparent, rgba(30,144,255,0.65))" }}
              />
            </div>

            {/* tagline */}
            <p
              className="font-heading text-center uppercase"
              style={{
                fontSize:      "10px",
                letterSpacing: "0.30em",
                color:         "rgba(255,255,255,0.40)",
                fontWeight:    600,
              }}
            >
              {t.tagline}
            </p>
          </motion.div>
        </motion.div>

        {/* ══ NAVIGATION ══ */}
        <motion.div
          className="w-full flex flex-col gap-3 mt-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Play — featured-card style ── */}
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.018, y: -3 }}
            whileTap={{ scale: 0.975 }}
            onClick={() => { playPrimaryAction(); onPlay?.(); }}
            className="w-full rounded-2xl overflow-hidden relative cursor-pointer text-start"
            style={{
              background:
                "linear-gradient(145deg, #040d22 0%, #071a45 100%)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(30,144,255,0.38), inset 0 1px 0 rgba(255,255,255,0.07)",
              minHeight: "96px",
            }}
          >
            {/* accent stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: "linear-gradient(90deg, transparent, #1E90FF, transparent)" }}
            />
            {/* corner glow */}
            <div
              className="absolute top-0 left-0 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle at top left, rgba(30,144,255,0.20), transparent 70%)" }}
            />
            <Shimmer />

            <div className="relative z-10 flex items-center gap-5 px-5 py-5">
              {/* icon badge */}
              <motion.div
                className="flex-shrink-0 w-[60px] h-[60px] rounded-xl flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, rgba(30,144,255,0.22) 0%, transparent 75%)",
                  border:     "1px solid rgba(30,144,255,0.32)",
                }}
                animate={{
                  boxShadow: [
                    "0 0 16px rgba(30,144,255,0.35)",
                    "0 0 30px rgba(30,144,255,0.60)",
                    "0 0 16px rgba(30,144,255,0.35)",
                  ],
                }}
                transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
                  <defs>
                    <filter id="play-neon" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <polygon points="8,3 29,16 8,29" fill="#1E90FF" filter="url(#play-neon)"/>
                  <polygon points="8,3 29,16 8,29" fill="white" opacity="0.55"/>
                </svg>
              </motion.div>

              {/* text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <motion.span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "#1E90FF" }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                  />
                  <span
                    className="text-[10px] font-heading font-bold uppercase px-2 py-0.5 rounded-full"
                    style={{
                      background:    "rgba(30,144,255,0.18)",
                      color:         "#1E90FF",
                      border:        "1px solid rgba(30,144,255,0.38)",
                      letterSpacing: "0.14em",
                    }}
                  >
                    {t.playTag}
                  </span>
                </div>
                <h2
                  className="font-heading font-bold text-white leading-none"
                  style={{ fontSize: "clamp(24px, 7vw, 30px)", letterSpacing: "0.08em" }}
                >
                  {t.play}
                </h2>
                <p className="text-white/50 font-sans mt-1" style={{ fontSize: "11px" }}>
                  {t.playDesc}
                </p>
              </div>

              {/* chevron */}
              <div
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(30,144,255,0.16)",
                  border:     "1px solid rgba(30,144,255,0.38)",
                }}
              >
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                  <path d="M 4 2 L 8 6 L 4 10" stroke="#1E90FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </motion.button>

          {/* ── Secondary grid (Settings · Leaderboard · About) ── */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {secondaryBtns.map((btn, idx) => (
              <motion.button
                key={idx}
                variants={itemVariants}
                whileHover={{ scale: 1.04, y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={btn.onClick}
                className="rounded-2xl overflow-hidden relative cursor-pointer flex flex-col items-center justify-center py-4 px-2 gap-2.5"
                style={{
                  background: btn.cardBg,
                  boxShadow:  `0 6px 20px rgba(0,0,0,0.50), 0 0 0 1px ${btn.neon}35, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  minHeight:  "90px",
                }}
              >
                {/* accent stripe */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${btn.neon}, transparent)` }}
                />
                {/* corner glow */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(circle at top left, ${btn.neon}18, transparent 65%)` }}
                />
                {/* icon badge */}
                <motion.div
                  className="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${btn.neon}22, transparent 75%)`,
                    border:     `1px solid ${btn.neon}30`,
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 10px ${btn.neon}30`,
                      `0 0 20px ${btn.neon}55`,
                      `0 0 10px ${btn.neon}30`,
                    ],
                  }}
                  transition={{ duration: 2.4 + idx * 0.3, repeat: Infinity, ease: "easeInOut", delay: idx * 0.4 }}
                >
                  <btn.Icon className="w-5 h-5" style={{ color: btn.neon }} />
                </motion.div>
                <span
                  className="relative z-10 font-heading font-bold uppercase text-center leading-tight"
                  style={{
                    fontSize:      "10px",
                    color:         "rgba(255,255,255,0.82)",
                    letterSpacing: "0.10em",
                  }}
                >
                  {btn.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* version stamp */}
        <motion.p
          className="absolute bottom-2 font-heading text-white/25"
          style={{ fontSize: "10px", letterSpacing: "0.18em" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          v1.0.0
        </motion.p>
      </div>
    </motion.div>
  );
}
