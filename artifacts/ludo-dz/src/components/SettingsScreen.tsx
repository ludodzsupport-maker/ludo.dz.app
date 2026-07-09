import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Globe, Volume2, Vibrate, Info, ChevronRight, Check, Layers } from "lucide-react";
import { GamePiece } from "./GamePiece";

interface SettingsScreenProps {
  lang: 'fr' | 'ar';
  setLang: (lang: 'fr' | 'ar') => void;
  onBack: () => void;
}

// ─── Translations ──────────────────────────────────────────────────────────────
const T = {
  fr: {
    title:       "Paramètres",
    subtitle:    "Personnalisez votre expérience",
    back:        "Retour",

    sectionDisplay: "Affichage & Langue",
    language:    "Langue",
    langFr:      "Français",
    langAr:      "العربية",
    langSub:     "Choisissez la langue de l'interface",

    sectionAudio: "Audio & Retour",
    sound:       "Effets Sonores",
    soundSub:    "Sons du dé, des pions et des victoires",
    music:       "Musique de Fond",
    musicSub:    "Ambiance sonore pendant le jeu",
    vibration:   "Vibrations",
    vibrationSub:"Retour haptique lors des actions",

    sectionBoard:    "Apparence du plateau",
    boardStyle:      "Style du plateau",
    boardStyleSub:   "Choisissez l'apparence visuelle du plateau",
    neonBoard:       "Neon Board",

    sectionAbout: "À propos",
    about:       "Ludo DZ",
    aboutSub:    "Version 1.0.0 — Jeu de société algérien",

    on:  "ON",
    off: "OFF",
  },
  ar: {
    title:       "الإعدادات",
    subtitle:    "خصّص تجربتك في اللعب",
    back:        "رجوع",

    sectionDisplay: "العرض واللغة",
    language:    "اللغة",
    langFr:      "Français",
    langAr:      "العربية",
    langSub:     "اختر لغة واجهة اللعبة",

    sectionAudio: "الصوت والتغذية الراجعة",
    sound:       "مؤثرات صوتية",
    soundSub:    "أصوات النرد والقطع والانتصارات",
    music:       "موسيقى الخلفية",
    musicSub:    "الأجواء الصوتية أثناء اللعب",
    vibration:   "الاهتزاز",
    vibrationSub:"اهتزاز الجهاز عند كل حركة",

    sectionBoard:    "مظهر اللوحة",
    boardStyle:      "نمط اللوحة",
    boardStyleSub:   "اختر المظهر البصري للوحة",
    neonBoard:       "نيون بورد",

    sectionAbout: "حول اللعبة",
    about:       "لودو DZ",
    aboutSub:    "الإصدار 1.0.0 — لعبة الجزائر",

    on:  "تشغيل",
    off: "إيقاف",
  },
} as const;

// ─── Board watermark ───────────────────────────────────────────────────────────
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
            return <div key={j} className={`flex-1 ${bg}`}/>;
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function NeonToggle({ value, onChange, neon }: { value: boolean; onChange: (v: boolean) => void; neon: string }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 w-14 h-7 rounded-full overflow-hidden"
      style={{
        background: value ? `${neon}30` : "rgba(255,255,255,0.08)",
        border: `1px solid ${value ? neon : "rgba(255,255,255,0.15)"}`,
        boxShadow: value ? `0 0 12px ${neon}50` : "none",
        transition: "all 0.3s ease",
      }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.div
        className="absolute top-0.5 w-6 h-6 rounded-full"
        animate={{ left: value ? "calc(100% - 26px)" : "2px" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{
          background: value ? neon : "rgba(255,255,255,0.30)",
          boxShadow: value ? `0 0 8px ${neon}` : "none",
        }}
      />
    </motion.button>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 mt-5 mb-2">
      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }}/>
      <span className="text-[10px] font-heading font-bold uppercase text-white/40" style={{ letterSpacing: "0.20em" }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "linear-gradient(270deg, rgba(255,255,255,0.15), transparent)" }}/>
    </div>
  );
}

// ─── Screen variants ───────────────────────────────────────────────────────────
const screenVariants = {
  hidden:  { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
  exit:    { opacity: 0, x: -60, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

const itemVariants = {
  hidden:  { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 280, damping: 22 } },
};

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
export function SettingsScreen({ lang, setLang, onBack }: SettingsScreenProps) {
  const t   = T[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [sound,      setSound]      = useState(true);
  const [music,      setMusic]      = useState(true);
  const [vibration,  setVibration]  = useState(true);
  const [langOpen,   setLangOpen]   = useState(false);
  const [boardOpen,  setBoardOpen]  = useState(false);
  const [boardStyle, setBoardStyle] = useState<"neon">("neon");

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

      {/* ── Floating background pawns (same layer as Welcome / Game Mode) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-right — blue pawn, drifts down-left */}
        <motion.div
          className="absolute -top-10 -right-10 opacity-[0.14] w-28 h-28 blur-[3px]"
          animate={{ y: [0, 38, 0], x: [0, -18, 0], rotate: [0, 35, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>

        {/* Top-left — red pawn, drifts down-right */}
        <motion.div
          className="absolute -top-6 -left-12 opacity-[0.12] w-32 h-32 blur-[4px]"
          animate={{ y: [0, 45, 0], x: [0, 22, 0], rotate: [0, -28, 0] }}
          transition={{ duration: 21, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        >
          <GamePiece color="#DC143C" />
        </motion.div>

        {/* Mid-right — green pawn, floats vertically */}
        <motion.div
          className="absolute top-[42%] -right-14 opacity-[0.13] w-24 h-24 blur-[3px]"
          animate={{ y: [0, -40, 0], x: [0, -12, 0], rotate: [0, 50, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <GamePiece color="#00A550" />
        </motion.div>

        {/* Bottom-left — gold pawn, rises gently */}
        <motion.div
          className="absolute -bottom-8 -left-8 opacity-[0.15] w-26 h-26 blur-[3px]"
          animate={{ y: [0, -32, 0], x: [0, 18, 0], rotate: [0, -45, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        >
          <GamePiece color="#FFD700" />
        </motion.div>
      </div>

      {/* ── Header ── */}
      <motion.div
        className="relative z-20 flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.05 }}
      >
        <motion.button
          onClick={onBack}
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
          <ArrowLeft
            className="w-5 h-5 text-white"
            style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}
          />
        </motion.button>

        <div className="flex-1 min-w-0">
          <h1
            className="font-heading font-bold text-white leading-none"
            style={{ fontSize: "clamp(20px, 5.5vw, 24px)", letterSpacing: "0.08em" }}
          >
            {t.title}
          </h1>
          <p className="text-white/50 font-sans mt-0.5" style={{ fontSize: "11px" }}>
            {t.subtitle}
          </p>
        </div>

        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
          <span className="text-[8px] font-heading font-bold text-white/80" style={{ letterSpacing: "0.05em" }}>DZ</span>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="relative z-20 mx-5 h-px flex-shrink-0"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}/>

      {/* ── Scrollable content ── */}
      <div className="relative z-20 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
        <motion.div
          className="flex flex-col gap-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Language Section ── */}
          <SectionLabel label={t.sectionDisplay} />

          {/* Language picker card */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0c0a30 0%, #0a1a40 100%)",
              border: "1px solid rgba(100, 180, 255, 0.25)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Top accent */}
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg, transparent, #1E90FF, transparent)" }}/>

            {/* Header row */}
            <motion.button
              className="w-full flex items-center gap-4 px-4 py-4 text-start"
              onClick={() => setLangOpen(o => !o)}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(30,144,255,0.15)", boxShadow: "0 0 16px rgba(30,144,255,0.30)" }}
              >
                <Globe className="w-5 h-5" style={{ color: "#1E90FF" }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-white" style={{ fontSize: "15px", letterSpacing: "0.05em" }}>{t.language}</p>
                <p className="text-white/45 font-sans" style={{ fontSize: "11px" }}>{t.langSub}</p>
              </div>

              {/* Current lang badge */}
              <span
                className="flex-shrink-0 text-[11px] font-heading font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(30,144,255,0.20)", color: "#1E90FF", border: "1px solid rgba(30,144,255,0.35)", letterSpacing: "0.08em" }}
              >
                {lang === 'fr' ? 'FR' : 'AR'}
              </span>

              <motion.div
                animate={{ rotate: langOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0"
              >
                <ChevronRight className="w-4 h-4 text-white/40" />
              </motion.div>
            </motion.button>

            {/* Expanded picker */}
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="px-4 pb-4 flex gap-3">
                    {(["fr", "ar"] as const).map((code) => {
                      const active = lang === code;
                      const label  = code === 'fr' ? t.langFr : t.langAr;
                      return (
                        <motion.button
                          key={code}
                          onClick={() => { setLang(code); setLangOpen(false); }}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl relative overflow-hidden"
                          style={{
                            background: active ? "rgba(30,144,255,0.20)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${active ? "rgba(30,144,255,0.55)" : "rgba(255,255,255,0.10)"}`,
                            boxShadow: active ? "0 0 18px rgba(30,144,255,0.25)" : "none",
                          }}
                        >
                          {active && (
                            <motion.div
                              className="absolute inset-0"
                              layoutId="activeLangBg"
                              style={{ background: "rgba(30,144,255,0.08)" }}
                            />
                          )}
                          <span
                            className="font-heading font-bold relative z-10"
                            style={{
                              fontSize: code === 'ar' ? "16px" : "14px",
                              color: active ? "#1E90FF" : "rgba(255,255,255,0.60)",
                              letterSpacing: code === 'fr' ? "0.08em" : undefined,
                            }}
                          >
                            {label}
                          </span>
                          {active && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                              style={{ background: "#1E90FF" }}>
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Audio Section ── */}
          <SectionLabel label={t.sectionAudio} />

          {/* Sound Effects */}
          <motion.div
            variants={itemVariants}
            className="relative rounded-2xl flex items-center gap-4 px-4 py-4"
            style={{
              background: "linear-gradient(145deg, #0e0420 0%, #160830 100%)",
              border: "1px solid rgba(180,79,255,0.20)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="h-[3px] absolute top-0 left-4 right-4" style={{ background: "linear-gradient(90deg, transparent, #B44FFF55, transparent)" }}/>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(180,79,255,0.15)", boxShadow: "0 0 14px rgba(180,79,255,0.25)" }}
            >
              <Volume2 className="w-5 h-5" style={{ color: "#B44FFF" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{t.sound}</p>
              <p className="text-white/40 font-sans" style={{ fontSize: "10px" }}>{t.soundSub}</p>
            </div>
            <NeonToggle value={sound} onChange={setSound} neon="#B44FFF" />
          </motion.div>

          {/* Music */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl flex items-center gap-4 px-4 py-4"
            style={{
              background: "linear-gradient(145deg, #0e0420 0%, #160830 100%)",
              border: "1px solid rgba(180,79,255,0.20)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(180,79,255,0.15)", boxShadow: "0 0 14px rgba(180,79,255,0.25)" }}
            >
              {/* Music note SVG */}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M9 18V5l12-2v13" stroke="#B44FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6"  cy="18" r="3" stroke="#B44FFF" strokeWidth="2"/>
                <circle cx="18" cy="16" r="3" stroke="#B44FFF" strokeWidth="2"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{t.music}</p>
              <p className="text-white/40 font-sans" style={{ fontSize: "10px" }}>{t.musicSub}</p>
            </div>
            <NeonToggle value={music} onChange={setMusic} neon="#B44FFF" />
          </motion.div>

          {/* Vibration */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl flex items-center gap-4 px-4 py-4"
            style={{
              background: "linear-gradient(145deg, #0e0420 0%, #160830 100%)",
              border: "1px solid rgba(180,79,255,0.20)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(180,79,255,0.15)", boxShadow: "0 0 14px rgba(180,79,255,0.25)" }}
            >
              <Vibrate className="w-5 h-5" style={{ color: "#B44FFF" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{t.vibration}</p>
              <p className="text-white/40 font-sans" style={{ fontSize: "10px" }}>{t.vibrationSub}</p>
            </div>
            <NeonToggle value={vibration} onChange={setVibration} neon="#B44FFF" />
          </motion.div>

          {/* ── Board Style Section ── */}
          <SectionLabel label={t.sectionBoard} />

          <motion.div
            variants={itemVariants}
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #001a1a 0%, #002a28 100%)",
              border: "1px solid rgba(0,255,238,0.22)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Top accent */}
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg, transparent, #00FFEE, transparent)" }}/>

            {/* Header row */}
            <motion.button
              className="w-full flex items-center gap-4 px-4 py-4 text-start"
              onClick={() => setBoardOpen(o => !o)}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,255,238,0.12)", boxShadow: "0 0 16px rgba(0,255,238,0.25)" }}
              >
                <Layers className="w-5 h-5" style={{ color: "#00FFEE" }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-white" style={{ fontSize: "15px", letterSpacing: "0.05em" }}>{t.boardStyle}</p>
                <p className="text-white/45 font-sans" style={{ fontSize: "11px" }}>{t.boardStyleSub}</p>
              </div>

              {/* Current style badge */}
              <span
                className="flex-shrink-0 text-[11px] font-heading font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(0,255,238,0.15)", color: "#00FFEE", border: "1px solid rgba(0,255,238,0.32)", letterSpacing: "0.08em" }}
              >
                {t.neonBoard}
              </span>

              <motion.div
                animate={{ rotate: boardOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0"
              >
                <ChevronRight className="w-4 h-4 text-white/40" />
              </motion.div>
            </motion.button>

            {/* Expanded picker */}
            <AnimatePresence>
              {boardOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="px-4 pb-4">
                    <motion.button
                      onClick={() => { setBoardStyle("neon"); setBoardOpen(false); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl relative overflow-hidden"
                      style={{
                        background: "rgba(0,255,238,0.14)",
                        border: "1px solid rgba(0,255,238,0.45)",
                        boxShadow: "0 0 18px rgba(0,255,238,0.18)",
                      }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        layoutId="activeBoardBg"
                        style={{ background: "rgba(0,255,238,0.06)" }}
                      />
                      <span
                        className="font-heading font-bold relative z-10"
                        style={{ fontSize: "14px", color: "#00FFEE", letterSpacing: "0.08em" }}
                      >
                        {t.neonBoard}
                      </span>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                        style={{ background: "#00FFEE" }}
                      >
                        <Check className="w-3 h-3 text-black" strokeWidth={3} />
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── About Section ── */}
          <SectionLabel label={t.sectionAbout} />

          <motion.div
            variants={itemVariants}
            className="rounded-2xl flex items-center gap-4 px-4 py-4 mb-6"
            style={{
              background: "linear-gradient(145deg, #001408 0%, #002210 100%)",
              border: "1px solid rgba(0,165,80,0.25)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,165,80,0.18)", boxShadow: "0 0 14px rgba(0,165,80,0.28)" }}
            >
              <Info className="w-5 h-5" style={{ color: "#00A550" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{t.about}</p>
              <p className="text-white/40 font-sans" style={{ fontSize: "10px" }}>{t.aboutSub}</p>
            </div>
            {/* Algerian flag mini */}
            <div className="flex-shrink-0 w-8 h-5 rounded overflow-hidden flex" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="flex-1 bg-[#006233]"/>
              <div className="flex-1 bg-white flex items-center justify-center">
                <span style={{ color: "#D21034", fontSize: "8px", lineHeight: 1 }}>☽★</span>
              </div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </motion.div>
  );
}
