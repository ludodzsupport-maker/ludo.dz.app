import { motion } from "framer-motion";
import { GamePiece } from "./GamePiece";
import { LanguageToggle } from "./LanguageToggle";
import { Play, Settings, Trophy, Info } from "lucide-react";

interface WelcomeScreenProps {
  lang: 'fr' | 'ar';
  setLang: (lang: 'fr' | 'ar') => void;
}

export function WelcomeScreen({ lang, setLang }: WelcomeScreenProps) {
  const logoPath = import.meta.env.BASE_URL + 'ludo-logo.png';
  
  const t = {
    play: lang === 'fr' ? 'Jouer' : 'العب',
    settings: lang === 'fr' ? 'Paramètres' : 'إعدادات',
    leaderboard: lang === 'fr' ? 'Classement' : 'التصنيف',
    about: lang === 'fr' ? 'À propos' : 'حول',
    welcome: lang === 'fr' ? 'Bienvenue' : 'مرحباً',
  };

  // Generate grid background pattern for the ludo board watermark
  const renderBoardWatermark = () => {
    return (
      <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={`row-${i}`} className="flex flex-1">
            {Array.from({ length: 15 }).map((_, j) => {
              const isCenter = i >= 6 && i <= 8 && j >= 6 && j <= 8;
              const isHome = 
                (i < 6 && j < 6) || 
                (i < 6 && j > 8) || 
                (i > 8 && j < 6) || 
                (i > 8 && j > 8);
                
              let bg = "border border-white/20";
              if (isCenter) bg = "bg-white/40 border border-white/20";
              else if (isHome) bg = "border-2 border-white/30";
              
              return (
                <div key={`cell-${i}-${j}`} className={`flex-1 ${bg}`}></div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 20 }
    }
  };

  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#1E90FF] to-[#006233]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Board Pattern Watermark */}
      {renderBoardWatermark()}

      {/* Floating Background Pieces */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute -top-10 -left-10 opacity-30 w-32 h-32 blur-[2px]"
          animate={{ 
            y: [0, 40, 0], 
            rotate: [0, 45, 0],
            x: [0, 20, 0]
          }} 
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        >
          <GamePiece color="#DC143C" />
        </motion.div>
        
        <motion.div 
          className="absolute top-1/4 -right-16 opacity-20 w-40 h-40 blur-[3px]"
          animate={{ 
            y: [0, -50, 0], 
            rotate: [0, -30, 0],
            x: [0, -20, 0]
          }} 
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <GamePiece color="#FFD700" />
        </motion.div>
        
        <motion.div 
          className="absolute bottom-1/4 -left-12 opacity-40 w-28 h-28 blur-[1px]"
          animate={{ 
            y: [0, 30, 0], 
            rotate: [0, 60, 0],
            x: [0, 30, 0]
          }} 
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        >
          <GamePiece color="#1E90FF" />
        </motion.div>
      </div>

      {/* Neon Corner Accents — physical left/right (direction-stable, never flips with RTL) */}
      {[
        { cls: "absolute top-6 left-6",      color: "#FF1744", flip: "none",           delay: 0.0 },
        { cls: "absolute top-6 right-6",     color: "#00E676", flip: "scaleX(-1)",     delay: 0.8 },
        { cls: "absolute bottom-20 left-6",  color: "#40C4FF", flip: "scaleY(-1)",     delay: 1.6 },
        { cls: "absolute bottom-20 right-6", color: "#FFD740", flip: "scale(-1, -1)",  delay: 2.4 },
      ].map(({ cls, color, flip, delay }, i) => (
        <div key={i} className={`${cls} pointer-events-none`}>
          {/* Ambient pulse blob — breathes behind the bracket */}
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{ background: color, filter: "blur(14px)" }}
            animate={{ opacity: [0.07, 0.22, 0.07], scale: [0.8, 1.5, 0.8] }}
            transition={{ duration: 2.2, repeat: Infinity, delay, ease: "easeInOut" }}
          />
          {/* Neon L-bracket SVG */}
          <motion.svg
            width="52" height="52" viewBox="0 0 52 52" fill="none"
            style={{
              display: "block",
              transform: flip,
              filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color}66)`,
            }}
            animate={{ opacity: [0.52, 1, 0.52] }}
            transition={{ duration: 2.6 + i * 0.2, repeat: Infinity, delay: delay + 0.15, ease: "easeInOut" }}
          >
            {/* Layer 1 — outer soft glow */}
            <line x1="7" y1="7" x2="44" y2="7" stroke={color} strokeWidth="8"   strokeLinecap="round" opacity="0.08"/>
            <line x1="7" y1="7" x2="7"  y2="44" stroke={color} strokeWidth="8"   strokeLinecap="round" opacity="0.08"/>
            {/* Layer 2 — mid glow */}
            <line x1="7" y1="7" x2="44" y2="7" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.32"/>
            <line x1="7" y1="7" x2="7"  y2="44" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.32"/>
            {/* Layer 3 — bright neon tube core */}
            <line x1="7" y1="7" x2="44" y2="7" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.88"/>
            <line x1="7" y1="7" x2="7"  y2="44" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.88"/>
            {/* Arm-tip perpendicular ticks */}
            <line x1="44" y1="3"  x2="44" y2="12" stroke={color} strokeWidth="3"   strokeLinecap="round" opacity="0.55"/>
            <line x1="44" y1="3"  x2="44" y2="12" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.78"/>
            <line x1="3"  y1="44" x2="12" y2="44" stroke={color} strokeWidth="3"   strokeLinecap="round" opacity="0.55"/>
            <line x1="3"  y1="44" x2="12" y2="44" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.78"/>
            {/* Apex — concentric neon endpoint */}
            <circle cx="7" cy="7" r="7"   fill={color} opacity="0.10"/>
            <circle cx="7" cy="7" r="4.2" fill={color} opacity="0.52"/>
            <circle cx="7" cy="7" r="2.3" fill={color} opacity="0.90"/>
            <circle cx="7" cy="7" r="1.1" fill="white"  opacity="1.00"/>
            {/* Interior micro-particles */}
            <circle cx="22" cy="13" r="1.5" fill={color} opacity="0.50"/>
            <circle cx="13" cy="26" r="1.1" fill={color} opacity="0.35"/>
            <circle cx="34" cy="21" r="0.9" fill={color} opacity="0.22"/>
          </motion.svg>
        </div>
      ))}

      {/* Main Content Area */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full w-full py-8 px-6 overflow-y-auto">
        
        {/* Top Section: Logo & Title */}
        <motion.div 
          className="flex flex-col items-center pt-8"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative w-36 h-36 mb-4">
            <div className="absolute inset-0 bg-white/20 rounded-[2rem] rotate-6 blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-[2rem] border border-white/40 shadow-2xl backdrop-blur-md p-3 flex items-center justify-center overflow-hidden">
               <img 
                  src={logoPath} 
                  alt="Ludo Logo" 
                  className="w-full h-full object-contain relative z-10 drop-shadow-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('bg-dz-green', 'border-dz-gold');
                  }}
                />
            </div>
            
            {/* Sparkles */}
            <motion.div className="absolute -top-4 -right-4 text-dz-gold text-2xl drop-shadow-md" animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180] }} transition={{ duration: 4, repeat: Infinity }}>★</motion.div>
            <motion.div className="absolute -bottom-2 -left-4 text-white text-xl drop-shadow-md" animate={{ scale: [1, 1.3, 1], rotate: [0, -90, -180] }} transition={{ duration: 3, repeat: Infinity, delay: 1 }}>★</motion.div>
          </div>

          <h1 className="text-6xl font-heading text-white text-center drop-shadow-title relative" style={{ letterSpacing: '0.14em', fontWeight: 700 }}>
            <span className="text-shadow-gold">LUDO DZ</span>
            <span className="absolute -top-3 -right-6 text-xl text-dz-gold rotate-12">☽</span>
          </h1>
          
          <div className="mt-2 bg-black/30 px-4 py-1 rounded-full border border-white/10 backdrop-blur-md">
            <p className="text-white/90 text-sm font-heading font-semibold uppercase" style={{ letterSpacing: '0.22em' }}>{t.welcome}</p>
          </div>
        </motion.div>

        {/* Middle Section: Interactions */}
        <motion.div 
          className="w-full flex flex-col items-center gap-8 mt-auto mb-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="w-full">
            <LanguageToggle lang={lang} setLang={setLang} />
          </motion.div>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative w-[85%] h-24 rounded-3xl bg-gradient-to-b from-[#00cc66] to-[#006233] border-b-8 border-[#00331a] shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden"
          >
            {/* Button Shine Effect */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-3xl"></div>
            
            {/* Gold Trim */}
            <div className="absolute inset-1 border-2 border-[#FFD700]/50 rounded-2xl pointer-events-none"></div>
            <div className="absolute inset-2 border border-[#FFD700]/30 rounded-xl pointer-events-none"></div>

            <div className="flex items-center gap-4 z-10">
              <Play className="w-10 h-10 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform" />
              <span className="text-4xl font-heading text-white text-shadow-glow" style={{ letterSpacing: '0.12em', fontWeight: 700 }}>
                {t.play}
              </span>
            </div>
            
            {/* Glow on hover */}
            <div className="absolute inset-0 bg-[#FFD700] opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          </motion.button>

          <motion.div 
            className="flex gap-4 w-full justify-center px-6"
            variants={containerVariants}
          >
            {[
              { icon: Settings, label: t.settings, color: "from-gray-600 to-gray-800" },
              { icon: Trophy, label: t.leaderboard, color: "from-amber-400 to-amber-600" },
              { icon: Info, label: t.about, color: "from-sky-400 to-sky-600" }
            ].map((btn, idx) => (
              <motion.button
                key={idx}
                variants={itemVariants}
                whileHover={{ y: -5, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-b ${btn.color} border-b-4 border-black/40 shadow-lg relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 right-0 h-1/4 bg-white/20 rounded-t-2xl"></div>
                <btn.icon className="w-7 h-7 text-white drop-shadow-md" />
                <span className="text-xs font-heading font-semibold text-white uppercase drop-shadow-md" style={{ letterSpacing: '0.1em' }}>{btn.label}</span>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom Version Tag */}
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
