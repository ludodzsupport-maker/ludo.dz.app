import { motion } from "framer-motion";
import { playLanguageChange } from "../lib/sound-manager";

interface LanguageToggleProps {
  lang: 'fr' | 'ar';
  setLang: (lang: 'fr' | 'ar') => void;
}

export function LanguageToggle({ lang, setLang }: LanguageToggleProps) {
  return (
    <div className="flex bg-black/20 p-1 rounded-full backdrop-blur-sm border border-white/10 shadow-inner relative z-10 mx-auto w-fit">
      <button
        onClick={() => { playLanguageChange(); setLang('ar'); }}
        className={`relative px-6 py-2 rounded-full font-bold text-sm transition-colors duration-300 z-10 ${
          lang === 'ar' ? 'text-dz-green' : 'text-white/70 hover:text-white'
        }`}
      >
        {lang === 'ar' && (
          <motion.div
            layoutId="activeLang"
            className="absolute inset-0 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            initial={false}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ zIndex: -1 }}
          />
        )}
        العربية
      </button>
      
      <button
        onClick={() => { playLanguageChange(); setLang('fr'); }}
        className={`relative px-6 py-2 rounded-full font-bold text-sm transition-colors duration-300 z-10 ${
          lang === 'fr' ? 'text-dz-green' : 'text-white/70 hover:text-white'
        }`}
      >
        {lang === 'fr' && (
          <motion.div
            layoutId="activeLang"
            className="absolute inset-0 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            initial={false}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ zIndex: -1 }}
          />
        )}
        Français
      </button>
    </div>
  );
}
