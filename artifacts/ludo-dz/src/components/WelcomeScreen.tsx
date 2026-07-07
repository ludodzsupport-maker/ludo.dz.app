import { useId } from "react";
import { motion } from "framer-motion";
import { GamePiece } from "./GamePiece";
import { Play, Settings, Trophy, Info } from "lucide-react";

interface WelcomeScreenProps {
  lang: 'fr' | 'ar';
  onPlay?: () => void;
  onSettings?: () => void;
}

export function WelcomeScreen({ lang, onPlay, onSettings }: WelcomeScreenProps) {
  const logoPath = import.meta.env.BASE_URL + 'ludo-logo.png';
  const clipId = useId();
  const pfxId  = useId();

  const t = {
    play:        lang === 'fr' ? 'Jouer'      : 'العب',
    settings:    lang === 'fr' ? 'Paramètres' : 'إعدادات',
    leaderboard: lang === 'fr' ? 'Classement' : 'التصنيف',
    about:       lang === 'fr' ? 'À propos'   : 'حول',
    welcome:     lang === 'fr' ? 'Bienvenue'  : 'مرحباً',
    tagline:     lang === 'fr' ? 'Jeu de Société Algérien' : 'لعبة الجزائر',
  };

  const renderBoardWatermark = () => (
    <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={`row-${i}`} className="flex flex-1">
          {Array.from({ length: 15 }).map((_, j) => {
            const isCenter = i >= 6 && i <= 8 && j >= 6 && j <= 8;
            const isHome =
              (i < 6 && j < 6) || (i < 6 && j > 8) ||
              (i > 8 && j < 6) || (i > 8 && j > 8);
            let bg = "border border-white/20";
            if (isCenter)  bg = "bg-white/40 border border-white/20";
            else if (isHome) bg = "border-2 border-white/30";
            return <div key={`cell-${i}-${j}`} className={`flex-1 ${bg}`} />;
          })}
        </div>
      ))}
    </div>
  );

  const containerVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };
  const itemVariants = {
    hidden:  { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 20 } },
  };

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#1E90FF] to-[#006233]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5 }}
    >
      {renderBoardWatermark()}

      {/* Floating Background Pieces */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-10 -left-10 opacity-30 w-32 h-32 blur-[2px]"
          animate={{ y: [0, 40, 0], rotate: [0, 45, 0], x: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#DC143C" />
        </motion.div>
        <motion.div
          className="absolute top-1/4 -right-16 opacity-20 w-40 h-40 blur-[3px]"
          animate={{ y: [0, -50, 0], rotate: [0, -30, 0], x: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <GamePiece color="#FFD700" />
        </motion.div>
        <motion.div
          className="absolute bottom-1/4 -left-12 opacity-40 w-28 h-28 blur-[1px]"
          animate={{ y: [0, 30, 0], rotate: [0, 60, 0], x: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full w-full py-8 px-6 overflow-y-auto">

        {/* Top Section */}
        <motion.div
          className="flex flex-col items-center pt-8"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-end justify-center mb-4" style={{ gap: "clamp(6px, 3vw, 12px)" }}>

            {/* LEFT — Female Algerian pawn */}
            <motion.div
              className="flex-shrink-0"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              style={{ width: "clamp(48px, 14vw, 62px)", height: "clamp(72px, 21vw, 93px)" }}
            >
              <svg width="100%" height="100%" viewBox="0 0 100 155" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <clipPath id={clipId}><circle cx="50" cy="40" r="27"/></clipPath>
                  <filter id={`${pfxId}-shad`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4"/>
                  </filter>
                  <filter id={`${pfxId}-neon`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/></feMerge>
                  </filter>
                  <filter id={`${pfxId}-sf`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <radialGradient id={`${pfxId}-bod`} cx="33%" cy="22%" r="75%">
                    <stop offset="0%"   stopColor="#6EE89A"/>
                    <stop offset="42%"  stopColor="#00A550"/>
                    <stop offset="100%" stopColor="#003318"/>
                  </radialGradient>
                  <radialGradient id={`${pfxId}-hd`} cx="38%" cy="30%" r="68%">
                    <stop offset="0%"   stopColor="#7AEEAA"/>
                    <stop offset="45%"  stopColor="#00A550"/>
                    <stop offset="100%" stopColor="#002e14"/>
                  </radialGradient>
                  <radialGradient id={`${pfxId}-sg`} cx="38%" cy="28%" r="68%">
                    <stop offset="0%"   stopColor="#FFFDE0"/>
                    <stop offset="35%"  stopColor="#FFD700"/>
                    <stop offset="100%" stopColor="#9A6200"/>
                  </radialGradient>
                </defs>
                <ellipse cx="50" cy="151" rx="34" ry="5.5" fill="#000" opacity="0.45" filter={`url(#${pfxId}-shad)`}/>
                <ellipse cx="50" cy="150" rx="22" ry="3"   fill="#000" opacity="0.25"/>
                <path d="M 25 130 Q 30 100 40 70 Q 40 50 50 40 Q 60 50 60 70 Q 70 100 75 130 Q 90 130 90 145 L 10 145 Q 10 130 25 130 Z"
                  fill="#000" opacity="0.32" filter={`url(#${pfxId}-shad)`} transform="translate(5,7)"/>
                <circle cx="55" cy="47" r="28" fill="#000" opacity="0.28" filter={`url(#${pfxId}-shad)`}/>
                <motion.g animate={{ opacity: [0.45, 0.95, 0.45] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
                  <path d="M 25 130 Q 30 100 40 70 Q 40 50 50 40 Q 60 50 60 70 Q 70 100 75 130 Q 90 130 90 145 L 10 145 Q 10 130 25 130 Z"
                    fill="none" stroke="#39FF14" strokeWidth="8" strokeLinejoin="round" filter={`url(#${pfxId}-neon)`}/>
                  <circle cx="50" cy="40" r="32" fill="none" stroke="#39FF14" strokeWidth="8" filter={`url(#${pfxId}-neon)`}/>
                </motion.g>
                <g stroke="rgba(0,0,0,0.20)" strokeWidth="2.5" strokeLinejoin="round">
                  <path d="M 25 130 Q 30 100 40 70 Q 40 50 50 40 Q 60 50 60 70 Q 70 100 75 130 Q 90 130 90 145 L 10 145 Q 10 130 25 130 Z" fill={`url(#${pfxId}-bod)`}/>
                  <circle cx="50" cy="40" r="28" fill={`url(#${pfxId}-hd)`}/>
                </g>
                <path d="M 33 72 Q 31 93 30 118" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.20"/>
                <path d="M 38 70 Q 40 50 48 43"  stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.42"/>
                <path d="M 25 130 C 35 125, 65 125, 75 130" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.38"/>
                <path d="M 15 140 L 85 140"       stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.26"/>
                <path d="M 72 76 Q 76 96 74 122"  stroke="#6EE89A" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.32"/>
                <ellipse cx="40" cy="29" rx="10" ry="7" fill="white" opacity="0.42" transform="rotate(-18 40 29)"/>
                <circle cx="37" cy="25" r="3.5" fill="white" opacity="0.32"/>
                <path d="M 73 33 Q 77 41 75 53" stroke="#6EE89A" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.26"/>
                <path d="M 23 42 Q 50 7 77 42 Q 68 22 50 17 Q 32 22 23 42Z" fill="white" opacity="0.90" clipPath={`url(#${clipId})`}/>
                <path d="M 27 35 Q 50 16 73 35" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45" clipPath={`url(#${clipId})`}/>
                <ellipse cx="38" cy="45" rx="5.5" ry="6.5" fill="white"/>
                <ellipse cx="62" cy="45" rx="5.5" ry="6.5" fill="white"/>
                <circle cx="39"   cy="46"   r="3.8" fill="#1a1a2e"/>
                <circle cx="63"   cy="46"   r="3.8" fill="#1a1a2e"/>
                <circle cx="40.5" cy="44.5" r="1.5" fill="white"/>
                <circle cx="64.5" cy="44.5" r="1.5" fill="white"/>
                <line x1="33" y1="39" x2="30" y2="34" stroke="#1a1a2e" strokeWidth="2"   strokeLinecap="round"/>
                <line x1="37" y1="38" x2="36" y2="33" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="67" y1="39" x2="70" y2="34" stroke="#1a1a2e" strokeWidth="2"   strokeLinecap="round"/>
                <line x1="63" y1="38" x2="64" y2="33" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M 40 55 Q 50 63 60 55" stroke="#1a1a2e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <motion.g animate={{ opacity: [0.80, 1, 0.80] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}>
                  <circle cx="50" cy="79" r="12"   fill="#001408" opacity="0.80"/>
                  <circle cx="50" cy="79" r="10.5" fill="#002210" opacity="0.55"/>
                  <polygon points="50,70 52.35,75.76 58.56,76.22 53.80,80.24 55.29,86.28 50,83 44.71,86.28 46.20,80.24 41.44,76.22 47.65,75.76"
                    fill="#FFD700" filter={`url(#${pfxId}-sf)`} opacity="0.70"/>
                  <polygon points="50,70 52.35,75.76 58.56,76.22 53.80,80.24 55.29,86.28 50,83 44.71,86.28 46.20,80.24 41.44,76.22 47.65,75.76"
                    fill={`url(#${pfxId}-sg)`} stroke="#8A5C00" strokeWidth="0.7"/>
                  <polygon points="50,71.8 51.6,76.2 56.0,76.5 52.9,78.9 54.0,83.0 50,80.4 46.0,83.0 47.1,78.9 44.0,76.5 48.4,76.2"
                    fill="white" opacity="0.30"/>
                  <circle cx="50" cy="78.5" r="1.8" fill="white" opacity="0.88"/>
                </motion.g>
              </svg>
            </motion.div>

            {/* CENTER — Logo */}
            <div className="relative w-36 h-36 flex-shrink-0">
              <div className="absolute inset-0 bg-white/20 rounded-[2rem] rotate-6 blur-sm"/>
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-[2rem] border border-white/40 shadow-2xl backdrop-blur-md p-3 flex items-center justify-center overflow-hidden">
                <img
                  src={logoPath}
                  alt="Ludo Logo"
                  className="w-full h-full object-contain relative z-10 drop-shadow-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement?.classList.add("bg-dz-green", "border-dz-gold");
                  }}
                />
              </div>
              <motion.div className="absolute -top-4 -right-4 text-dz-gold text-2xl drop-shadow-md" animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180] }} transition={{ duration: 4, repeat: Infinity }}>★</motion.div>
              <motion.div className="absolute -bottom-2 -left-4 text-white text-xl drop-shadow-md"  animate={{ scale: [1, 1.3, 1], rotate: [0, -90, -180] }} transition={{ duration: 3, repeat: Infinity, delay: 1 }}>★</motion.div>
            </div>

            {/* RIGHT — Trophy */}
            <motion.div
              className="flex-shrink-0"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
              style={{ width: "clamp(48px, 14vw, 62px)", height: "clamp(72px, 21vw, 93px)" }}
            >
              <svg width="100%" height="100%" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.5))" }}>
                <ellipse cx="50" cy="126" rx="28" ry="4" fill="rgba(0,0,0,0.22)"/>
                <rect x="24" y="110" width="52" height="8"  rx="3" fill="#b07800" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5"/>
                <rect x="20" y="116" width="60" height="7"  rx="3" fill="#8a5c00" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5"/>
                <rect x="26" y="111" width="48" height="2.5" rx="1" fill="white" opacity="0.25"/>
                <rect x="41" y="90" width="18" height="22" rx="3" fill="#cc8800" stroke="rgba(0,0,0,0.28)" strokeWidth="2"/>
                <rect x="43" y="91" width="6"  height="20" rx="2" fill="white" opacity="0.22"/>
                <path d="M 22 46 Q 2 52 2 67 Q 2 80 22 76"  stroke="rgba(0,0,0,0.28)" strokeWidth="10" strokeLinecap="round" fill="none"/>
                <path d="M 22 46 Q 4 52 4 67 Q 4 79 22 76"  stroke="#cc8800" strokeWidth="8" strokeLinecap="round" fill="none"/>
                <path d="M 22 48 Q 8 54 8 67 Q 8 77 22 74"  stroke="white"   strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35"/>
                <path d="M 78 46 Q 98 52 98 67 Q 98 80 78 76"  stroke="rgba(0,0,0,0.28)" strokeWidth="10" strokeLinecap="round" fill="none"/>
                <path d="M 78 46 Q 96 52 96 67 Q 96 79 78 76"  stroke="#cc8800" strokeWidth="8" strokeLinecap="round" fill="none"/>
                <path d="M 78 48 Q 92 54 92 67 Q 92 77 78 74"  stroke="white"   strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35"/>
                <path d="M 18 18 Q 13 46 16 63 Q 24 90 50 92 Q 76 90 84 63 Q 87 46 82 18 Z" fill="rgba(0,0,0,0.25)" transform="translate(1,2)"/>
                <path d="M 18 18 Q 13 46 16 63 Q 24 90 50 92 Q 76 90 84 63 Q 87 46 82 18 Z" fill="#FFD700"/>
                <path d="M 22 20 Q 17 46 20 62 Q 28 86 50 88 Q 72 86 80 62 Q 83 46 78 20 Z" fill="#FFC107" opacity="0.55"/>
                <path d="M 26 22 Q 23 46 25 60 Q 30 78 44 85" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.30"/>
                <path d="M 26 22 Q 23 46 25 58"               stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.50"/>
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
          </div>

          {/* Title */}
          <h1 className="text-6xl font-heading text-white text-center drop-shadow-title relative" style={{ letterSpacing: "0.14em", fontWeight: 700 }}>
            <span className="text-shadow-gold">LUDO DZ</span>
            <span className="absolute -top-3 -right-6 text-xl text-dz-gold rotate-12">☽</span>
          </h1>

          <div className="mt-2 bg-black/30 px-4 py-1 rounded-full border border-white/10 backdrop-blur-md">
            <p className="text-white/90 text-sm font-heading font-semibold uppercase" style={{ letterSpacing: "0.22em" }}>{t.welcome}</p>
          </div>

          {/* Tagline */}
          <motion.p
            className="mt-2 text-white/50 text-xs font-sans text-center"
            style={{ letterSpacing: "0.14em" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {t.tagline}
          </motion.p>
        </motion.div>

        {/* Middle Section */}
        <motion.div
          className="w-full flex flex-col items-center gap-6 mt-auto mb-14"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Play button */}
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlay}
            className="group relative w-[85%] h-24 rounded-3xl bg-gradient-to-b from-[#00cc66] to-[#006233] border-b-8 border-[#00331a] shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-3xl"/>
            <div className="absolute inset-1 border-2 border-[#FFD700]/50 rounded-2xl pointer-events-none"/>
            <div className="absolute inset-2 border border-[#FFD700]/30 rounded-xl pointer-events-none"/>
            <div className="flex items-center gap-4 z-10">
              <Play className="w-10 h-10 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform" />
              <span className="text-4xl font-heading text-white text-shadow-glow" style={{ letterSpacing: '0.12em', fontWeight: 700 }}>
                {t.play}
              </span>
            </div>
            <div className="absolute inset-0 bg-[#FFD700] opacity-0 group-hover:opacity-20 transition-opacity duration-300"/>
          </motion.button>

          {/* Bottom Buttons */}
          <motion.div className="flex gap-4 w-full justify-center px-6" variants={containerVariants}>
            {([
              { icon: Settings, label: t.settings, color: "from-gray-600 to-gray-800", onClick: onSettings },
              { icon: Trophy,   label: t.leaderboard, color: "from-amber-400 to-amber-600", onClick: undefined },
              { icon: Info,     label: t.about,       color: "from-sky-400 to-sky-600",   onClick: undefined },
            ] as const).map((btn, idx) => (
              <motion.button
                key={idx}
                variants={itemVariants}
                whileHover={{ y: -5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={btn.onClick}
                className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-b ${btn.color} border-b-4 border-black/40 shadow-lg relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 right-0 h-1/4 bg-white/20 rounded-t-2xl"/>
                <btn.icon className="w-7 h-7 text-white drop-shadow-md" />
                <span className="text-xs font-heading font-semibold text-white uppercase drop-shadow-md" style={{ letterSpacing: '0.1em' }}>{btn.label}</span>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Version */}
        <motion.div
          className="absolute bottom-6 opacity-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
        >
          <p className="text-white text-xs font-heading" style={{ letterSpacing: '0.18em', fontWeight: 500 }}>v1.0.0</p>
        </motion.div>

      </div>
    </motion.div>
  );
}
