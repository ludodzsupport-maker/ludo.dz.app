import { memo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GamePiece } from "./GamePiece";
import { Info, Settings, Trophy, X } from "lucide-react";
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

const LEADERBOARD_NEON = "#FFD700";
const LEADERBOARD_CARD_BG = "linear-gradient(145deg,#1a1200 0%,#352400 100%)";

const LEADERBOARD_COMING_SOON_COPY = {
  fr: {
    wip: "En développement",
    title: "Bientôt disponible",
    description:
      "Le classement réunira bientôt les meilleurs joueurs de Ludo DZ. Gagnez des parties, gravissez les rangs et visez la première place !",
    close: "Compris",
    closeLabel: "Fermer",
  },
  ar: {
    wip: "قيد التطوير",
    title: "قريباً",
    description:
      "سيجمع التصنيف قريباً أفضل لاعبي Ludo DZ. اربح المباريات، وتقدّم في المراتب، ونافس على المركز الأول!",
    close: "حسناً",
    closeLabel: "إغلاق",
  },
} as const;

// Podium accents for the top 3. Ranks 4–5 stay neutral/plain.
const PODIUM: Record<number, { ring: string; glow: string; row: string; avatar: string }> = {
  1: {
    ring:   "rgba(255,215,0,0.55)",
    glow:   "rgba(255,215,0,0.35)",
    row:    "rgba(255,215,0,0.20)",
    avatar: "rgba(255,215,0,0.34)",
  },
  2: {
    ring:   "rgba(200,206,214,0.50)",
    glow:   "rgba(200,206,214,0.30)",
    row:    "rgba(200,206,214,0.14)",
    avatar: "rgba(200,206,214,0.30)",
  },
  3: {
    ring:   "rgba(205,127,50,0.55)",
    glow:   "rgba(205,127,50,0.32)",
    row:    "rgba(205,127,50,0.16)",
    avatar: "rgba(205,127,50,0.32)",
  },
};

// A deliberately indistinct ranking silhouette: it reads as a feature taking
// shape behind frosted glass, rather than as a second panel competing for focus.
// Positions reveal one at a time, 5th down to 1st, each with a soft scale "pop".
function LeaderboardPreview({ reduceMotion }: { reduceMotion: boolean }) {
  // index 0 = 5th place (revealed first) … index 4 = 1st place (revealed last).
  const rows = [
    { rank: 5, label: "05", bar: "40%", sub: "20%" },
    { rank: 4, label: "04", bar: "50%", sub: "26%" },
    { rank: 3, label: "03", bar: "58%", sub: "32%" },
    { rank: 2, label: "02", bar: "66%", sub: "38%" },
    { rank: 1, label: "01", bar: "76%", sub: "42%" },
  ];

  // Total loop length. Each row waits its turn, pops in, holds, then the whole
  // board fades and resets — a slow, foggy countdown, not a sharp finished UI.
  const CYCLE = 7.5; // seconds
  const STEP  = 0.9; // seconds between successive ranks appearing

  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-x-4 top-[112px] h-[220px] pointer-events-none overflow-hidden"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={
        reduceMotion
          ? { opacity: 0.17, y: 0 }
          : { opacity: [0.14, 0.22, 0.14], y: [4, -2, 4] }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 6.5, repeat: Infinity, ease: "easeInOut" }
      }
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 24%, black 70%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 24%, black 70%, transparent 100%)",
      }}
    >
      <div
        className="absolute inset-x-3 top-3 space-y-1.5 rounded-2xl p-2.5"
        dir="ltr"
        style={{
          background: "linear-gradient(145deg, rgba(255,215,0,0.16), rgba(255,255,255,0.035))",
          border: "1px solid rgba(255,215,0,0.28)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 14px 32px rgba(0,0,0,0.30)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          filter: "blur(0.45px)",
          transform: "rotate(-3deg)",
        }}
      >
        {rows.map((row, index) => {
          const podium = PODIUM[row.rank];
          const start  = index * STEP;
          const end    = CYCLE;
          const popIn  = start + 0.28;
          const settle = start + 0.62;

          return (
            <motion.div
              key={row.rank}
              className="flex h-[30px] items-center gap-2 rounded-md px-2"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
              animate={
                reduceMotion
                  ? { opacity: 1, scale: 1 }
                  : {
                      opacity: [0, 0, 1, 1, 1, 0],
                      scale:   [0.86, 0.86, 1.06, 1, 1, 0.92],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: CYCLE,
                      repeat: Infinity,
                      ease: "easeOut",
                      times: [
                        0,
                        start / CYCLE,
                        popIn / CYCLE,
                        settle / CYCLE,
                        (end - 0.4) / CYCLE,
                        1,
                      ],
                    }
              }
              style={{
                transformOrigin: "center center",
                background: podium ? podium.row : "rgba(255,255,255,0.08)",
                border: `1px solid ${
                  podium ? podium.ring : "rgba(255,255,255,0.10)"
                }`,
                boxShadow: podium
                  ? `0 0 10px ${podium.glow}, inset 0 0 8px ${podium.glow}`
                  : "none",
              }}
            >
              <span
                className="w-4 font-heading text-[9px] font-bold"
                style={{
                  color: podium ? podium.ring : "rgba(255,215,0,0.80)",
                }}
              >
                {row.label}
              </span>
              <div
                className="h-4 w-4 flex-shrink-0 rounded-full"
                style={{
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.50), ${
                    podium ? podium.avatar : "rgba(255,215,0,0.34)"
                  } 42%, rgba(255,215,0,0.08) 75%)`,
                  border: `1px solid ${
                    podium ? podium.ring : "rgba(255,215,0,0.28)"
                  }`,
                }}
              />
              <div className="flex-1 space-y-1">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: row.bar, background: "rgba(255,255,255,0.24)" }}
                />
                <div
                  className="h-1 rounded-full"
                  style={{ width: row.sub, background: "rgba(255,215,0,0.16)" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Soft veil keeps the glimpse atmospheric and protects text contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(26,18,0,0.22) 72%, rgba(26,18,0,0.55) 100%)",
          backdropFilter: "blur(0.75px)",
          WebkitBackdropFilter: "blur(0.75px)",
        }}
      />
    </motion.div>
  );
}

// ─── Leaderboard Coming Soon Popup ────────────────────────────────────────────
function LeaderboardComingSoonPopup({
  lang,
  onClose,
}: {
  lang: "fr" | "ar";
  onClose: () => void;
}) {
  const copy = LEADERBOARD_COMING_SOON_COPY[lang];
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center px-5"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onClick={() => { playIconTap(); onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-coming-soon-title"
      aria-describedby="leaderboard-coming-soon-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)" }}
      />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-xs overflow-hidden rounded-3xl"
        initial={reduceMotion ? false : { scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { scale: 0.88, y: 28, opacity: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 26 }
        }
        onClick={event => event.stopPropagation()}
        style={{
          background: LEADERBOARD_CARD_BG,
          boxShadow: `0 24px 64px rgba(0,0,0,0.72), 0 0 0 1px ${LEADERBOARD_NEON}40`,
        }}
      >
        {/* Top accent stripe */}
        <div
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, transparent, ${LEADERBOARD_NEON}, transparent)` }}
        />

        {/* Corner glow */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-48 w-48 rounded-full"
          style={{ background: `radial-gradient(circle at top left, ${LEADERBOARD_NEON}16, transparent 65%)` }}
        />

        <LeaderboardPreview reduceMotion={reduceMotion} />

        {/* Close button */}
        <button
          onClick={() => { playIconTap(); onClose(); }}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}
          aria-label={copy.closeLabel}
        >
          <X className="h-4 w-4 text-white/50" />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 pb-7 pt-8">
          {/* Themed icon */}
          <motion.div
            className="relative z-10 flex h-[84px] w-[84px] items-center justify-center rounded-2xl"
            style={{
              background: `radial-gradient(circle, ${LEADERBOARD_NEON}18, transparent 75%)`,
              border: `1px solid ${LEADERBOARD_NEON}30`,
            }}
            animate={
              reduceMotion
                ? { boxShadow: `0 0 22px ${LEADERBOARD_NEON}35` }
                : {
                    boxShadow: [
                      `0 0 22px ${LEADERBOARD_NEON}35`,
                      `0 0 44px ${LEADERBOARD_NEON}58`,
                      `0 0 22px ${LEADERBOARD_NEON}35`,
                    ],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <Trophy
              className="h-[48px] w-[48px]"
              strokeWidth={1.7}
              style={{
                color: LEADERBOARD_NEON,
                filter: `drop-shadow(0 0 8px ${LEADERBOARD_NEON}90)`,
              }}
            />

            {/* Corner "En développement" badge — matches the mode-select WIP cards */}
            <div
              className="pointer-events-none absolute right-1.5 top-1.5 z-20 rounded-full px-1.5 py-0.5 font-heading font-semibold"
              style={{
                fontSize: "8px",
                letterSpacing: "0.04em",
                background: "rgba(0,0,0,0.38)",
                border: "1px solid rgba(255,255,255,0.13)",
                color: "rgba(255,255,255,0.42)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              {copy.wip}
            </div>
          </motion.div>

          {/* WIP pill */}
          <div
            className="rounded-full px-3 py-1 font-heading font-bold uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.18em",
              background: `${LEADERBOARD_NEON}18`,
              color: LEADERBOARD_NEON,
              border: `1px solid ${LEADERBOARD_NEON}38`,
            }}
          >
            {copy.wip}
          </div>

          {/* Title */}
          <h2
            id="leaderboard-coming-soon-title"
            className="text-center font-heading font-bold leading-none text-white"
            style={{
              fontSize: "clamp(22px, 6vw, 26px)",
              letterSpacing: "0.08em",
              textShadow: `0 0 24px ${LEADERBOARD_NEON}55`,
            }}
          >
            {copy.title}
          </h2>

          {/* Neon rule / progress dot */}
          <div className="flex w-40 items-center gap-2">
            <div
              className="h-px flex-1"
              style={{ background: `linear-gradient(90deg, transparent, ${LEADERBOARD_NEON}60)` }}
            />
            <motion.div
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ background: LEADERBOARD_NEON }}
              animate={
                reduceMotion
                  ? { boxShadow: `0 0 5px ${LEADERBOARD_NEON}` }
                  : {
                      boxShadow: [
                        `0 0 5px ${LEADERBOARD_NEON}`,
                        `0 0 12px ${LEADERBOARD_NEON}`,
                        `0 0 5px ${LEADERBOARD_NEON}`,
                      ],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.8, repeat: Infinity }
              }
            />
            <div
              className="h-px flex-1"
              style={{ background: `linear-gradient(270deg, transparent, ${LEADERBOARD_NEON}60)` }}
            />
          </div>

          {/* Subtitle */}
          <p
            id="leaderboard-coming-soon-description"
            className="text-center font-sans leading-relaxed text-white/55"
            style={{ fontSize: "12px" }}
          >
            {copy.description}
          </p>

          {/* Dismiss button */}
          <motion.button
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            onClick={() => { playIconTap(); onClose(); }}
            className="mt-1 w-full rounded-xl py-3 font-heading font-bold"
            style={{
              background: `linear-gradient(135deg, ${LEADERBOARD_NEON}28, ${LEADERBOARD_NEON}14)`,
              border: `1px solid ${LEADERBOARD_NEON}44`,
              color: LEADERBOARD_NEON,
              letterSpacing: "0.10em",
              fontSize: "13px",
              boxShadow: `0 0 18px ${LEADERBOARD_NEON}20`,
            }}
          >
            {copy.close}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function WelcomeScreen({ lang, onPlay, onSettings, onAbout }: WelcomeScreenProps) {
  const logoPath        = import.meta.env.BASE_URL + "ludo-logo.png";
  const pawnCharPath    = import.meta.env.BASE_URL + "pawn-character.png";
  const pawnCharWebp    = import.meta.env.BASE_URL + "pawn-character.webp";
  const pawnHerPath     = import.meta.env.BASE_URL + "pawn-character-female.png";
  const pawnHerWebp     = import.meta.env.BASE_URL + "pawn-character-female.webp";
  const dir             = lang === "ar" ? "rtl" : "ltr";
  const [showLeaderboardComingSoon, setShowLeaderboardComingSoon] = useState(false);

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
      neon:    LEADERBOARD_NEON,
      cardBg:  LEADERBOARD_CARD_BG,
      onClick: () => { playIconTap(); setShowLeaderboardComingSoon(true); },
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

            {/* ── RIGHT: Algerian champion pawn — feminine companion with victory trophy ── */}
            <motion.div
              className="flex-shrink-0"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
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
                transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
              >
                <picture className="w-full h-full flex items-center justify-center">
                  <source srcSet={pawnHerWebp} type="image/webp" />
                  <img
                    src={pawnHerPath}
                    alt="Pionne Algérienne"
                    className="w-full h-full object-contain select-none pointer-events-none"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                </picture>
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

      {/* ── Coming Soon Popup (Leaderboard) ── */}
      <AnimatePresence>
        {showLeaderboardComingSoon && (
          <LeaderboardComingSoonPopup
            key="leaderboard-coming-soon"
            lang={lang}
            onClose={() => setShowLeaderboardComingSoon(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
