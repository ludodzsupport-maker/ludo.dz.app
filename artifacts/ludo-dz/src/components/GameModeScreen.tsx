import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { GamePiece } from "./GamePiece";
import { GameConfigOverlay, type SelectedMode, type GameConfig } from "./GameConfigOverlay";
import { playIconTap, playModeSelect, playNavBack } from "../lib/sound-manager";

interface GameModeScreenProps {
  lang: 'fr' | 'ar';
  onBack: () => void;
  onStart: (config: GameConfig) => void;
}

// ─── Translations ─────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  fr: {
    screenTitle: "Mode de Jeu",
    chooseSub:   "Choisissez comment vous souhaitez jouer",
    back:        "Retour",

    online:        "En Ligne",
    onlineSub:     "Affrontez des joueurs du monde entier en temps réel",
    onlinePlayers: "2–4 joueurs",
    onlineTag:     "POPULAIRE",

    teamup:        "Équipe",
    teamupSub:     "2 vs 2 en alliance",
    teamupPlayers: "4 joueurs",
    teamupTag:     "CHAUD",

    friends:        "Amis",
    friendsSub:     "Invitez et jouez entre amis",
    friendsPlayers: "2–4 joueurs",
    friendsTag:     "INVITER",

    computer:        "Ordinateur",
    computerSub:     "Défie l'intelligence artificielle",
    computerPlayers: "1–3 joueurs",
    computerTag:     "IA",

    passnplay:        "Tour par Tour",
    passnplaySub:     "Même appareil, plusieurs joueurs",
    passnplayPlayers: "2–4 joueurs",
    passnplayTag:          "LOCAL",
    wip:                   "En développement",
    comingSoonTitle:       "Bientôt disponible",
    comingSoonOnlineSub:   "Le mode En Ligne vous permettra d'affronter des joueurs du monde entier en temps réel. Restez connectés !",
    comingSoonFriendsSub:  "Le mode Amis vous permettra d'inviter vos proches et de jouer ensemble. Bientôt disponible !",
    comingSoonClose:       "Compris",
  },
  ar: {
    screenTitle: "وضع اللعب",
    chooseSub:   "اختر طريقة لعبك المفضلة",
    back:        "رجوع",

    online:        "أون لاين",
    onlineSub:     "العب مع لاعبين من كل العالم في الوقت الحقيقي",
    onlinePlayers: "٢–٤ لاعبين",
    onlineTag:     "شائع",

    teamup:        "فريق",
    teamupSub:     "٢ ضد ٢ بالتحالف",
    teamupPlayers: "٤ لاعبين",
    teamupTag:     "رائج",

    friends:        "الأصدقاء",
    friendsSub:     "ادعُ أصدقاءك والعب معهم",
    friendsPlayers: "٢–٤ لاعبين",
    friendsTag:     "دعوة",

    computer:        "كمبيوتر",
    computerSub:     "تحدَّ الذكاء الاصطناعي",
    computerPlayers: "١–٣ لاعبين",
    computerTag:     "ذكاء",

    passnplay:        "تمرير واللعب",
    passnplaySub:     "نفس الجهاز، عدة لاعبين",
    passnplayPlayers: "٢–٤ لاعبين",
    passnplayTag:          "محلي",
    wip:                   "قيد التطوير",
    comingSoonTitle:       "قريباً",
    comingSoonOnlineSub:   "سيتيح لك وضع أون لاين مواجهة لاعبين من جميع أنحاء العالم في الوقت الحقيقي. ترقّبوا!",
    comingSoonFriendsSub:  "سيتيح لك وضع الأصدقاء دعوة أصدقائك واللعب معهم معاً. قريباً!",
    comingSoonClose:       "حسناً",
  },
} as const;

// ─── SVG Icon: Online Globe ───────────────────────────────────────────────────
function OnlineIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="og-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="og-g" cx="32%" cy="24%" r="72%">
          <stop offset="0%"   stopColor="#8ec8ff"/>
          <stop offset="48%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#001840"/>
        </radialGradient>
      </defs>
      {/* Globe body */}
      <circle cx="32" cy="37" r="21" fill="url(#og-g)" stroke={neon} strokeWidth="2" filter="url(#og-f)"/>
      {/* Latitude arcs */}
      <ellipse cx="32" cy="37" rx="21" ry="8"  fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
      <ellipse cx="32" cy="29" rx="15" ry="5"  fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.9"/>
      <ellipse cx="32" cy="45" rx="15" ry="5"  fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.9"/>
      {/* Meridian */}
      <line x1="32" y1="16" x2="32" y2="58" stroke="rgba(255,255,255,0.30)" strokeWidth="1"/>
      {/* Broadcast arcs */}
      <path d="M 20 14 Q 32 8 44 14" stroke={neon} strokeWidth="2.5" fill="none" strokeLinecap="round" filter="url(#og-f)"/>
      <path d="M 24  9 Q 32 4 40  9" stroke={neon} strokeWidth="2"   fill="none" strokeLinecap="round" filter="url(#og-f)"/>
      <circle cx="32" cy="5" r="2.8" fill={neon} filter="url(#og-f)"/>
      {/* Specular gloss */}
      <ellipse cx="24" cy="28" rx="5.5" ry="3.5" fill="white" opacity="0.28" transform="rotate(-20 24 28)"/>
    </svg>
  );
}

// ─── SVG Icon: Team Up ────────────────────────────────────────────────────────
function TeamUpIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
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
      <g transform="translate(-2,6) scale(0.78)">
        <path d="M 14 54 Q 17 44 20 36 Q 20 29 24 25 Q 28 29 28 36 Q 31 44 34 54 Q 39 54 39 60 L 9 60 Q 9 54 14 54 Z"
          fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" strokeLinejoin="round" filter="url(#tu-f)"/>
        <circle cx="24" cy="25" r="12" fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" filter="url(#tu-f)"/>
        <ellipse cx="19" cy="19" rx="4.5" ry="3" fill="white" opacity="0.36" transform="rotate(-15 19 19)"/>
      </g>
      {/* Right pawn */}
      <g transform="translate(26,6) scale(0.78)">
        <path d="M 14 54 Q 17 44 20 36 Q 20 29 24 25 Q 28 29 28 36 Q 31 44 34 54 Q 39 54 39 60 L 9 60 Q 9 54 14 54 Z"
          fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" strokeLinejoin="round" filter="url(#tu-f)"/>
        <circle cx="24" cy="25" r="12" fill="url(#tu-g)" stroke={neon} strokeWidth="1.5" filter="url(#tu-f)"/>
        <ellipse cx="19" cy="19" rx="4.5" ry="3" fill="white" opacity="0.36" transform="rotate(-15 19 19)"/>
      </g>
      {/* Connecting arc */}
      <path d="M 17 9 Q 32 1 47 9" stroke={neon} strokeWidth="2.8" fill="none" strokeLinecap="round" filter="url(#tu-f)"/>
      {/* Center VS badge */}
      <circle cx="32" cy="40" r="9" fill="#200005" stroke={neon} strokeWidth="1.8" filter="url(#tu-f)"/>
      <text x="32" y="44.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif" letterSpacing="1">VS</text>
    </svg>
  );
}

// ─── SVG Icon: Friends ────────────────────────────────────────────────────────
function FriendsIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="fr-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="fr-g" cx="33%" cy="22%" r="70%">
          <stop offset="0%"   stopColor="#fff8c0"/>
          <stop offset="48%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#4a3000"/>
        </radialGradient>
      </defs>
      {/* Shadow pawn (right/back) */}
      <g transform="translate(18,8) scale(0.74)" opacity="0.65">
        <path d="M 14 54 Q 17 44 20 36 Q 20 29 24 25 Q 28 29 28 36 Q 31 44 34 54 Q 39 54 39 60 L 9 60 Q 9 54 14 54 Z"
          fill="url(#fr-g)" stroke={neon} strokeWidth="1" strokeLinejoin="round"/>
        <circle cx="24" cy="25" r="12" fill="url(#fr-g)" stroke={neon} strokeWidth="1"/>
      </g>
      {/* Main pawn (left/front) */}
      <g transform="translate(2,4) scale(0.80)">
        <path d="M 14 54 Q 17 44 20 36 Q 20 29 24 25 Q 28 29 28 36 Q 31 44 34 54 Q 39 54 39 60 L 9 60 Q 9 54 14 54 Z"
          fill="url(#fr-g)" stroke={neon} strokeWidth="2" strokeLinejoin="round" filter="url(#fr-f)"/>
        <circle cx="24" cy="25" r="12" fill="url(#fr-g)" stroke={neon} strokeWidth="2" filter="url(#fr-f)"/>
        <ellipse cx="19" cy="19" rx="5" ry="3" fill="white" opacity="0.38" transform="rotate(-15 19 19)"/>
      </g>
      {/* Invite star badge (top-right) */}
      <circle cx="50" cy="14" r="10" fill="#1c1200" stroke={neon} strokeWidth="1.8" filter="url(#fr-f)"/>
      <polygon
        points="50,8 51.8,12.2 56.2,12.5 53,15.2 54.1,19.4 50,17 45.9,19.4 47,15.2 43.8,12.5 48.2,12.2"
        fill={neon} opacity="0.95"/>
      {/* Plus badge (bottom-right) */}
      <circle cx="50" cy="48" r="9" fill="#1c1200" stroke={neon} strokeWidth="1.8" filter="url(#fr-f)"/>
      <line x1="50" y1="43" x2="50" y2="53" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="45" y1="48" x2="55" y2="48" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── SVG Icon: Computer / AI ──────────────────────────────────────────────────
function ComputerIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="cp-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="cp-g" cx="32%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#bbffee"/>
          <stop offset="50%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#002222"/>
        </radialGradient>
      </defs>
      {/* Pawn body */}
      <path d="M 17 58 Q 20 48 23 40 Q 23 33 28 29 Q 32 33 36 33 Q 41 29 41 40 Q 44 48 47 58 Q 54 58 54 63 L 10 63 Q 10 58 17 58 Z"
        fill="url(#cp-g)" stroke={neon} strokeWidth="2" strokeLinejoin="round" filter="url(#cp-f)"/>
      {/* Pawn head */}
      <circle cx="32" cy="29" r="16" fill="url(#cp-g)" stroke={neon} strokeWidth="2" filter="url(#cp-f)"/>
      {/* Specular gloss */}
      <ellipse cx="25" cy="22" rx="5.5" ry="3.5" fill="white" opacity="0.30" transform="rotate(-15 25 22)"/>
      {/* LED rectangular eyes */}
      <rect x="23" y="25" width="8"  height="5" rx="2" fill={neon} filter="url(#cp-f)"/>
      <rect x="33" y="25" width="8"  height="5" rx="2" fill={neon} filter="url(#cp-f)"/>
      {/* Scan line across eyes */}
      <line x1="25" y1="27.5" x2="39" y2="27.5" stroke="white" strokeWidth="0.8" opacity="0.55"/>
      {/* Progress-bar mouth */}
      <rect x="24" y="34" width="16" height="3.5" rx="1.5" fill="none" stroke={neon} strokeWidth="1.3" opacity="0.75"/>
      <rect x="24" y="34" width="10" height="3.5" rx="1.5" fill={neon} opacity="0.65"/>
      {/* Circuit traces on body */}
      <line x1="21" y1="43" x2="28" y2="43" stroke={neon} strokeWidth="1.3" opacity="0.70"/>
      <line x1="28" y1="43" x2="28" y2="50" stroke={neon} strokeWidth="1.3" opacity="0.70"/>
      <line x1="28" y1="50" x2="37" y2="50" stroke={neon} strokeWidth="1.3" opacity="0.70"/>
      <line x1="37" y1="50" x2="37" y2="43" stroke={neon} strokeWidth="1.3" opacity="0.70"/>
      <circle cx="21" cy="43" r="2.2" fill={neon} filter="url(#cp-f)" opacity="0.90"/>
      <circle cx="28" cy="50" r="2.2" fill={neon} filter="url(#cp-f)" opacity="0.90"/>
      <circle cx="44" cy="45" r="1.8" fill={neon} filter="url(#cp-f)" opacity="0.80"/>
    </svg>
  );
}

// ─── SVG Icon: Pass n Play ────────────────────────────────────────────────────
function PassPlayIcon({ neon }: { neon: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <filter id="pp-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="pp-g" cx="30%" cy="25%" r="72%">
          <stop offset="0%"   stopColor="#ddbbff"/>
          <stop offset="52%"  stopColor={neon}/>
          <stop offset="100%" stopColor="#150030"/>
        </radialGradient>
      </defs>
      {/* Back die — compact and lightly offset for a clear two-player cue. */}
      <g transform="rotate(9 42 25)">
        <rect x="28" y="11" width="23" height="23" rx="6"
          fill="url(#pp-g)" stroke={neon} strokeWidth="1.8" filter="url(#pp-f)"/>
        <rect x="30.4" y="13.2" width="16.5" height="6.3" rx="3.1"
          fill="white" opacity="0.18"/>
        <circle cx="35" cy="18" r="2.05" fill="#F8ECFF"/>
        <circle cx="44" cy="18" r="2.05" fill="#F8ECFF"/>
        <circle cx="35" cy="27" r="2.05" fill="#F8ECFF"/>
        <circle cx="44" cy="27" r="2.05" fill="#F8ECFF"/>
      </g>
      {/* Foreground die — dominant but centered within the shared icon canvas. */}
      <g transform="rotate(-9 24 39)">
        <rect x="12" y="27" width="25" height="25" rx="6.5"
          fill="url(#pp-g)" stroke={neon} strokeWidth="2" filter="url(#pp-f)"/>
        <rect x="14.6" y="29.6" width="18.2" height="6.7" rx="3.3"
          fill="white" opacity="0.20"/>
        <circle cx="19.5" cy="34.5" r="2.15" fill="#FFF7FF"/>
        <circle cx="29.5" cy="34.5" r="2.15" fill="#FFF7FF"/>
        <circle cx="24.5" cy="39.5" r="2.15" fill="#FFF7FF"/>
        <circle cx="19.5" cy="44.5" r="2.15" fill="#FFF7FF"/>
        <circle cx="29.5" cy="44.5" r="2.15" fill="#FFF7FF"/>
      </g>
      {/* Fine shared glint, matching the neighboring icons' restrained detail. */}
      <circle cx="51" cy="42" r="2.2" fill={neon} opacity="0.72" filter="url(#pp-f)"/>
      <path d="M51 37.5V46.5M46.5 42H55.5" stroke="#F8ECFF" strokeWidth="1.15"
        strokeLinecap="round" opacity="0.90"/>
    </svg>
  );
}

// ─── Board Watermark (same as WelcomeScreen) ──────────────────────────────────
function BoardWatermark() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="flex flex-1">
          {Array.from({ length: 15 }).map((_, j) => {
            const isCenter = i >= 6 && i <= 8 && j >= 6 && j <= 8;
            const isHome   = (i < 6 && j < 6) || (i < 6 && j > 8) || (i > 8 && j < 6) || (i > 8 && j > 8);
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

// ─── Mode definitions ─────────────────────────────────────────────────────────
interface ModeConfig {
  id: string;
  neon:     string;
  cardBg:   string;   // CSS gradient string for card fill
  tagColor: string;   // bg colour for the tag pill
  featured?: true;
  wip?: true;
  Icon: React.FC<{ neon: string }>;
}

const MODES: ModeConfig[] = [
  {
    id: "online",
    neon:     "#1E90FF",
    cardBg:   "linear-gradient(145deg,#040d22 0%,#071a45 100%)",
    tagColor: "#DC143C",
    featured: true,
    wip: true,
    Icon: OnlineIcon,
  },
  {
    id: "teamup",
    neon:     "#FF2855",
    cardBg:   "linear-gradient(145deg,#180008 0%,#32000f 100%)",
    tagColor: "#FF2855",
    Icon: TeamUpIcon,
  },
  {
    id: "friends",
    neon:     "#FFD700",
    cardBg:   "linear-gradient(145deg,#1a1200 0%,#352400 100%)",
    tagColor: "#CC8800",
    wip: true,
    Icon: FriendsIcon,
  },
  {
    id: "computer",
    neon:     "#00FFEE",
    cardBg:   "linear-gradient(145deg,#001818 0%,#003030 100%)",
    tagColor: "#008888",
    Icon: ComputerIcon,
  },
  {
    id: "passnplay",
    neon:     "#B44FFF",
    cardBg:   "linear-gradient(145deg,#0e0025 0%,#200048 100%)",
    tagColor: "#7A22BB",
    Icon: PassPlayIcon,
  },
];

// ─── Animation variants ────────────────────────────────────────────────────────
const screenVariants = {
  hidden:  { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] }
  },
  exit:    { opacity: 0, x: -60,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] }
  },
};

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.18 } },
};

const cardVariants = {
  hidden:  { y: 32, opacity: 0, scale: 0.97 },
  visible: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 22 },
  },
};

// ─── Featured Card ─────────────────────────────────────────────────────────────
function FeaturedCard({ mode, t, onClick }: {
  mode: ModeConfig;
  t: typeof TRANSLATIONS[keyof typeof TRANSLATIONS];
  onClick: () => void;
}) {
  const label    = t[`${mode.id}` as keyof typeof t] as string;
  const sub      = t[`${mode.id}Sub` as keyof typeof t] as string;
  const players  = t[`${mode.id}Players` as keyof typeof t] as string;
  const tag      = t[`${mode.id}Tag` as keyof typeof t] as string;

  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ scale: 1.018, y: -3 }}
      whileTap={{ scale: 0.975 }}
      onClick={onClick}
      className="w-full rounded-2xl overflow-hidden relative cursor-pointer text-left"
      style={{
        background: mode.cardBg,
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${mode.neon}40, inset 0 1px 0 rgba(255,255,255,0.07)`,
        minHeight: "178px",
      }}
    >
      {/* Top accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}/>

      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.055) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["200% 0", "-100% 0"] }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
      />

      {/* Corner glow */}
      <div className="absolute top-0 left-0 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at top left, ${mode.neon}1a, transparent 70%)`,
        }}/>

      {/* WIP badge */}
      {mode.wip && (
        <div
          className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full font-heading font-semibold pointer-events-none"
          style={{
            fontSize: "9px",
            letterSpacing: "0.05em",
            background: "rgba(0,0,0,0.38)",
            border: "1px solid rgba(255,255,255,0.13)",
            color: "rgba(255,255,255,0.42)",
            backdropFilter: "blur(6px)",
          }}
        >
          {t.wip}
        </div>
      )}

      {/* Inner layout */}
      <div className="relative z-10 flex items-center gap-5 px-5 py-5">
        {/* Icon */}
        <motion.div
          className="flex-shrink-0 w-[72px] h-[72px] rounded-xl flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${mode.neon}18 0%, transparent 75%)`,
            boxShadow: `0 0 22px ${mode.neon}40`,
          }}
          animate={{ boxShadow: [`0 0 18px ${mode.neon}38`, `0 0 30px ${mode.neon}55`, `0 0 18px ${mode.neon}38`] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-[54px] h-[54px]">
            <mode.Icon neon={mode.neon}/>
          </div>
        </motion.div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          {/* Tag row */}
          <div className="flex items-center gap-2 mb-1.5">
            {/* Live dot */}
            <motion.span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "#FF2855" }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
            <span
              className="text-[10px] font-heading font-bold uppercase px-2 py-0.5 rounded-full"
              style={{
                background: `${mode.tagColor}33`,
                color: mode.neon,
                border: `1px solid ${mode.neon}40`,
                letterSpacing: "0.14em",
              }}
            >
              {tag}
            </span>
          </div>

          {/* Mode name */}
          <h2
            className="font-heading font-bold text-white leading-none mb-1.5"
            style={{ fontSize: "clamp(22px, 6vw, 28px)", letterSpacing: "0.06em" }}
          >
            {label}
          </h2>

          {/* Subtitle */}
          <p className="text-white/60 font-sans leading-snug"
            style={{ fontSize: "clamp(11px, 3vw, 13px)", fontWeight: 400 }}>
            {sub}
          </p>

          {/* Players badge */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <svg viewBox="0 0 16 12" width="14" height="10" fill="none">
              <circle cx="5"  cy="5" r="4" fill={mode.neon} opacity="0.70"/>
              <circle cx="11" cy="5" r="4" fill={mode.neon} opacity="0.50"/>
            </svg>
            <span className="text-[11px] font-heading font-semibold"
              style={{ color: `${mode.neon}cc`, letterSpacing: "0.10em" }}>
              {players}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: `${mode.neon}20`, border: `1px solid ${mode.neon}40` }}>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M 4 2 L 8 6 L 4 10" stroke={mode.neon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function GridCard({ mode, t, onClick }: {
  mode: ModeConfig;
  t: typeof TRANSLATIONS[keyof typeof TRANSLATIONS];
  onClick: () => void;
}) {
  const label   = t[`${mode.id}` as keyof typeof t] as string;
  const sub     = t[`${mode.id}Sub` as keyof typeof t] as string;
  const players = t[`${mode.id}Players` as keyof typeof t] as string;
  const tag     = t[`${mode.id}Tag` as keyof typeof t] as string;

  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-2xl overflow-hidden relative cursor-pointer text-left flex flex-col"
      style={{
        background: mode.cardBg,
        boxShadow: `0 6px 24px rgba(0,0,0,0.50), 0 0 0 1px ${mode.neon}38, inset 0 1px 0 rgba(255,255,255,0.06)`,
        minHeight: "168px",
      }}
    >
      {/* Top accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}/>

      {/* Corner ambient glow */}
      <div className="absolute top-0 left-0 w-28 h-28 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at top left, ${mode.neon}18, transparent 70%)`,
        }}/>

      {/* WIP badge */}
      {mode.wip && (
        <div
          className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded-full font-heading font-semibold pointer-events-none"
          style={{
            fontSize: "8px",
            letterSpacing: "0.04em",
            background: "rgba(0,0,0,0.38)",
            border: "1px solid rgba(255,255,255,0.13)",
            color: "rgba(255,255,255,0.42)",
            backdropFilter: "blur(6px)",
          }}
        >
          {t.wip}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-3 pt-5 pb-4">
        {/* Icon */}
        <motion.div
          className="w-[52px] h-[52px] rounded-xl flex items-center justify-center mb-2"
          style={{
            background: `radial-gradient(circle, ${mode.neon}18, transparent 75%)`,
            boxShadow: `0 0 16px ${mode.neon}35`,
          }}
          animate={{ boxShadow: [`0 0 12px ${mode.neon}30`, `0 0 22px ${mode.neon}50`, `0 0 12px ${mode.neon}30`] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-[38px] h-[38px]">
            <mode.Icon neon={mode.neon}/>
          </div>
        </motion.div>

        {/* Label */}
        <h3
          className="font-heading font-bold text-white text-center leading-tight mb-0.5"
          style={{ fontSize: "clamp(14px, 4vw, 17px)", letterSpacing: "0.05em" }}
        >
          {label}
        </h3>

        {/* Sub */}
        <p className="text-white/50 font-sans text-center leading-tight mb-2"
          style={{ fontSize: "10px", fontWeight: 400 }}>
          {sub}
        </p>

        {/* Bottom badges row */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span
            className="text-[9px] font-heading font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: `${mode.neon}20`,
              color: mode.neon,
              border: `1px solid ${mode.neon}35`,
              letterSpacing: "0.12em",
            }}
          >
            {tag}
          </span>
          <span
            className="text-[9px] font-heading uppercase px-2 py-0.5 rounded-full"
            style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.07)", letterSpacing: "0.08em" }}
          >
            {players}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Coming Soon Popup ────────────────────────────────────────────────────────
function ComingSoonPopup({
  modeId, t, onClose,
}: {
  modeId: string;
  t: typeof TRANSLATIONS[keyof typeof TRANSLATIONS];
  onClose: () => void;
}) {
  const mode = MODES.find(m => m.id === modeId)!;
  const isOnline = modeId === "online";

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
        onClick={() => { playIconTap(); onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)" }}
      />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-xs rounded-3xl overflow-hidden"
        initial={{ scale: 0.88, y: 28, opacity: 0 }}
        animate={{ scale: 1,    y:  0, opacity: 1 }}
        exit={{    scale: 0.88, y: 28, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: mode.cardBg,
          boxShadow: `0 24px 64px rgba(0,0,0,0.72), 0 0 0 1px ${mode.neon}40`,
        }}
      >
        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent)` }}
        />

        {/* Corner glow */}
        <div
          className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle at top left, ${mode.neon}16, transparent 65%)` }}
        />

        {/* Close button */}
        <button
          onClick={() => { playIconTap(); onClose(); }}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}
          aria-label="close"
        >
          <X className="w-4 h-4 text-white/50" />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-7 gap-4">

          {/* Themed icon */}
          <motion.div
            className="w-[84px] h-[84px] rounded-2xl flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${mode.neon}18, transparent 75%)`,
              border: `1px solid ${mode.neon}30`,
            }}
            animate={{
              boxShadow: [
                `0 0 22px ${mode.neon}35`,
                `0 0 44px ${mode.neon}58`,
                `0 0 22px ${mode.neon}35`,
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-[58px] h-[58px]">
              {isOnline ? <OnlineIcon neon={mode.neon} /> : <FriendsIcon neon={mode.neon} />}
            </div>
          </motion.div>

          {/* WIP pill */}
          <div
            className="px-3 py-1 rounded-full font-heading font-bold uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.18em",
              background: `${mode.neon}18`,
              color: mode.neon,
              border: `1px solid ${mode.neon}38`,
            }}
          >
            {t.wip}
          </div>

          {/* Title */}
          <h2
            className="font-heading font-bold text-white text-center leading-none"
            style={{
              fontSize: "clamp(22px, 6vw, 26px)",
              letterSpacing: "0.08em",
              textShadow: `0 0 24px ${mode.neon}55`,
            }}
          >
            {t.comingSoonTitle}
          </h2>

          {/* Neon rule */}
          <div className="flex items-center gap-2 w-40">
            <div className="h-px flex-1"
              style={{ background: `linear-gradient(90deg, transparent, ${mode.neon}60)` }}/>
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: mode.neon }}
              animate={{ boxShadow: [`0 0 5px ${mode.neon}`, `0 0 12px ${mode.neon}`, `0 0 5px ${mode.neon}`] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <div className="h-px flex-1"
              style={{ background: `linear-gradient(270deg, transparent, ${mode.neon}60)` }}/>
          </div>

          {/* Subtitle */}
          <p
            className="text-white/55 font-sans text-center leading-relaxed"
            style={{ fontSize: "12px" }}
          >
            {isOnline ? t.comingSoonOnlineSub : t.comingSoonFriendsSub}
          </p>

          {/* Dismiss button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { playIconTap(); onClose(); }}
            className="w-full rounded-xl py-3 font-heading font-bold mt-1"
            style={{
              background: `linear-gradient(135deg, ${mode.neon}28, ${mode.neon}14)`,
              border: `1px solid ${mode.neon}44`,
              color: mode.neon,
              letterSpacing: "0.10em",
              fontSize: "13px",
              boxShadow: `0 0 18px ${mode.neon}20`,
            }}
          >
            {t.comingSoonClose}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function GameModeScreen({ lang, onBack, onStart }: GameModeScreenProps) {
  const t = TRANSLATIONS[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const featured = MODES.find(m => m.featured)!;
  const grid     = MODES.filter(m => !m.featured);

  const [selectedMode, setSelectedMode] = useState<SelectedMode | null>(null);
  const [wipMode,      setWipMode]      = useState<string | null>(null);

  const handleModeSelect = (modeId: string) => {
    playModeSelect();
    const mode = MODES.find(m => m.id === modeId);
    if (!mode) return;
    if (mode.wip) {
      setWipMode(modeId);
      return;
    }
    setSelectedMode({
      id:    mode.id,
      neon:  mode.neon,
      label: t[modeId as keyof typeof t] as string,
    });
  };

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

      {/* Floating background pieces */}
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

      {/* ── Header ── */}
      <motion.div
        className="relative z-20 flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1,  y:   0 }}
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
            {t.screenTitle}
          </h1>
          <p className="text-white/50 font-sans mt-0.5" style={{ fontSize: "11px" }}>
            {t.chooseSub}
          </p>
        </div>

        {/* Ludo DZ micro-logo */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-[8px] font-heading font-bold text-white/80" style={{ letterSpacing: "0.05em" }}>DZ</span>
          </div>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="relative z-20 mx-5 h-px flex-shrink-0"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}/>

      {/* ── Scrollable card area ── */}
      <div className="relative z-20 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <motion.div
          className="flex flex-col gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Featured — Online */}
          <FeaturedCard
            mode={featured}
            t={t}
            onClick={() => handleModeSelect(featured.id)}
          />

          {/* Grid — 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            {grid.map(mode => (
              <GridCard
                key={mode.id}
                mode={mode}
                t={t}
                onClick={() => handleModeSelect(mode.id)}
              />
            ))}
          </div>

          {/* Bottom breathing room */}
          <div className="h-4"/>
        </motion.div>
      </div>

      {/* ── Game Config Overlay (non-WIP modes) ── */}
      <AnimatePresence>
        {selectedMode && (
          <GameConfigOverlay
            key="config-overlay"
            mode={selectedMode}
            lang={lang}
            onClose={() => setSelectedMode(null)}
            onStart={(config: GameConfig) => {
              setSelectedMode(null);
              onStart(config);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Coming Soon Popup (WIP modes) ── */}
      <AnimatePresence>
        {wipMode && (
          <ComingSoonPopup
            key="coming-soon"
            modeId={wipMode}
            t={t}
            onClose={() => setWipMode(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
