import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, X, Check } from "lucide-react";
import { playIconTap, playNavBack, playSelection, playStartPress, playToggleClick } from "../lib/sound-manager";
import { supportsDvh } from "../lib/utils";
import { readSavedGame, type SavedGameSnapshot } from "../lib/saved-game";
import { BOARD_STYLES } from "../lib/board-style-pref";
import type { BoardStyle } from "../App";
import * as DZ from "../lib/board-theme-dz";
import * as NM from "../lib/board-theme-normal";
import { BoardThemeThumbnail, BOARD_THEME_ACCENTS } from "./BoardThemeThumbnail";
import { MascotCharacter } from "./MascotCharacter";

// ─── Public types ─────────────────────────────────────────────────────────────
export interface SelectedMode {
  id:    string;
  neon:  string;
  label: string;
}

export type Rule = "classic" | "quick" | "teamup";

export interface GameConfig {
  rule:    Rule;
  players: number;
  modeId:  string;
  humanColor?: number;
  excludedColor?: number;
}

interface GameConfigOverlayProps {
  mode:    SelectedMode;
  lang:    "fr" | "ar";
  onClose: () => void;
  onStart: (config: GameConfig) => void;
  /** Called with the paused game that belongs to this mode, when the player resumes it. */
  onResume: (snapshot: SavedGameSnapshot) => void;
  boardStyle: BoardStyle;
  /** Live board-style updates from the quick switcher (same persisted preference as Settings). */
  onBoardStyleChange: (style: BoardStyle) => void;
}

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  fr: {
    configTitle:    "Configuration",
    rules:          "Règles du jeu",
    players:        "Joueurs",
    start:          "Commencer",
    chooseColor:    "Choisissez votre couleur",
    chooseColorSub: "Votre pion sera associé à cette couleur pour la partie",
    colorSection:   "Votre couleur",
    colorBack:      "Configuration",
    excludeTitle:   "Coin à laisser libre",
    excludeSub:     "Choisissez la couleur qui ne participera pas à cette partie",
    inPlay:         "Couleurs en jeu",
    resume:         "Reprendre",
    resumeHint:     "Partie en pause disponible pour ce mode",
    classic:        "Classique",
    classicSub:     "4 pions — règles complètes",
    quick:          "Rapide",
    quickSub:       "2 pions — partie courte",
    teamup:         "Paramètres",
    teamupSub:      "Attaque · Passe de Tour",
    settingsTitle:  "Paramètres d'équipe",
    // board-theme quick switcher (same wording as the Settings sheet)
    themeLabel:     "Style du plateau",
    themeNeon:      "Neon Board",
    themeClassic:   "Classic Board",
    themeDz:        "DZ Board",
    themeNormal:    "Normal Board",
    // team-mode specific
    sectionTeam:    "Options d'équipe",
    playersFixed:   "4 joueurs — mode équipe",
    teamAttack:     "Attaque Alliée",
    teamAttackSub:  "Les coéquipiers peuvent s'éliminer entre eux",
    turnPass:       "Passe de Tour",
    turnPassSub:    "Jouer les pions du partenaire après victoire",
  },
  ar: {
    configTitle:    "الإعداد",
    rules:          "قواعد اللعبة",
    players:        "اللاعبون",
    start:          "ابدأ اللعبة",
    chooseColor:    "اختر لونك",
    chooseColorSub: "سيتم تخصيص هذا اللون لقطعك في هذه الجولة",
    colorSection:   "لونك",
    colorBack:      "الإعدادات",
    excludeTitle:   "الزاوية المستبعدة",
    excludeSub:     "اختر اللون الذي لن يشارك في هذه الجولة",
    inPlay:         "الألوان المشاركة",
    resume:         "استئناف",
    resumeHint:     "توجد مباراة متوقفة لهذا الوضع",
    classic:        "كلاسيكي",
    classicSub:     "٤ قطع — القواعد الكاملة",
    quick:          "سريع",
    quickSub:       "قطعتان — جولة قصيرة",
    teamup:         "إعدادات اللعب",
    teamupSub:      "هجوم · تمرير الدور",
    settingsTitle:  "إعدادات اللعبة",
    // board-theme quick switcher (same wording as the Settings sheet)
    themeLabel:     "نمط اللوحة",
    themeNeon:      "نيون بورد",
    themeClassic:   "بورد كلاسيكي",
    themeDz:        "لوحة DZ",
    themeNormal:    "البورد العادي",
    // team-mode specific
    sectionTeam:    "خيارات الفريق",
    playersFixed:   "٤ لاعبين — وضع الفريق",
    teamAttack:     "هجوم الفريق",
    teamAttackSub:  "يمكن للزملاء أسر قطع بعضهم البعض",
    turnPass:       "تمرير الدور",
    turnPassSub:    "تحريك قطع الشريك بعد إيصال كل قطعه للبيت",
  },
} as const;

// ─── Rule config table ────────────────────────────────────────────────────────
const RULES: Array<{ id: Rule; neon: string; cardBg: string }> = [
  { id: "classic", neon: "#1E90FF", cardBg: "linear-gradient(145deg,#040d22 0%,#071a45 100%)" },
  { id: "quick",   neon: "#FFD700", cardBg: "linear-gradient(145deg,#1a1200 0%,#352400 100%)" },
  { id: "teamup",  neon: "#FF2855", cardBg: "linear-gradient(145deg,#180008 0%,#32000f 100%)" },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────

/** Classic — Ludo board cross silhouette with 4 pawn dots in corners */
function ClassicIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="ci-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="ci-g" cx="33%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#c0e0ff"/>
          <stop offset="55%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#001840"/>
        </radialGradient>
      </defs>
      {/* Board cross */}
      <path
        d="M18 4 h20 v14 h14 v20 h-14 v14 h-20 v-14 h-14 v-20 h14 z"
        fill="rgba(255,255,255,0.05)"
        stroke={neon} strokeWidth="1.5" strokeLinejoin="round"
        filter="url(#ci-f)"
      />
      {/* Centre tile */}
      <rect x="20" y="20" width="16" height="16" rx="3"
        fill={neon} opacity="0.20" filter="url(#ci-f)"/>
      {/* Star inside centre */}
      <path
        d="M28,22 l1.6,3.8 4,.3 -2.9,2.6 .9,3.9L28,31.2l-3.6,1.4 .9-3.9L22.4,26.1l4-.3Z"
        fill={neon} opacity="0.55"
      />
      {/* 4 corner pawns */}
      {[[8,8],[48,8],[8,48],[48,48]].map(([cx,cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="5" fill="url(#ci-g)" filter="url(#ci-f)"/>
          <circle cx={cx-1.5} cy={cy-2} r="1.8" fill="white" opacity="0.45"/>
        </g>
      ))}
    </svg>
  );
}

/** Quick — Hourglass body with lightning bolt overlay */
function QuickIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="qi-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="qi-g" cx="33%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#fffacc"/>
          <stop offset="55%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#4a3000"/>
        </radialGradient>
      </defs>
      {/* Hourglass outline */}
      <path
        d="M12 5 h32 L28 27 L44 51 H12 L28 27 Z"
        fill="rgba(255,255,255,0.06)"
        stroke={neon} strokeWidth="1.5" strokeLinejoin="round"
        filter="url(#qi-f)"
      />
      {/* Sand top */}
      <path d="M15 8 L28 24 L41 8 Z" fill={neon} opacity="0.28"/>
      {/* Sand bottom */}
      <path d="M28 32 L38 49 H18 Z" fill={neon} opacity="0.50" filter="url(#qi-f)"/>
      {/* Pinch line */}
      <line x1="16" y1="27" x2="40" y2="27" stroke={neon} strokeWidth="1.2" opacity="0.50"/>
      {/* Lightning bolt */}
      <path
        d="M31 12 L24 26 h5.5 L25 44 L37 24 h-6.5 Z"
        fill="url(#qi-g)" filter="url(#qi-f)"
      />
      {/* Specular */}
      <ellipse cx="19" cy="12" rx="3.5" ry="2" fill="white" opacity="0.30" transform="rotate(-15 19 12)"/>
    </svg>
  );
}

/** Team Up — Two pawns side-by-side with alliance arc and VS badge (2v2) */
function TeamUpIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="tu-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="tu-g" cx="33%" cy="22%" r="70%">
          <stop offset="0%"   stopColor="#ffaabb"/>
          <stop offset="50%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#3a0008"/>
        </radialGradient>
      </defs>
      {/* Left pawn */}
      <g transform="translate(-1,4) scale(0.66)">
        <path d="M14 54 Q17 44 20 36 Q20 29 24 25 Q28 29 28 36 Q31 44 34 54 Q39 54 39 60 L9 60 Q9 54 14 54 Z"
          fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" strokeLinejoin="round" filter="url(#tu-f)"/>
        <circle cx="24" cy="25" r="12" fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" filter="url(#tu-f)"/>
        <ellipse cx="19" cy="19" rx="4.5" ry="3" fill="white" opacity="0.38" transform="rotate(-15 19 19)"/>
      </g>
      {/* Right pawn */}
      <g transform="translate(23,4) scale(0.66)">
        <path d="M14 54 Q17 44 20 36 Q20 29 24 25 Q28 29 28 36 Q31 44 34 54 Q39 54 39 60 L9 60 Q9 54 14 54 Z"
          fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" strokeLinejoin="round" filter="url(#tu-f)"/>
        <circle cx="24" cy="25" r="12" fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" filter="url(#tu-f)"/>
        <ellipse cx="19" cy="19" rx="4.5" ry="3" fill="white" opacity="0.38" transform="rotate(-15 19 19)"/>
      </g>
      {/* Alliance arc across both pawns */}
      <path d="M8 8 Q28 1 48 8" stroke={neon} strokeWidth="2.4" fill="none" strokeLinecap="round" filter="url(#tu-f)"/>
      {/* VS badge centred between the two pawns */}
      <circle cx="28" cy="37" r="8" fill="#200005" stroke={neon} strokeWidth="1.6" filter="url(#tu-f)"/>
      <text x="28" y="41" textAnchor="middle" fontSize="9" fontWeight="bold"
        fill="white" fontFamily="Arial,sans-serif" letterSpacing="0.5">VS</text>
    </svg>
  );
}

/** Settings — two toggle rows (one ON, one OFF) */
function SettingsIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="si-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="si-g" cx="33%" cy="22%" r="72%">
          <stop offset="0%" stopColor="#ffaabb"/>
          <stop offset="55%" stopColor={neon}/>
          <stop offset="100%" stopColor="#3a0008"/>
        </radialGradient>
      </defs>
      {/* Toggle 1 — ON */}
      <rect x="6" y="11" width="38" height="11" rx="5.5" fill={`${neon}20`} stroke={neon} strokeWidth="1.5" filter="url(#si-f)"/>
      <circle cx="38" cy="16.5" r="6" fill="url(#si-g)" filter="url(#si-f)"/>
      <ellipse cx="36.2" cy="14.5" rx="2" ry="1.2" fill="white" opacity="0.42"/>
      <circle cx="15" cy="16.5" r="1.6" fill={neon} opacity="0.38"/>
      {/* Toggle 2 — OFF */}
      <rect x="12" y="34" width="38" height="11" rx="5.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" filter="url(#si-f)"/>
      <circle cx="18" cy="39.5" r="6" fill="rgba(255,255,255,0.26)" filter="url(#si-f)"/>
      <circle cx="43" cy="39.5" r="1.6" fill="rgba(255,255,255,0.20)"/>
    </svg>
  );
}

// ─── Config toggle (used inside team options rows) ────────────────────────────
// RTL fix: the sheet sets dir="rtl" for Arabic. Without isolation the knob's
// static position for the absolutely-positioned thumb is computed against the
// parent's inline direction, so the same x values appear visually reversed in
// RTL (ON seemed to slide to the opposite side vs French/LTR). The switch is
// a physical control — it should slide to the same physical side for ON/OFF
// in both directions. Isolate the control to ltr so its coordinate system is
// stable and the knob always slides right for ON, left for OFF, matching
// French/LTR behaviour exactly.
function ConfigToggle({
  value,
  onChange,
  neon,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  neon: string;
}) {
  return (
    <motion.button
      dir="ltr"
      onClick={(e) => { e.stopPropagation(); const next = !value; playToggleClick(next); onChange(next); }}
      className="relative flex-shrink-0"
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        direction: "ltr",
        background: value
          ? `linear-gradient(135deg, ${neon}90, ${neon}55)`
          : "rgba(255,255,255,0.10)",
        border: `1.5px solid ${value ? neon : "rgba(255,255,255,0.16)"}`,
        boxShadow: value ? `0 0 14px ${neon}55` : "none",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
      }}
      whileTap={{ scale: 0.92 }}
      aria-pressed={value}
      role="switch"
      aria-checked={value}
    >
      <motion.div
        className="absolute top-[3px] left-0"
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          background: value ? "white" : "rgba(255,255,255,0.42)",
          boxShadow: value ? `0 2px 8px ${neon}70` : "none",
        }}
        animate={{ x: value ? 22 : 3 }}
        initial={false}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
      />
    </motion.button>
  );
}

// ─── Section label (with neon accent matching the selected mode) ──────────────
function SectionLabel({ label, neon }: { label: string; neon: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${neon}60, transparent)` }}/>
      <span
        className="font-heading font-bold uppercase"
        style={{ fontSize: "10px", letterSpacing: "0.22em", color: `${neon}cc` }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${neon}60, transparent)` }}/>
    </div>
  );
}

// ─── Board-theme quick switcher ───────────────────────────────────────────────
// A deliberately quiet one-row control: a small muted label + four mini-board
// swatches (the exact artwork the Settings picker shows, condensed). It sits
// below the primary match-setup choices (rules, players, colour) in both size
// and brightness, so it reads as an appearance nicety — a quick "which board
// do I see" — rather than a match option. It writes the same persisted
// BoardStyle preference as Settings (single source of truth).
type ConfigCopy = (typeof T)["fr"] | (typeof T)["ar"];

function BoardThemeSwitcher({ boardStyle, onChange, t }: {
  boardStyle: BoardStyle;
  onChange: (style: BoardStyle) => void;
  t: ConfigCopy;
}) {
  const themeName = (s: BoardStyle) =>
    s === "neon" ? t.themeNeon : s === "classic" ? t.themeClassic : s === "dz" ? t.themeDz : t.themeNormal;
  return (
    <div className="flex items-center gap-2.5 mb-5" role="group" aria-label={t.themeLabel}>
      {/* Muted, start-aligned micro-label — one visual tier below SectionLabel */}
      <span
        className="font-heading font-bold uppercase flex-shrink-0"
        style={{ fontSize: "9px", letterSpacing: "0.16em", color: "rgba(255,255,255,0.42)" }}
      >
        {t.themeLabel}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0 ms-auto">
        {BOARD_STYLES.map((s) => {
          const active = boardStyle === s;
          const accent = BOARD_THEME_ACCENTS[s];
          return (
            <motion.button
              key={s}
              onClick={() => { if (!active) { playSelection(); onChange(s); } }}
              whileHover={{ scale: active ? 1 : 1.08 }}
              whileTap={{ scale: 0.90 }}
              aria-label={themeName(s)}
              aria-pressed={active}
              className="relative rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{
                width: "38px",
                height: "38px",
                background: active ? `${accent}1c` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${active ? accent : "rgba(255,255,255,0.12)"}`,
                boxShadow: active ? `0 0 12px ${accent}40` : "none",
                opacity: active ? 1 : 0.72,
                transition: "background 0.20s ease, border-color 0.20s ease, box-shadow 0.20s ease, opacity 0.20s ease",
              }}
            >
              <BoardThemeThumbnail boardStyle={s} size={28} style={{ display: "block", borderRadius: "5px" }}/>
              {active && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute rounded-full flex items-center justify-center"
                  style={{
                    width: "14px",
                    height: "14px",
                    top: "-4px",
                    insetInlineEnd: "-4px",
                    background: accent,
                    boxShadow: `0 0 7px ${accent}90`,
                  }}
                >
                  <Check className="text-black" style={{ width: "9px", height: "9px" }} strokeWidth={3.5}/>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small pawn silhouette for player-count chips ────────────────────────────
function PawnSilhouette({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 20 32" width={size} height={size * 1.6} fill="none">
      <path
        d="M5 30 Q6 23 8 19 Q8 14 10 11 Q12 14 12 19 Q14 23 15 30 Q19 30 19 32 H1 Q1 30 5 30 Z"
        fill={color}
      />
      <circle cx="10" cy="11" r="5.5" fill={color}/>
      <ellipse cx="8" cy="8.5" rx="2.5" ry="1.6" fill="white" opacity="0.38" transform="rotate(-15 8 8.5)"/>
    </svg>
  );
}

// Player colour palette
const PLAYER_COLORS = ["#DC143C", "#1E90FF", "#FFD700", "#00A550"];
const CLASSIC_PLAYER_COLORS = ["#C31024", "#1542B0", "#E8A800", "#1C6B2E"];

function themePlayerColors(boardStyle: BoardStyle): readonly string[] {
  if (boardStyle === "dz") return DZ.HOME_COLORS;
  if (boardStyle === "classic") return CLASSIC_PLAYER_COLORS;
  if (boardStyle === "normal") return NM.HOME_COLORS;
  return PLAYER_COLORS;
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
export function GameConfigOverlay({ mode, lang, onClose, onStart, onResume, boardStyle, onBoardStyleChange }: GameConfigOverlayProps) {
  const [rule,         setRule]         = useState<Rule>("classic");
  const [players,      setPlayers]      = useState(4);
  const [humanColor,   setHumanColor]  = useState(0);
  const [excludedColor, setExcludedColor] = useState<number | undefined>(undefined);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [teamAttack,   setTeamAttack]   = useState(false);
  const [turnPass,     setTurnPass]     = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  // A paused game is surfaced only inside the mode it belongs to. The sheet is
  // mounted fresh each time a mode is opened, so this read is always current.
  const [savedGame] = useState<SavedGameSnapshot | null>(() => {
    const snapshot = readSavedGame();
    return snapshot && snapshot.config.modeId === mode.id ? snapshot : null;
  });

  const t   = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const themeColors = themePlayerColors(boardStyle);
  const needsColorPicker = mode.id === "computer" || (players < 4 && mode.id !== "teamup");
  const showHumanColor = mode.id === "computer";
  const resolvedExcludedColor = excludedColor ?? (humanColor === 0 && players < 4 ? players : 0);
  // Which character the picker's hero card previews. In the flows that only
  // ask who sits out (Tour par Tour with 2–3 players — the En Ligne and Amis
  // cards are still "coming soon", so they never reach this sheet) there is no
  // "your colour" to show, so the card follows the corner being left free
  // instead of staying pinned on red.
  const previewPlayer = showHumanColor ? humanColor : resolvedExcludedColor;

  const ruleLabel = (r: Rule) =>
    r === "classic" ? t.classic : r === "quick" ? t.quick : t.teamup;
  const ruleSub = (r: Rule) =>
    r === "classic" ? t.classicSub : r === "quick" ? t.quickSub : t.teamupSub;
  const ruleIcon = (r: Rule, neon: string) => {
    if (r === "classic") return <ClassicIcon  neon={neon}/>;
    if (r === "quick")   return <QuickIcon    neon={neon}/>;
    return                      <SettingsIcon neon={neon}/>;
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <motion.div
        className="absolute inset-0 z-30"
        style={{ background: "rgba(4,6,20,0.72)", backdropFilter: "blur(8px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.26 }}
        onClick={() => { playNavBack(); onClose(); }}
      />

      {/* ── Sheet ── */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #12082c 0%, #0c1c4c 52%, #081a0a 100%)",
          borderRadius: "28px 28px 0 0",
          boxShadow:
            "0 -16px 56px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.07)",
          maxHeight: supportsDvh ? "83dvh" : "83vh",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.24 } }}
        transition={{ type: "spring", stiffness: 200, damping: 32 }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.20)" }}/>
        </div>

        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]"
          style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}
        />

        {/* ── Header row ── */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-1 flex-shrink-0">
          {/* Mode neon badge */}
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `${mode.neon}18`,
              border: `1px solid ${mode.neon}45`,
            }}
            animate={{
              boxShadow: [`0 0 10px ${mode.neon}35`, `0 0 20px ${mode.neon}60`, `0 0 10px ${mode.neon}35`],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-4 h-4 rounded-full" style={{ background: mode.neon }}/>
          </motion.div>

          <div className="flex-1 min-w-0">
            <p
              className="font-heading uppercase"
              style={{ fontSize: "9px", letterSpacing: "0.20em", color: `${mode.neon}99` }}
            >
              {t.configTitle}
            </p>
            <h2
              className="font-heading font-bold text-white leading-none"
              style={{ fontSize: "16px", letterSpacing: "0.06em" }}
            >
              {mode.label}
            </h2>
          </div>

          {/* Close */}
          <motion.button
            onClick={() => { playIconTap(); onClose(); }}
            whileHover={{ scale: 1.10 }}
            whileTap={{ scale: 0.90 }}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <X className="w-4 h-4 text-white/60"/>
          </motion.button>
        </div>

        {/* Divider */}
        <div
          className="mx-5 h-px flex-shrink-0"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }}
        />

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-6">

          {showColorPicker ? (
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <div className="relative overflow-hidden rounded-3xl px-5 pt-5 pb-4 mb-5" style={{ background: `linear-gradient(145deg, ${mode.neon}18 0%, rgba(7,10,34,0.72) 58%, rgba(4,7,22,0.88) 100%)`, border: `1px solid ${mode.neon}42`, boxShadow: `0 12px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.09)` }}>
                <div className="absolute -right-10 -top-12 w-32 h-32 rounded-full" style={{ background: `radial-gradient(circle, ${mode.neon}40, transparent 68%)` }}/>
                <div className="relative flex items-center gap-4">
                  <motion.div className="relative flex items-center justify-center w-[78px] h-[78px] rounded-3xl" animate={{ boxShadow: [`0 0 18px ${themeColors[previewPlayer]}35`, `0 0 34px ${themeColors[previewPlayer]}70`, `0 0 18px ${themeColors[previewPlayer]}35`] }} transition={{ duration: 2.2, repeat: Infinity }} style={{ background: `radial-gradient(circle, ${themeColors[previewPlayer]}30, rgba(255,255,255,0.04) 58%, transparent 72%)`, border: `1px solid ${themeColors[previewPlayer]}60` }}>
                    {/* The chosen colour's own character — a presentation
                        moment: it lands with a settle, waves hello, and
                        keeps a gentle idle while you browse. greetKey makes
                        every pick replay the greeting. In the exclude-only
                        flows the card shows the benched character instead,
                        so it stays in step with the list below. */}
                    <MascotCharacter player={previewPlayer} size={58} isNeon mood={showHumanColor ? "alert" : "sad"} greetKey={showHumanColor ? previewPlayer : undefined} />
                  </motion.div>
                  <div className="min-w-0"><p className="font-heading uppercase" style={{ fontSize: "9px", letterSpacing: "0.18em", color: `${mode.neon}aa` }}>{showHumanColor ? t.colorSection : t.inPlay}</p><h3 className="font-heading font-bold text-white leading-tight" style={{ fontSize: "20px", letterSpacing: "0.04em" }}>{showHumanColor ? t.chooseColor : t.excludeTitle}</h3><p className="font-sans text-white/50 mt-1" style={{ fontSize: "10px", lineHeight: 1.35 }}>{showHumanColor ? t.chooseColorSub : t.excludeSub}</p></div>
                </div>
              </div>

              {showHumanColor && <>
                <SectionLabel label={t.colorSection} neon={mode.neon}/>
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  {themeColors.map((color, index) => { const active = humanColor === index; const unavailable = resolvedExcludedColor === index; return <motion.button key={color} disabled={unavailable} onClick={() => { playSelection(); setHumanColor(index); if (excludedColor === index) setExcludedColor(undefined); }} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className="relative flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ opacity: unavailable ? 0.28 : 1, background: active ? `linear-gradient(135deg, ${color}30, ${color}10)` : "rgba(255,255,255,0.04)", border: `1.5px solid ${active ? color : "rgba(255,255,255,0.10)"}`, boxShadow: active ? `0 0 22px ${color}40, inset 0 1px 0 rgba(255,255,255,0.10)` : "inset 0 1px 0 rgba(255,255,255,0.04)" }}>{/* Each option pairs its colour with its character, so players pick "their" character along with their colour. */}<MascotCharacter player={index} size={30} isNeon/><span className="font-heading font-bold" style={{ fontSize: "12px", color: active ? "white" : "rgba(255,255,255,0.58)", letterSpacing: "0.06em" }}>{["ROUGE", "BLEU", "JAUNE", "VERT"][index]}</span>{active && <span className="ml-auto w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }}/>}</motion.button>; })}
                </div>
              </>}

              {players < 4 && <>
                <SectionLabel label={t.excludeTitle} neon={mode.neon}/>
                <p className="font-sans text-white/50 text-center -mt-1 mb-3" style={{ fontSize: "10px" }}>{t.excludeSub}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {themeColors.map((color, index) => { const active = resolvedExcludedColor === index; const unavailable = showHumanColor && humanColor === index; return <motion.button key={`exclude-${color}`} disabled={unavailable} onClick={() => { playSelection(); setExcludedColor(index); }} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className="relative flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ opacity: unavailable ? 0.25 : 1, background: active ? `linear-gradient(135deg, ${color}28, ${color}0e)` : "rgba(255,255,255,0.035)", border: `1.5px solid ${active ? color : "rgba(255,255,255,0.10)"}`, boxShadow: active ? `0 0 20px ${color}38` : "none" }}>{/* The same illustrated characters as the colour-pick list above, at the same size and per-colour treatment — picking who sits this match out now reads as benching a character rather than switching off a generic pawn. */}<MascotCharacter player={index} size={30} isNeon mood={active ? "sad" : "alert"}/><span className="font-heading font-bold" style={{ fontSize: "12px", color: active ? "white" : "rgba(255,255,255,0.58)", letterSpacing: "0.06em" }}>{["ROUGE", "BLEU", "JAUNE", "VERT"][index]}</span>{active && <span className="ml-auto font-heading font-bold" style={{ fontSize: "9px", color }}>OUT</span>}</motion.button>; })}
                </div>
              </>}

              <motion.button whileHover={{ scale: 1.018, y: -2 }} whileTap={{ scale: 0.978 }} onClick={() => { playStartPress(); onStart({ rule: mode.id === "teamup" ? "teamup" : rule, players: mode.id === "teamup" ? 4 : players, modeId: mode.id, humanColor: showHumanColor ? humanColor : undefined, excludedColor: players < 4 ? resolvedExcludedColor : undefined }); }} className="relative rounded-2xl overflow-hidden mt-6 w-full" style={{ background: `linear-gradient(135deg, ${mode.neon}38 0%, ${mode.neon}12 100%)`, border: `1.5px solid ${mode.neon}70`, boxShadow: `0 10px 30px rgba(0,0,0,0.52), 0 0 26px ${mode.neon}35`, padding: "16px 24px" }}><span className="font-heading font-bold text-white" style={{ fontSize: "15px", letterSpacing: "0.10em" }}>{t.start}</span></motion.button>
              <button onClick={() => { playNavBack(); setShowColorPicker(false); }} className="font-heading font-bold text-white/55 mt-2 py-2" style={{ fontSize: "12px", letterSpacing: "0.08em" }}>← {t.colorBack}</button>
            </motion.div>          ) : (
          <>
          {/* ── RULES SECTION — always shown ── */}
          <SectionLabel label={t.rules} neon={mode.neon}/>
          <div className="flex gap-2.5 mb-6">
            {RULES.map((r) => {
              const active = rule === r.id;
              return (
                <motion.button
                  key={r.id}
                  onClick={() => { playSelection(); setRule(r.id); if (r.id === "teamup") setShowSettings(true); }}
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 relative rounded-2xl overflow-hidden flex flex-col items-center pt-4 pb-3 px-2 gap-0"
                  style={{
                    background: active
                      ? r.cardBg
                      : "linear-gradient(145deg,#0a0820 0%,#0f1030 100%)",
                    boxShadow: active
                      ? `0 6px 24px rgba(0,0,0,0.55), 0 0 0 1.5px ${r.neon}68`
                      : "0 3px 10px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.07)",
                    transition: "box-shadow 0.22s ease, background 0.22s ease",
                  }}
                >
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        key="stripe"
                        className="absolute top-0 left-0 right-0 h-[2.5px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${r.neon}, transparent)` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                  </AnimatePresence>
                  {active && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(circle at top left, ${r.neon}18, transparent 65%)` }}
                    />
                  )}
                  <motion.div
                    className="w-12 h-12 mb-2.5 relative z-10"
                    animate={
                      active
                        ? { filter: [`drop-shadow(0 0 5px ${r.neon}55)`, `drop-shadow(0 0 12px ${r.neon}88)`, `drop-shadow(0 0 5px ${r.neon}55)`] }
                        : { filter: "none" }
                    }
                    transition={{ duration: 2.2, repeat: active ? Infinity : 0 }}
                  >
                    {ruleIcon(r.id, active ? r.neon : "rgba(255,255,255,0.22)")}
                  </motion.div>
                  <span
                    className="relative z-10 font-heading font-bold text-center leading-tight"
                    style={{ fontSize: "12px", letterSpacing: "0.06em", color: active ? "white" : "rgba(255,255,255,0.38)", transition: "color 0.20s" }}
                  >
                    {ruleLabel(r.id)}
                  </span>
                  <span
                    className="relative z-10 font-sans text-center leading-tight mt-0.5"
                    style={{ fontSize: "8.5px", color: active ? `${r.neon}cc` : "rgba(255,255,255,0.22)", transition: "color 0.20s" }}
                  >
                    {ruleSub(r.id)}
                  </span>
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        key="dot"
                        className="w-1.5 h-1.5 rounded-full mt-2 relative z-10 flex-shrink-0"
                        style={{ background: r.neon, boxShadow: `0 0 6px ${r.neon}` }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        layoutId="ruleIndicator"
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* ── PLAYERS SECTION ── */}
          <SectionLabel label={t.players} neon={mode.neon}/>

          {mode.id === "teamup" ? (
            /* Locked to 4 — static indicator */
            <div
              className="relative overflow-hidden flex items-center gap-4 px-4 py-3.5 rounded-2xl mb-6"
              style={{
                background: `linear-gradient(145deg, ${mode.neon}12 0%, ${mode.neon}06 100%)`,
                border: `1.5px solid ${mode.neon}40`,
                boxShadow: `0 0 22px ${mode.neon}1a, inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              {/* Neon top accent */}
              <div
                className="absolute left-0 right-0 h-[2px] rounded-t-2xl pointer-events-none"
                style={{ top: 0, background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}
              />

              {/* 4 coloured pawns */}
              <div className="flex gap-1.5 items-end flex-shrink-0">
                {PLAYER_COLORS.map((col, i) => (
                  <PawnSilhouette key={i} color={col} size={11}/>
                ))}
              </div>

              {/* Number + label */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-heading font-bold leading-none"
                  style={{ fontSize: "26px", color: mode.neon, textShadow: `0 0 16px ${mode.neon}80` }}
                >
                  4
                </p>
                <p className="font-sans mt-0.5" style={{ fontSize: "10px", color: `${mode.neon}88` }}>
                  {t.playersFixed}
                </p>
              </div>

              {/* Lock badge */}
              <div
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{
                  background: `${mode.neon}18`,
                  border: `1px solid ${mode.neon}40`,
                }}
              >
                <svg viewBox="0 0 12 14" width="9" height="10" fill="none">
                  <rect x="1" y="6" width="10" height="7" rx="2" fill={mode.neon} opacity="0.85"/>
                  <path d="M3 6 V4 a3 3 0 0 1 6 0 V6" stroke={mode.neon} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                  <circle cx="6" cy="9.5" r="1.2" fill="white" opacity="0.70"/>
                </svg>
                <span
                  className="font-heading font-bold"
                  style={{ fontSize: "9px", letterSpacing: "0.10em", color: mode.neon }}
                >
                  FIXE
                </span>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 justify-center mb-6">
              {[2, 3, 4].map((n) => {
                const active = players === n;
                return (
                  <motion.button
                    key={n}
                    onClick={() => { playSelection(); setPlayers(n); }}
                    whileHover={{ scale: 1.06, y: -3 }}
                    whileTap={{ scale: 0.93 }}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl flex-1"
                    style={{
                      height: "82px",
                      background: active ? `${mode.neon}18` : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${active ? mode.neon : "rgba(255,255,255,0.10)"}`,
                      boxShadow: active ? `0 0 22px ${mode.neon}40, inset 0 1px 0 rgba(255,255,255,0.08)` : "none",
                      transition: "all 0.22s ease",
                    }}
                  >
                    {active && (
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                        style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}
                      />
                    )}
                    <div className="flex gap-1 items-end">
                      {PLAYER_COLORS.slice(0, n).map((col, i) => (
                        <PawnSilhouette key={i} color={active ? col : "rgba(255,255,255,0.22)"} size={n === 4 ? 9 : 11}/>
                      ))}
                    </div>
                    <span
                      className="font-heading font-bold leading-none"
                      style={{
                        fontSize: "20px",
                        color: active ? mode.neon : "rgba(255,255,255,0.35)",
                        textShadow: active ? `0 0 14px ${mode.neon}80` : "none",
                        transition: "color 0.22s, text-shadow 0.22s",
                      }}
                    >
                      {n}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ── BOARD THEME — quiet quick switcher (same preference as Settings) ── */}
          <BoardThemeSwitcher boardStyle={boardStyle} onChange={onBoardStyleChange} t={t}/>

          {/* ── START CTA (+ per-mode resume, only when this mode has a paused game) ── */}
          <div className="flex items-stretch gap-2.5">
          <motion.button
            whileHover={{ scale: 1.018, y: -2 }}
            whileTap={{ scale: 0.978 }}
            onClick={() => {
              playStartPress();
              if (needsColorPicker && !showColorPicker) {
                setShowColorPicker(true);
                return;
              }
              onStart({
                rule:    mode.id === "teamup" ? "teamup" : rule,
                players: mode.id === "teamup" ? 4       : players,
                modeId:  mode.id,
                humanColor: mode.id === "computer" ? humanColor : undefined,
                excludedColor: players < 4 ? resolvedExcludedColor : undefined,
              });
            }}
            className={`${savedGame ? "flex-1 min-w-0" : "w-full"} relative rounded-2xl overflow-hidden`}
            style={{
              background: `linear-gradient(135deg, ${mode.neon}28 0%, ${mode.neon}12 100%)`,
              border: `1.5px solid ${mode.neon}60`,
              boxShadow: `0 8px 28px rgba(0,0,0,0.50), 0 0 24px ${mode.neon}30`,
              padding: "18px 24px",
            }}
          >
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["200% 0", "-100% 0"] }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
            />

            {/* Corner glow */}
            <div
              className="absolute top-0 left-0 w-32 h-full pointer-events-none"
              style={{ background: `radial-gradient(circle at left, ${mode.neon}18, transparent 70%)` }}
            />

            <div className="relative z-10 flex items-center justify-center gap-3">
              {/* Play chevron triangle */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${mode.neon}25`,
                  border: `1px solid ${mode.neon}50`,
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <polygon points="3,1 15,8 3,15" fill="white" opacity="0.92"/>
                </svg>
              </div>
              <span
                className="font-heading font-bold text-white"
                style={{ fontSize: "16px", letterSpacing: "0.10em" }}
              >
                {t.start}
              </span>
            </div>
          </motion.button>

          {savedGame && (
            <motion.button
              whileHover={{ scale: 1.018, y: -2 }}
              whileTap={{ scale: 0.978 }}
              onClick={() => { playStartPress(); onResume(savedGame); }}
              className="relative rounded-2xl overflow-hidden flex-shrink-0 flex flex-col items-center justify-center gap-1"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1.5px solid ${mode.neon}45`,
                boxShadow: "0 8px 28px rgba(0,0,0,0.50)",
                padding: "12px 16px",
              }}
              aria-label={t.resume}
              title={t.resumeHint}
            >
              <RotateCcw className="w-4 h-4" style={{ color: mode.neon }} />
              <span
                className="font-heading font-bold text-white/85 leading-none"
                style={{ fontSize: "11px", letterSpacing: "0.06em" }}
              >
                {t.resume}
              </span>
            </motion.button>
          )}
          </div>

          {savedGame && (
            <p
              className="font-sans text-white/45 text-center mt-2.5"
              style={{ fontSize: "10px" }}
            >
              {t.resumeHint}
            </p>
          )}
          </>
          )}

        </div>

        {/* ── Settings Modal (overlays the sheet) ── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              className="absolute inset-0 z-50 flex items-center px-5"
              style={{ background: "rgba(4,6,20,0.72)", backdropFilter: "blur(6px)", borderRadius: "28px 28px 0 0" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.20 }}
              onClick={() => { playNavBack(); setShowSettings(false); }}
            >
              <motion.div
                className="w-full rounded-3xl overflow-hidden"
                style={{
                  background: "linear-gradient(145deg,#12082c 0%,#200010 100%)",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.09)",
                }}
                initial={{ opacity: 0, scale: 0.93, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 10 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top neon stripe */}
                <div className="h-[2.5px]" style={{ background: `linear-gradient(90deg, transparent, ${RULES[2].neon}, transparent)` }}/>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <span className="font-heading font-bold text-white" style={{ fontSize: "14px", letterSpacing: "0.06em" }}>
                    {t.settingsTitle}
                  </span>
                  <motion.button
                    onClick={() => { playIconTap(); setShowSettings(false); }}
                    whileTap={{ scale: 0.90 }}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)" }}
                  >
                    <X className="w-3.5 h-3.5 text-white/60"/>
                  </motion.button>
                </div>

                {/* Divider */}
                <div className="mx-5 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }}/>

                {/* Toggles */}
                <div className="flex flex-col gap-3 px-4 pt-3 pb-5">

                  {/* Team Attack */}
                  <motion.div
                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl"
                    style={{
                      background: "linear-gradient(145deg,#1c0008 0%,#2a0012 100%)",
                      border: `1px solid ${teamAttack ? `${RULES[2].neon}50` : "rgba(255,255,255,0.08)"}`,
                      boxShadow: teamAttack ? `0 0 20px ${RULES[2].neon}1a` : "none",
                      transition: "border-color 0.22s, box-shadow 0.22s",
                    }}
                    whileTap={{ scale: 0.987 }}
                    onClick={() => setTeamAttack(v => { const next = !v; playToggleClick(next); return next; })}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${RULES[2].neon}14`, border: `1px solid ${RULES[2].neon}30` }}
                    >
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                        <path d="M4 10 L10 4 L16 10 L10 16 Z" stroke={RULES[2].neon} strokeWidth="1.5" strokeLinejoin="round" fill={`${RULES[2].neon}25`}/>
                        <circle cx="10" cy="10" r="2.2" fill={RULES[2].neon} opacity="0.80"/>
                        <path d="M7 7 L4 4 M13 7 L16 4 M7 13 L4 16 M13 13 L16 16" stroke={RULES[2].neon} strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-white leading-tight" style={{ fontSize: "13px", letterSpacing: "0.04em" }}>{t.teamAttack}</p>
                      <p className="font-sans text-white/45 leading-snug mt-0.5" style={{ fontSize: "10px" }}>{t.teamAttackSub}</p>
                    </div>
                    <ConfigToggle value={teamAttack} onChange={setTeamAttack} neon={RULES[2].neon}/>
                  </motion.div>

                  {/* Turn Pass */}
                  <motion.div
                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl"
                    style={{
                      background: "linear-gradient(145deg,#1c0008 0%,#2a0012 100%)",
                      border: `1px solid ${turnPass ? `${RULES[2].neon}50` : "rgba(255,255,255,0.08)"}`,
                      boxShadow: turnPass ? `0 0 20px ${RULES[2].neon}1a` : "none",
                      transition: "border-color 0.22s, box-shadow 0.22s",
                    }}
                    whileTap={{ scale: 0.987 }}
                    onClick={() => setTurnPass(v => { const next = !v; playToggleClick(next); return next; })}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${RULES[2].neon}14`, border: `1px solid ${RULES[2].neon}30` }}
                    >
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                        <path d="M3 10 Q3 5 8 5 L14 5" stroke={RULES[2].neon} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.60"/>
                        <path d="M12 3 L15 5 L12 7" stroke={RULES[2].neon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 10 Q17 15 12 15 L6 15" stroke={RULES[2].neon} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.60"/>
                        <path d="M8 13 L5 15 L8 17" stroke={RULES[2].neon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-white leading-tight" style={{ fontSize: "13px", letterSpacing: "0.04em" }}>{t.turnPass}</p>
                      <p className="font-sans text-white/45 leading-snug mt-0.5" style={{ fontSize: "10px" }}>{t.turnPassSub}</p>
                    </div>
                    <ConfigToggle value={turnPass} onChange={setTurnPass} neon={RULES[2].neon}/>
                  </motion.div>

                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </>
  );
}
