import { memo, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Globe, Volume2, Vibrate, Info, ChevronRight, Check } from "lucide-react";
import { GamePiece } from "./GamePiece";
import { LoadingOverlay } from "./LoadingOverlay";

import type { BoardStyle } from '../App';
import * as DZ from '../lib/board-theme-dz';
import {
  isSoundEnabled,
  setSoundEnabled,
  isBgmEnabled,
  setBgmEnabled,
  getBgmVolume,
  setBgmVolume,
  playLanguageChange,
  playNavBack,
  playSelection,
  playToggleClick,
} from '../lib/sound-manager';
import { isHapticsEnabled, setHapticsEnabled } from '../lib/haptics-manager';
import {
  getVoiceLineVolume,
  isVoiceLinesEnabled,
  setVoiceLineVolume,
  setVoiceLinesEnabled,
} from '../lib/voice-line-manager';
interface SettingsScreenProps {
  lang: 'fr' | 'ar';
  setLang: (lang: 'fr' | 'ar') => void;
  boardStyle: BoardStyle;
  setBoardStyle: (style: BoardStyle) => void;
  onBack: () => void;
  onAbout?: () => void;
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
    voice:       "Commentaires Vocaux",
    voiceSub:    "Répliques aléatoires pendant les moments forts",
    voiceVolume: "Volume voix",
    music:       "Musique de Fond",
    musicSub:    "Ambiance sonore pendant le jeu",
    musicVolume: "Volume musique",
    vibration:   "Vibrations",
    vibrationSub:"Retour haptique lors des actions",

    sectionBoard:    "Apparence du plateau",
    boardStyle:      "Style du plateau",
    boardStyleSub:   "Choisissez l'apparence visuelle du plateau",
    neonBoard:       "Neon Board",
    classicBoard:    "Classic Board",
    dzBoard:         "DZ Board",

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
    voice:       "تعليق صوتي",
    voiceSub:    "عبارات عشوائية في اللحظات الحماسية",
    voiceVolume: "مستوى الصوت",
    music:       "موسيقى الخلفية",
    musicSub:    "الأجواء الصوتية أثناء اللعب",
    musicVolume: "مستوى الموسيقى",
    vibration:   "الاهتزاز",
    vibrationSub:"اهتزاز الجهاز عند كل حركة",

    sectionBoard:    "مظهر اللوحة",
    boardStyle:      "نمط اللوحة",
    boardStyleSub:   "اختر المظهر البصري للوحة",
    neonBoard:       "نيون بورد",
    classicBoard:    "بورد كلاسيكي",
    dzBoard:         "لوحة DZ",

    sectionAbout: "حول اللعبة",
    about:       "لودو DZ",
    aboutSub:    "الإصدار 1.0.0 — لعبة الجزائر",

    on:  "تشغيل",
    off: "إيقاف",
  },
} as const;

// ─── Board watermark ───────────────────────────────────────────────────────────
const BoardWatermark = memo(function BoardWatermark() {
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
});

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
export function SettingsScreen({ lang, setLang, boardStyle, setBoardStyle, onBack, onAbout }: SettingsScreenProps) {
  const t   = T[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [sound,      setSound]      = useState(isSoundEnabled());
  const [voice,      setVoice]      = useState(isVoiceLinesEnabled());
  const [voiceVolume, setVoiceVolume] = useState(getVoiceLineVolume());
  const [music,      setMusic]      = useState(isBgmEnabled());
  const [musicVolume, setMusicVolume] = useState(getBgmVolume());
  const [vibration,  setVibration]  = useState(isHapticsEnabled());
  const [langOpen,   setLangOpen]   = useState(false);
  const [boardOpen,  setBoardOpen]  = useState(false);
  const [pendingStyle, setPendingStyle] = useState<BoardStyle | null>(null);

  // Toggle click sounds are gated on the *current* Sound Effects setting
  // (checked before it changes), so flipping Sound Effects off is the last
  // thing you hear, and everything stays silent while it's off.
  const handleSoundToggle = (next: boolean) => {
    playToggleClick(next);
    setSoundEnabled(next);
    setSound(next);
  };
  const handleVoiceToggle = (next: boolean) => {
    playToggleClick(next);
    setVoiceLinesEnabled(next);
    setVoice(next);
  };
  const handleVoiceVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.currentTarget.value);
    const next = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw / 100)) : voiceVolume;
    setVoiceLineVolume(next);
    setVoiceVolume(next);
  };
  // Background Music is fully independent from Sound Effects: its own
  // storage key and playback lifecycle inside the audio manager. Flipping
  // this toggle is itself a user gesture, so it's exactly where BGM playback
  // is allowed to actually start under browser autoplay policy.
  const handleMusicToggle = (next: boolean) => {
    playToggleClick(next);
    setBgmEnabled(next);
    setMusic(next);
  };
  const handleMusicVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.currentTarget.value);
    const next = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw / 100)) : musicVolume;
    setBgmVolume(next);
    setMusicVolume(next);
  };
  // Vibrations is fully independent from Sound Effects / Music: its own
  // storage key and gate inside the haptics manager, same pattern as BGM.
  const handleVibrationToggle = (next: boolean) => {
    playToggleClick(next);
    setHapticsEnabled(next);
    setVibration(next);
  };

  // Brief themed "reskin" flourish over the board-style card: the picker
  // closes immediately, but the actual style swap is held behind the
  // flourish so the badge/thumbnails never visibly snap under the user's eye.
  const handlePickBoardStyle = (style: BoardStyle) => {
    setBoardOpen(false);
    if (style === boardStyle) return;
    setPendingStyle(style);
    setTimeout(() => setBoardStyle(style), 260);
    setTimeout(() => setPendingStyle(null), 480);
  };

  const voiceVolumePercent = Math.round(voiceVolume * 100);
  const musicVolumePercent = Math.round(musicVolume * 100);

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
          style={{ willChange: 'transform' }}
          animate={{ y: [0, 38, 0], x: [0, -18, 0], rotate: [0, 35, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>

        {/* Top-left — red pawn, drifts down-right */}
        <motion.div
          className="absolute -top-6 -left-12 opacity-[0.12] w-32 h-32 blur-[4px]"
          style={{ willChange: 'transform' }}
          animate={{ y: [0, 45, 0], x: [0, 22, 0], rotate: [0, -28, 0] }}
          transition={{ duration: 21, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        >
          <GamePiece color="#DC143C" />
        </motion.div>

        {/* Mid-right — green pawn, floats vertically */}
        <motion.div
          className="absolute top-[42%] -right-14 opacity-[0.13] w-24 h-24 blur-[3px]"
          style={{ willChange: 'transform' }}
          animate={{ y: [0, -40, 0], x: [0, -12, 0], rotate: [0, 50, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <GamePiece color="#00A550" />
        </motion.div>

        {/* Bottom-left — gold pawn, rises gently */}
        <motion.div
          className="absolute -bottom-8 -left-8 opacity-[0.15] w-26 h-26 blur-[3px]"
          style={{ willChange: 'transform' }}
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
              onClick={() => { playSelection(); setLangOpen(o => !o); }}
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
                          onClick={() => { playLanguageChange(); setLang(code); setLangOpen(false); }}
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
            <NeonToggle value={sound} onChange={handleSoundToggle} neon="#B44FFF" />
          </motion.div>

          {/* Voice Commentary */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl px-4 py-4"
            style={{
              background: "linear-gradient(145deg, #0e0420 0%, #160830 100%)",
              border: "1px solid rgba(180,79,255,0.20)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(180,79,255,0.15)", boxShadow: "0 0 14px rgba(180,79,255,0.25)" }}
              >
                <Volume2 className="w-5 h-5" style={{ color: "#B44FFF" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{t.voice}</p>
                <p className="text-white/40 font-sans" style={{ fontSize: "10px" }}>{t.voiceSub}</p>
              </div>
              <NeonToggle value={voice} onChange={handleVoiceToggle} neon="#B44FFF" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] font-heading font-bold text-white/45 uppercase flex-shrink-0" style={{ letterSpacing: "0.08em" }}>{t.voiceVolume}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={voiceVolumePercent}
                onChange={handleVoiceVolumeChange}
                disabled={!voice}
                aria-label={t.voiceVolume}
                className="min-w-0 flex-1 accent-[#B44FFF] disabled:opacity-40"
              />
              <span className="w-10 text-end text-[10px] font-heading font-bold text-white/55 flex-shrink-0">{voiceVolumePercent}%</span>
            </div>
          </motion.div>

          {/* Music */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl px-4 py-4"
            style={{
              background: "linear-gradient(145deg, #0e0420 0%, #160830 100%)",
              border: "1px solid rgba(180,79,255,0.20)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-4">
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
              <NeonToggle value={music} onChange={handleMusicToggle} neon="#B44FFF" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] font-heading font-bold text-white/45 uppercase flex-shrink-0" style={{ letterSpacing: "0.08em" }}>{t.musicVolume}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={musicVolumePercent}
                onChange={handleMusicVolumeChange}
                disabled={!music}
                aria-label={t.musicVolume}
                className="min-w-0 flex-1 accent-[#B44FFF] disabled:opacity-40"
              />
              <span className="w-10 text-end text-[10px] font-heading font-bold text-white/55 flex-shrink-0">{musicVolumePercent}%</span>
            </div>
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
            <NeonToggle value={vibration} onChange={handleVibrationToggle} neon="#B44FFF" />
          </motion.div>

          {/* ── Board Style Section ── */}
          <SectionLabel label={t.sectionBoard} />

          <motion.div
            variants={itemVariants}
            className="rounded-2xl overflow-hidden relative"
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
              onClick={() => { playSelection(); setBoardOpen(o => !o); }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,255,238,0.12)", boxShadow: "0 0 16px rgba(0,255,238,0.25)" }}
              >
                {/* Mini Ludo board icon */}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0.5" y="0.5" width="23" height="23" rx="3" fill="#050d1a" stroke="#00FFEE" strokeWidth="0.7" opacity="0.9"/>
                  <rect x="1.5" y="1.5"  width="8.5" height="8.5" rx="1.5" fill="#DC143C" opacity="0.85"/>
                  <rect x="14"  y="1.5"  width="8.5" height="8.5" rx="1.5" fill="#1E90FF" opacity="0.85"/>
                  <rect x="1.5" y="14"   width="8.5" height="8.5" rx="1.5" fill="#00A550" opacity="0.85"/>
                  <rect x="14"  y="14"   width="8.5" height="8.5" rx="1.5" fill="#FFD700" opacity="0.85"/>
                  <rect x="10.5" y="1.5" width="3"   height="21"  fill="#071422"/>
                  <rect x="1.5" y="10.5" width="21"  height="3"   fill="#071422"/>
                  <line x1="10.5" y1="0" x2="10.5" y2="24" stroke="#00FFEE" strokeWidth="0.4" opacity="0.30"/>
                  <line x1="13.5" y1="0" x2="13.5" y2="24" stroke="#00FFEE" strokeWidth="0.4" opacity="0.30"/>
                  <line x1="0" y1="10.5" x2="24" y2="10.5" stroke="#00FFEE" strokeWidth="0.4" opacity="0.30"/>
                  <line x1="0" y1="13.5" x2="24" y2="13.5" stroke="#00FFEE" strokeWidth="0.4" opacity="0.30"/>
                  <polygon points="12,10.5 13.5,12 12,13.5 10.5,12" fill="#00FFEE" opacity="0.75"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-white" style={{ fontSize: "15px", letterSpacing: "0.05em" }}>{t.boardStyle}</p>
                <p className="text-white/45 font-sans" style={{ fontSize: "11px" }}>{t.boardStyleSub}</p>
              </div>

              {/* Current style badge */}
              <span
                className="flex-shrink-0 text-[11px] font-heading font-bold px-2.5 py-1 rounded-full"
                style={boardStyle === 'neon'
                  ? { background: "rgba(0,255,238,0.15)", color: "#00FFEE", border: "1px solid rgba(0,255,238,0.32)", letterSpacing: "0.08em" }
                  : boardStyle === 'classic'
                  ? { background: "rgba(180,130,40,0.18)", color: "#C8960A", border: "1px solid rgba(180,130,40,0.40)", letterSpacing: "0.08em" }
                  : { background: "rgba(0,98,51,0.20)", color: "#C9A227", border: "1px solid rgba(0,98,51,0.45)", letterSpacing: "0.08em" }
                }
              >
                {boardStyle === 'neon' ? t.neonBoard : boardStyle === 'classic' ? t.classicBoard : t.dzBoard}
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
                      onClick={() => { playSelection(); handlePickBoardStyle("neon"); }}
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
                      {/* Mini board thumbnail */}
                      <div className="relative z-10 flex-shrink-0 rounded-lg overflow-hidden"
                        style={{ boxShadow: "0 0 10px rgba(0,255,238,0.30)", border: "1px solid rgba(0,255,238,0.30)" }}>
                        <svg viewBox="0 0 60 60" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="60" height="60" fill="#06101e"/>
                          {/* Corner home areas */}
                          <rect x="1"  y="1"  width="22" height="22" rx="3.5" fill="#DC143C" opacity="0.80"/>
                          <rect x="37" y="1"  width="22" height="22" rx="3.5" fill="#1E90FF" opacity="0.80"/>
                          <rect x="1"  y="37" width="22" height="22" rx="3.5" fill="#00A550" opacity="0.80"/>
                          <rect x="37" y="37" width="22" height="22" rx="3.5" fill="#FFD700" opacity="0.80"/>
                          {/* Pawn slots */}
                          <circle cx="8"  cy="8"  r="2.8" fill="#ff9999" opacity="0.85"/>
                          <circle cx="16" cy="8"  r="2.8" fill="#ff9999" opacity="0.85"/>
                          <circle cx="8"  cy="16" r="2.8" fill="#ff9999" opacity="0.85"/>
                          <circle cx="16" cy="16" r="2.8" fill="#ff9999" opacity="0.85"/>
                          <circle cx="44" cy="8"  r="2.8" fill="#99ccff" opacity="0.85"/>
                          <circle cx="52" cy="8"  r="2.8" fill="#99ccff" opacity="0.85"/>
                          <circle cx="44" cy="16" r="2.8" fill="#99ccff" opacity="0.85"/>
                          <circle cx="52" cy="16" r="2.8" fill="#99ccff" opacity="0.85"/>
                          <circle cx="8"  cy="44" r="2.8" fill="#66dd99" opacity="0.85"/>
                          <circle cx="16" cy="44" r="2.8" fill="#66dd99" opacity="0.85"/>
                          <circle cx="8"  cy="52" r="2.8" fill="#66dd99" opacity="0.85"/>
                          <circle cx="16" cy="52" r="2.8" fill="#66dd99" opacity="0.85"/>
                          <circle cx="44" cy="44" r="2.8" fill="#ffe680" opacity="0.85"/>
                          <circle cx="52" cy="44" r="2.8" fill="#ffe680" opacity="0.85"/>
                          <circle cx="44" cy="52" r="2.8" fill="#ffe680" opacity="0.85"/>
                          <circle cx="52" cy="52" r="2.8" fill="#ffe680" opacity="0.85"/>
                          {/* Cross lanes */}
                          <rect x="23" y="1"  width="14" height="58" fill="#071422"/>
                          <rect x="1"  y="23" width="58" height="14" fill="#071422"/>
                          {/* Home stretch tints */}
                          <rect x="23" y="1"  width="14" height="20" fill="#DC143C" opacity="0.20"/>
                          <rect x="23" y="39" width="14" height="20" fill="#1E90FF" opacity="0.20"/>
                          <rect x="1"  y="23" width="20" height="14" fill="#00A550" opacity="0.20"/>
                          <rect x="39" y="23" width="20" height="14" fill="#FFD700" opacity="0.20"/>
                          {/* Center area */}
                          <rect x="23" y="23" width="14" height="14" rx="2" fill="#06101e"/>
                          <polygon points="30,24.5 35.5,30 30,35.5 24.5,30" fill="#00FFEE" opacity="0.60"/>
                          {/* Neon grid lines */}
                          <line x1="23" y1="0" x2="23" y2="60" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
                          <line x1="37" y1="0" x2="37" y2="60" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
                          <line x1="0" y1="23" x2="60" y2="23" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
                          <line x1="0" y1="37" x2="60" y2="37" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
                          {/* Outer border */}
                          <rect x="0.5" y="0.5" width="59" height="59" stroke="#00FFEE" strokeWidth="0.8" fill="none" opacity="0.45"/>
                        </svg>
                      </div>
                      <span
                        className="font-heading font-bold relative z-10 flex-1 px-3"
                        style={{ fontSize: "14px", color: "#00FFEE", letterSpacing: "0.08em" }}
                      >
                        {t.neonBoard}
                      </span>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                        style={{ background: "#00FFEE" }}
                      >
                        {boardStyle === 'neon' ? <Check className="w-3 h-3 text-black" strokeWidth={3} /> : null}
                      </div>
                    </motion.button>

                    {/* ── Classic Board option ── */}
                    <motion.button
                      onClick={() => { playSelection(); handlePickBoardStyle("classic"); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl relative overflow-hidden mt-2"
                      style={boardStyle === 'classic' ? {
                        background: "rgba(180,130,40,0.14)",
                        border: "1px solid rgba(180,130,40,0.50)",
                        boxShadow: "0 0 18px rgba(180,130,40,0.16)",
                      } : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      {boardStyle === 'classic' && (
                        <motion.div
                          className="absolute inset-0"
                          layoutId="activeBoardBg"
                          style={{ background: "rgba(180,130,40,0.06)" }}
                        />
                      )}
                      {/* Mini Classic board thumbnail */}
                      <div className="relative z-10 flex-shrink-0 rounded-lg overflow-hidden"
                        style={boardStyle === 'classic'
                          ? { boxShadow: "0 0 10px rgba(180,130,40,0.35)", border: "1px solid rgba(180,130,40,0.35)" }
                          : { border: "1px solid rgba(255,255,255,0.14)" }}>
                        <svg viewBox="0 0 60 60" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="60" height="60" fill="#EDD9A3"/>
                          <rect x="1"  y="1"  width="22" height="22" rx="2" fill="#C41E2A" opacity="0.80"/>
                          <rect x="37" y="1"  width="22" height="22" rx="2" fill="#1055A0" opacity="0.80"/>
                          <rect x="1"  y="37" width="22" height="22" rx="2" fill="#1A7838" opacity="0.80"/>
                          <rect x="37" y="37" width="22" height="22" rx="2" fill="#C89600" opacity="0.80"/>
                          <rect x="2.5"  y="2.5"  width="19" height="19" rx="1.5" fill="#F8D8D8" opacity="0.90"/>
                          <rect x="38.5" y="2.5"  width="19" height="19" rx="1.5" fill="#D0DCF8" opacity="0.90"/>
                          <rect x="2.5"  y="38.5" width="19" height="19" rx="1.5" fill="#C8F0D8" opacity="0.90"/>
                          <rect x="38.5" y="38.5" width="19" height="19" rx="1.5" fill="#F8ECC4" opacity="0.90"/>
                          <circle cx="8"  cy="8"  r="3" fill="#C41E2A" opacity="0.70"/>
                          <circle cx="16" cy="8"  r="3" fill="#C41E2A" opacity="0.70"/>
                          <circle cx="8"  cy="16" r="3" fill="#C41E2A" opacity="0.70"/>
                          <circle cx="16" cy="16" r="3" fill="#C41E2A" opacity="0.70"/>
                          <circle cx="44" cy="8"  r="3" fill="#1055A0" opacity="0.70"/>
                          <circle cx="52" cy="8"  r="3" fill="#1055A0" opacity="0.70"/>
                          <circle cx="44" cy="16" r="3" fill="#1055A0" opacity="0.70"/>
                          <circle cx="52" cy="16" r="3" fill="#1055A0" opacity="0.70"/>
                          <circle cx="8"  cy="44" r="3" fill="#1A7838" opacity="0.70"/>
                          <circle cx="16" cy="44" r="3" fill="#1A7838" opacity="0.70"/>
                          <circle cx="8"  cy="52" r="3" fill="#1A7838" opacity="0.70"/>
                          <circle cx="16" cy="52" r="3" fill="#1A7838" opacity="0.70"/>
                          <circle cx="44" cy="44" r="3" fill="#C89600" opacity="0.70"/>
                          <circle cx="52" cy="44" r="3" fill="#C89600" opacity="0.70"/>
                          <circle cx="44" cy="52" r="3" fill="#C89600" opacity="0.70"/>
                          <circle cx="52" cy="52" r="3" fill="#C89600" opacity="0.70"/>
                          <rect x="23" y="1"  width="14" height="58" fill="#F5EDD0"/>
                          <rect x="1"  y="23" width="58" height="14" fill="#F5EDD0"/>
                          <rect x="25" y="1"  width="10" height="20" fill="#C41E2A" opacity="0.20"/>
                          <rect x="25" y="39" width="10" height="20" fill="#1055A0" opacity="0.20"/>
                          <rect x="1"  y="25" width="20" height="10" fill="#1A7838" opacity="0.20"/>
                          <rect x="39" y="25" width="20" height="10" fill="#C89600" opacity="0.20"/>
                          <rect x="23" y="23" width="14" height="14" rx="1.5" fill="#EDD9A3"/>
                          <polygon points="23,23 37,23 30,30" fill="#1055A0" opacity="0.76"/>
                          <polygon points="37,23 37,37 30,30" fill="#C89600" opacity="0.76"/>
                          <polygon points="37,37 23,37 30,30" fill="#1A7838" opacity="0.76"/>
                          <polygon points="23,37 23,23 30,30" fill="#C41E2A" opacity="0.76"/>
                          <polygon points="30,25.5 31.4,28.8 35,28.8 32.3,30.9 33.3,34.1 30,32.2 26.7,34.1 27.7,30.9 25,28.8 28.6,28.8" fill="#7A5018" opacity="0.80"/>
                          <line x1="23" y1="0" x2="23" y2="60" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
                          <line x1="37" y1="0" x2="37" y2="60" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
                          <line x1="0" y1="23" x2="60" y2="23" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
                          <line x1="0" y1="37" x2="60" y2="37" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
                          <rect x="0.5" y="0.5" width="59" height="59" stroke="#7A5018" strokeWidth="1" fill="none" opacity="0.62"/>
                        </svg>
                      </div>
                      <span
                        className="font-heading font-bold relative z-10 flex-1 px-3"
                        style={{ fontSize: "14px", color: boardStyle === 'classic' ? "#C8960A" : "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}
                      >
                        {t.classicBoard}
                      </span>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                        style={{ background: boardStyle === 'classic' ? "#C8960A" : "rgba(255,255,255,0.12)" }}
                      >
                        {boardStyle === 'classic' ? <Check className="w-3 h-3 text-black" strokeWidth={3} /> : null}
                      </div>
                    </motion.button>

                    {/* ── DZ Board option ── */}
                    <motion.button
                      onClick={() => { playSelection(); handlePickBoardStyle("dz"); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl relative overflow-hidden mt-2"
                      style={boardStyle === 'dz' ? {
                        background: "rgba(0,98,51,0.18)",
                        border: "1px solid rgba(201,162,39,0.50)",
                        boxShadow: "0 0 18px rgba(0,98,51,0.20)",
                      } : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      {boardStyle === 'dz' && (
                        <motion.div
                          className="absolute inset-0"
                          layoutId="activeBoardBg"
                          style={{ background: "rgba(0,98,51,0.08)" }}
                        />
                      )}
                      {/* Mini DZ board thumbnail */}
                      <div className="relative z-10 flex-shrink-0 rounded-lg overflow-hidden"
                        style={boardStyle === 'dz'
                          ? { boxShadow: "0 0 10px rgba(201,162,39,0.35)", border: "1px solid rgba(201,162,39,0.40)" }
                          : { border: "1px solid rgba(255,255,255,0.14)" }}>
                        <svg viewBox="0 0 60 60" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="60" height="60" fill={DZ.BOARD_BG}/>
                          {/* Corner home areas — TL=P0, TR=P1, BR=P2, BL=P3 (matches engine corner assignment) */}
                          <rect x="1"  y="1"  width="22" height="22" rx="2" fill={DZ.HOME_COLORS[0]} opacity="0.92"/>
                          <rect x="37" y="1"  width="22" height="22" rx="2" fill={DZ.HOME_COLORS[1]} opacity="0.92"/>
                          <rect x="37" y="37" width="22" height="22" rx="2" fill={DZ.HOME_COLORS[2]} opacity="0.92"/>
                          <rect x="1"  y="37" width="22" height="22" rx="2" fill={DZ.HOME_COLORS[3]} opacity="0.92"/>
                          {/* Cream cross lanes */}
                          <rect x="23" y="1"  width="14" height="58" fill={DZ.PATH_CREAM}/>
                          <rect x="1"  y="23" width="58" height="14" fill={DZ.PATH_CREAM}/>
                          {/* Home-stretch tints (top=P0, bottom=P1, left=P3, right=P2 — matches Neon/Classic thumbnail convention) */}
                          <rect x="25" y="1"  width="10" height="20" fill={DZ.STRIP_COLORS[0]} opacity="0.55"/>
                          <rect x="25" y="39" width="10" height="20" fill={DZ.STRIP_COLORS[1]} opacity="0.55"/>
                          <rect x="1"  y="25" width="20" height="10" fill={DZ.STRIP_COLORS[3]} opacity="0.55"/>
                          <rect x="39" y="25" width="20" height="10" fill={DZ.STRIP_COLORS[2]} opacity="0.55"/>
                          {/* Center — flat gold field, Phase 1 has no ornamentation */}
                          <rect x="23" y="23" width="14" height="14" fill={DZ.CENTER_GOLD}/>
                          {/* Outer deep-green frame + inner gold accent line */}
                          <rect x="0.5" y="0.5" width="59" height="59" rx="2" stroke={DZ.BORDER_DEEP} strokeWidth="1.6" fill="none"/>
                          <rect x="2.6" y="2.6" width="54.8" height="54.8" rx="1.5" stroke={DZ.BORDER_GOLD} strokeWidth="0.6" fill="none" opacity="0.85"/>
                        </svg>
                      </div>
                      <span
                        className="font-heading font-bold relative z-10 flex-1 px-3"
                        style={{ fontSize: "14px", color: boardStyle === 'dz' ? "#C9A227" : "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}
                      >
                        {t.dzBoard}
                      </span>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                        style={{ background: boardStyle === 'dz' ? "#C9A227" : "rgba(255,255,255,0.12)" }}
                      >
                        {boardStyle === 'dz' ? <Check className="w-3 h-3 text-black" strokeWidth={3} /> : null}
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {pendingStyle && (
                <LoadingOverlay key="reskin-flourish" boardStyle={pendingStyle} lang={lang} variant="flourish" />
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── About Section ── */}
          <SectionLabel label={t.sectionAbout} />

          <motion.button
            type="button"
            variants={itemVariants}
            whileHover={{ scale: 1.015, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSelection(); onAbout?.(); }}
            className="w-full rounded-2xl flex items-center gap-4 px-4 py-4 mb-6 text-start"
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
            <svg
              viewBox="0 0 30 20"
              width="34"
              height="23"
              className="flex-shrink-0 rounded"
              style={{ border: "1px solid rgba(255,255,255,0.18)", display: "block" }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <mask id="dz-crescent-mask">
                  <circle cx="14" cy="10" r="5.3" fill="white"/>
                  <circle cx="15.9" cy="10" r="4.4" fill="black"/>
                </mask>
                <clipPath id="dz-flag-clip">
                  <rect width="30" height="20" rx="2"/>
                </clipPath>
              </defs>
              <g clipPath="url(#dz-flag-clip)">
                {/* Green left half */}
                <rect width="15" height="20" fill="#006233"/>
                {/* White right half */}
                <rect x="15" width="15" height="20" fill="#ffffff"/>
                {/* Red crescent */}
                <circle cx="14" cy="10" r="5.3" fill="#D21034" mask="url(#dz-crescent-mask)"/>
                {/* Red 5-pointed star */}
                <polygon
                  points="17.5,8.2 17.92,9.42 19.21,9.44 18.19,10.22 18.56,11.46 17.5,10.72 16.44,11.46 16.82,10.22 15.79,9.44 17.08,9.42"
                  fill="#D21034"
                />
              </g>
            </svg>
          </motion.button>

        </motion.div>
      </div>
    </motion.div>
  );
}
