import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// ─── Public types ─────────────────────────────────────────────────────────────
export interface SelectedMode {
  id:    string;
  neon:  string;
  label: string;
}

export type Rule = "classic" | "quick" | "master";

export interface GameConfig {
  rule:    Rule;
  players: number;
  modeId:  string;
}

interface GameConfigOverlayProps {
  mode:    SelectedMode;
  lang:    "fr" | "ar";
  onClose: () => void;
  onStart: (config: GameConfig) => void;
}

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  fr: {
    configTitle: "Configuration",
    rules:       "Règles du jeu",
    players:     "Joueurs",
    start:       "Commencer",
    classic:     "Classique",
    classicSub:  "4 pions — règles complètes",
    quick:       "Rapide",
    quickSub:    "2 pions — partie courte",
    master:      "Maître",
    masterSub:   "Pouvoirs & défis avancés",
  },
  ar: {
    configTitle: "الإعداد",
    rules:       "قواعد اللعبة",
    players:     "اللاعبون",
    start:       "ابدأ اللعبة",
    classic:     "كلاسيكي",
    classicSub:  "٤ قطع — القواعد الكاملة",
    quick:       "سريع",
    quickSub:    "قطعتان — جولة قصيرة",
    master:      "ماستر",
    masterSub:   "قدرات خاصة وتحديات",
  },
} as const;

// ─── Rule config table ────────────────────────────────────────────────────────
const RULES: Array<{ id: Rule; neon: string; cardBg: string }> = [
  { id: "classic", neon: "#1E90FF", cardBg: "linear-gradient(145deg,#040d22 0%,#071a45 100%)" },
  { id: "quick",   neon: "#FFD700", cardBg: "linear-gradient(145deg,#1a1200 0%,#352400 100%)" },
  { id: "master",  neon: "#B44FFF", cardBg: "linear-gradient(145deg,#0e0025 0%,#200048 100%)" },
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

/** Master — Crown with gem peaks and a centre diamond */
function MasterIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="mi-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="mi-g" cx="33%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#ddb8ff"/>
          <stop offset="55%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#160030"/>
        </radialGradient>
      </defs>
      {/* Crown body */}
      <path
        d="M7 41 L7 22 L18 33 L28 9 L38 33 L49 22 L49 41 Z"
        fill="url(#mi-g)"
        stroke={neon} strokeWidth="1.8" strokeLinejoin="round"
        filter="url(#mi-f)"
      />
      {/* Crown band */}
      <rect x="7" y="39" width="42" height="8" rx="2.5"
        fill={neon} opacity="0.50" filter="url(#mi-f)"/>
      {/* Gems on peaks */}
      <circle cx="28" cy="10" r="3.8" fill="white" opacity="0.82" filter="url(#mi-f)"/>
      <circle cx="7"  cy="23" r="2.8" fill={neon}  opacity="0.90" filter="url(#mi-f)"/>
      <circle cx="49" cy="23" r="2.8" fill={neon}  opacity="0.90" filter="url(#mi-f)"/>
      {/* Centre diamond */}
      <polygon points="28,28 32,34 28,40 24,34" fill="white" opacity="0.60" filter="url(#mi-f)"/>
      {/* Side pearls */}
      <circle cx="16" cy="37" r="2.2" fill="white" opacity="0.50"/>
      <circle cx="40" cy="37" r="2.2" fill="white" opacity="0.50"/>
      {/* Specular arc */}
      <path d="M11 26 Q18 18 28 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.28"/>
    </svg>
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

// ─── Main overlay ─────────────────────────────────────────────────────────────
export function GameConfigOverlay({ mode, lang, onClose, onStart }: GameConfigOverlayProps) {
  const [rule,    setRule]    = useState<Rule>("classic");
  const [players, setPlayers] = useState(2);

  const t   = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const ruleLabel = (r: Rule) =>
    r === "classic" ? t.classic : r === "quick" ? t.quick : t.master;
  const ruleSub = (r: Rule) =>
    r === "classic" ? t.classicSub : r === "quick" ? t.quickSub : t.masterSub;
  const ruleIcon = (r: Rule, neon: string) => {
    if (r === "classic") return <ClassicIcon neon={neon}/>;
    if (r === "quick")   return <QuickIcon   neon={neon}/>;
    return                      <MasterIcon  neon={neon}/>;
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
        onClick={onClose}
      />

      {/* ── Sheet ── */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #12082c 0%, #0c1c4c 52%, #081a0a 100%)",
          borderRadius: "28px 28px 0 0",
          boxShadow:
            "0 -16px 56px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.07)",
          maxHeight: "83dvh",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.24 } }}
        transition={{ type: "spring", stiffness: 330, damping: 36 }}
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
            onClick={onClose}
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

          {/* ── RULES SECTION ── */}
          <SectionLabel label={t.rules} neon={mode.neon}/>

          <div className="flex gap-2.5 mb-6">
            {RULES.map((r) => {
              const active = rule === r.id;
              return (
                <motion.button
                  key={r.id}
                  onClick={() => setRule(r.id)}
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
                  {/* Top accent stripe — active only */}
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

                  {/* Corner ambient glow — active only */}
                  {active && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(circle at top left, ${r.neon}18, transparent 65%)` }}
                    />
                  )}

                  {/* Icon */}
                  <motion.div
                    className="w-12 h-12 mb-2.5 relative z-10"
                    animate={
                      active
                        ? {
                            filter: [
                              `drop-shadow(0 0 5px ${r.neon}55)`,
                              `drop-shadow(0 0 12px ${r.neon}88)`,
                              `drop-shadow(0 0 5px ${r.neon}55)`,
                            ],
                          }
                        : { filter: "none" }
                    }
                    transition={{ duration: 2.2, repeat: active ? Infinity : 0 }}
                  >
                    {ruleIcon(r.id, active ? r.neon : "rgba(255,255,255,0.22)")}
                  </motion.div>

                  {/* Name */}
                  <span
                    className="relative z-10 font-heading font-bold text-center leading-tight"
                    style={{
                      fontSize: "12px",
                      letterSpacing: "0.06em",
                      color: active ? "white" : "rgba(255,255,255,0.38)",
                      transition: "color 0.20s",
                    }}
                  >
                    {ruleLabel(r.id)}
                  </span>

                  {/* Sub */}
                  <span
                    className="relative z-10 font-sans text-center leading-tight mt-0.5"
                    style={{
                      fontSize: "8.5px",
                      color: active ? `${r.neon}cc` : "rgba(255,255,255,0.22)",
                      transition: "color 0.20s",
                    }}
                  >
                    {ruleSub(r.id)}
                  </span>

                  {/* Active dot */}
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

          <div className="flex gap-3 justify-center mb-6">
            {[2, 3, 4].map((n) => {
              const active = players === n;
              return (
                <motion.button
                  key={n}
                  onClick={() => setPlayers(n)}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.93 }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl flex-1"
                  style={{
                    height: "82px",
                    background: active
                      ? `${mode.neon}18`
                      : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${active ? mode.neon : "rgba(255,255,255,0.10)"}`,
                    boxShadow: active
                      ? `0 0 22px ${mode.neon}40, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : "none",
                    transition: "all 0.22s ease",
                  }}
                >
                  {/* Active top accent */}
                  {active && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                      style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}
                    />
                  )}

                  {/* Pawn row */}
                  <div className="flex gap-1 items-end">
                    {PLAYER_COLORS.slice(0, n).map((col, i) => (
                      <PawnSilhouette
                        key={i}
                        color={active ? col : "rgba(255,255,255,0.22)"}
                        size={n === 4 ? 9 : 11}
                      />
                    ))}
                  </div>

                  {/* Number */}
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

          {/* ── START CTA ── */}
          <motion.button
            whileHover={{ scale: 1.018, y: -2 }}
            whileTap={{ scale: 0.978 }}
            onClick={() => onStart({ rule, players, modeId: mode.id })}
            className="w-full relative rounded-2xl overflow-hidden"
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

        </div>
      </motion.div>
    </>
  );
}
