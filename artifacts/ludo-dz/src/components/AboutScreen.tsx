import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Crown, LifeBuoy, Mail, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { GamePiece } from "./GamePiece";
import { playNavBack, playSelection } from "../lib/sound-manager";

interface AboutScreenProps {
  lang: "fr" | "ar";
  onBack: () => void;
}

const T = {
  fr: {
    title: "À propos",
    subtitle: "Ludo algérien, esprit salon de jeu",
    back: "Retour",
    badge: "v1.0.0",
    logoAlt: "Logo LUDO DZ",
    heroKicker: "Édition DZ",
    description:
      "LUDO DZ transforme les parties familiales algériennes en expérience mobile rapide, lumineuse et sociale. Lancez les dés, appliquez vos règles de table locales et jouez pour grimper dans le classement.",
    featuresTitle: "Points forts",
    multiplayer: "Multijoueur",
    multiplayerSub: "Parties locales fluides entre amis et famille.",
    rules: "Règles locales",
    rulesSub: "Modes personnalisés inspirés des habitudes de jeu DZ.",
    rank: "Classement",
    rankSub: "Progression claire pour célébrer les meilleurs joueurs.",
    creditsTitle: "Développeur, crédits et support",
    developer: "Développeur",
    developerValue: "Équipe LUDO DZ",
    support: "Support",
    supportValue: "support@ludo-dz.app",
    credits: "Crédits",
    creditsValue: "Conception, sons et expérience de jeu LUDO DZ",
    close: "Retour au menu",
  },
  ar: {
    title: "حول",
    subtitle: "لودو جزائري بروح جلسات اللعب",
    back: "رجوع",
    badge: "v1.0.0",
    logoAlt: "شعار LUDO DZ",
    heroKicker: "نسخة DZ",
    description:
      "LUDO DZ يحوّل أجواء اللعب العائلية الجزائرية إلى تجربة هاتفية سريعة ومضيئة واجتماعية. ارم النرد، فعّل قواعدكم المحلية، والعب من أجل الصعود في التصنيف.",
    featuresTitle: "أهم الميزات",
    multiplayer: "متعدد اللاعبين",
    multiplayerSub: "مباريات محلية سلسة مع الأصدقاء والعائلة.",
    rules: "قواعد محلية",
    rulesSub: "أنماط مخصصة مستوحاة من طريقة اللعب الجزائرية.",
    rank: "نظام التصنيف",
    rankSub: "تقدّم واضح للاحتفال بأفضل اللاعبين.",
    creditsTitle: "المطور، الشكر والدعم",
    developer: "المطور",
    developerValue: "فريق LUDO DZ",
    support: "الدعم",
    supportValue: "support@ludo-dz.app",
    credits: "الشكر",
    creditsValue: "تصميم وتجربة لعب وأصوات LUDO DZ",
    close: "العودة إلى القائمة",
  },
} as const;

function BoardWatermark() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="flex flex-1">
          {Array.from({ length: 15 }).map((_, j) => {
            const isCenter = i >= 6 && i <= 8 && j >= 6 && j <= 8;
            const isHome = (i < 6 && j < 6) || (i < 6 && j > 8) || (i > 8 && j < 6) || (i > 8 && j > 8);
            let bg = "border border-white/20";
            if (isCenter) bg = "bg-white/40 border border-white/20";
            else if (isHome) bg = "border-2 border-white/30";
            return <div key={j} className={`flex-1 ${bg}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

function AlgerianMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" role="img" aria-hidden="true">
      <defs>
        <mask id="about-crescent-mask">
          <circle cx="24" cy="24" r="11" fill="white" />
          <circle cx="28" cy="24" r="9" fill="black" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="22" fill="#06101e" stroke="#00A550" strokeWidth="1.5" />
      <path d="M24 3a21 21 0 0 0 0 42V3Z" fill="#006233" opacity="0.95" />
      <path d="M24 3a21 21 0 0 1 0 42V3Z" fill="#f7f5ec" opacity="0.95" />
      <circle cx="22" cy="24" r="11" fill="#D21034" mask="url(#about-crescent-mask)" />
      <polygon points="30,17.5 31.7,22 36.4,22.2 32.7,25.1 34,29.7 30,27.1 26,29.7 27.3,25.1 23.6,22.2 28.3,22" fill="#D21034" />
    </svg>
  );
}

const screenVariants = {
  hidden: { opacity: 0, x: 60, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.14 } },
};

const itemVariants = {
  hidden: { y: 18, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 280, damping: 24 } },
};

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 mt-5 mb-3">
      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
      <span className="text-[10px] font-heading font-bold uppercase text-white/40 text-center" style={{ letterSpacing: "0.18em" }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "linear-gradient(270deg, rgba(255,255,255,0.15), transparent)" }} />
    </div>
  );
}

export function AboutScreen({ lang, onBack }: AboutScreenProps) {
  const t = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const shouldReduceMotion = useReducedMotion();
  const logoPath = import.meta.env.BASE_URL + "ludo-logo.png";
  const featureItems = [
    { Icon: Users, title: t.multiplayer, body: t.multiplayerSub, neon: "#1E90FF" },
    { Icon: Shield, title: t.rules, body: t.rulesSub, neon: "#00A550" },
    { Icon: Trophy, title: t.rank, body: t.rankSub, neon: "#FFD700" },
  ];
  const creditItems = [
    { Icon: Crown, label: t.developer, value: t.developerValue, neon: "#FFD700" },
    { Icon: Mail, label: t.support, value: t.supportValue, neon: "#1E90FF" },
    { Icon: LifeBuoy, label: t.credits, value: t.creditsValue, neon: "#00A550" },
  ];

  const driftAnimation = shouldReduceMotion ? {} : { y: [0, -18, 0], rotate: [0, 24, 0] };
  const pulseShadow = shouldReduceMotion
    ? "0 12px 40px rgba(0,0,0,0.60), 0 0 30px rgba(0,165,80,0.22)"
    : undefined;

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

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-10 -right-10 opacity-[0.15] w-32 h-32 blur-[3px]"
          animate={driftAnimation}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>
        <motion.div
          className="absolute top-[42%] -left-14 opacity-[0.12] w-28 h-28 blur-[3px]"
          animate={shouldReduceMotion ? {} : { y: [0, 24, 0], x: [0, 12, 0], rotate: [0, -28, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        >
          <GamePiece color="#00A550" />
        </motion.div>
        <motion.div
          className="absolute -bottom-8 right-5 opacity-[0.14] w-24 h-24 blur-[3px]"
          animate={shouldReduceMotion ? {} : { y: [0, -26, 0], rotate: [0, 36, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        >
          <GamePiece color="#FFD700" />
        </motion.div>
      </div>

      <motion.div
        className="relative z-20 flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.05 }}
      >
        <motion.button
          onClick={() => { playNavBack(); onBack(); }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
          }}
          aria-label={t.back}
        >
          <ArrowLeft className="w-5 h-5 text-white" style={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }} />
        </motion.button>

        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-bold text-white leading-none" style={{ fontSize: "clamp(20px, 5.5vw, 24px)", letterSpacing: "0.08em" }}>
            {t.title}
          </h1>
          <p className="text-white/50 font-sans mt-0.5" style={{ fontSize: "11px" }}>{t.subtitle}</p>
        </div>

        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
          <span className="text-[8px] font-heading font-bold text-white/80" style={{ letterSpacing: "0.05em" }}>DZ</span>
        </div>
      </motion.div>

      <div className="relative z-20 mx-5 h-px flex-shrink-0" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />

      <div className="relative z-20 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <motion.div className="flex flex-col" variants={containerVariants} initial="hidden" animate="visible">
          <motion.section
            variants={itemVariants}
            className="relative rounded-[28px] overflow-hidden px-5 pt-5 pb-6 text-center"
            style={{
              background: "linear-gradient(145deg, #040d22 0%, #071a45 55%, #042210 100%)",
              border: "1px solid rgba(0,165,80,0.34)",
              boxShadow: pulseShadow,
            }}
            animate={shouldReduceMotion ? undefined : {
              boxShadow: [
                "0 12px 40px rgba(0,0,0,0.60), 0 0 24px rgba(0,165,80,0.20)",
                "0 12px 40px rgba(0,0,0,0.60), 0 0 42px rgba(30,144,255,0.30)",
                "0 12px 40px rgba(0,0,0,0.60), 0 0 24px rgba(0,165,80,0.20)",
              ],
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, transparent, #00A550, #1E90FF, transparent)" }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top left, rgba(0,165,80,0.16), transparent 58%)" }} />
            <div className="relative z-10 flex flex-col items-center">
              <span
                className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-heading font-bold uppercase"
                style={{ background: "rgba(0,165,80,0.18)", color: "#88f0b1", border: "1px solid rgba(0,165,80,0.38)", letterSpacing: "0.14em" }}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t.heroKicker}
              </span>

              <div className="relative mb-3 h-[122px] w-[122px] rounded-[26px] border border-white/12 bg-black/20 p-4 shadow-[0_14px_32px_rgba(0,0,0,0.45)]">
                <div className="absolute -inset-3 rounded-[34px] bg-[#00A550]/10 blur-2xl" />
                <img src={logoPath} alt={t.logoAlt} className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_18px_rgba(30,144,255,0.55)]" />
              </div>

              <div className="flex items-center justify-center gap-2">
                <h2 className="font-heading font-black leading-none text-white" style={{ fontSize: "clamp(32px, 10vw, 44px)", letterSpacing: "0.14em", textShadow: "0 0 24px rgba(30,144,255,0.48)" }}>
                  LUDO DZ
                </h2>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-heading font-bold text-[#06101e]" style={{ background: "linear-gradient(135deg, #FFD700, #ffef8c)", letterSpacing: "0.10em" }}>
                  {t.badge}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/72">{t.description}</p>
            </div>
          </motion.section>

          <SectionLabel label={t.featuresTitle} />
          <div className="grid grid-cols-1 gap-3">
            {featureItems.map(({ Icon, title, body, neon }) => (
              <motion.div
                key={title}
                variants={itemVariants}
                className="rounded-2xl px-4 py-4 flex items-center gap-4"
                style={{
                  background: "linear-gradient(145deg, rgba(4,13,34,0.92) 0%, rgba(7,26,69,0.82) 100%)",
                  border: `1px solid ${neon}35`,
                  boxShadow: `0 6px 22px rgba(0,0,0,0.38), 0 0 18px ${neon}12`,
                }}
              >
                <div className="h-11 w-11 rounded-xl flex flex-shrink-0 items-center justify-center" style={{ background: `${neon}20`, boxShadow: `0 0 14px ${neon}25` }}>
                  <Icon className="h-5 w-5" style={{ color: neon }} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <h3 className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-white/48">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <SectionLabel label={t.creditsTitle} />
          <motion.section
            variants={itemVariants}
            className="rounded-[24px] overflow-hidden mb-5"
            style={{
              background: "linear-gradient(145deg, #001408 0%, #002210 100%)",
              border: "1px solid rgba(0,165,80,0.28)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg, transparent, #00A550, transparent)" }} />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.035] border border-white/10 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AlgerianMark />
                  <div className="min-w-0 text-start">
                    <p className="font-heading text-[13px] font-bold text-white" style={{ letterSpacing: "0.05em" }}>LUDO DZ</p>
                    <p className="text-[11px] leading-5 text-white/45">{t.subtitle}</p>
                  </div>
                </div>
              </div>

              {creditItems.map(({ Icon, label, value, neon }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl bg-black/14 border border-white/8 px-3 py-3">
                  <div className="h-9 w-9 rounded-xl flex flex-shrink-0 items-center justify-center" style={{ background: `${neon}18` }}>
                    <Icon className="h-[18px] w-[18px]" style={{ color: neon }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-start">
                    <p className="text-[10px] font-heading font-bold uppercase text-white/34" style={{ letterSpacing: "0.14em" }}>{label}</p>
                    <p className="mt-0.5 break-words text-[12px] leading-5 text-white/72">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.018, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { playSelection(); onBack(); }}
            className="mb-6 w-full rounded-2xl px-5 py-4 font-heading font-bold text-white"
            style={{
              background: "linear-gradient(145deg, #040d22 0%, #071a45 100%)",
              border: "1px solid rgba(30,144,255,0.42)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.48), 0 0 20px rgba(30,144,255,0.18)",
              letterSpacing: "0.10em",
            }}
          >
            {t.close}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
