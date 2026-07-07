import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface SplashScreenProps {
  lang: 'fr' | 'ar';
}

export function SplashScreen({ lang }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const duration = 2000; // 2 seconds
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setProgress(Math.min((currentStep / steps) * 100, 100));
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, []);

  const logoPath = import.meta.env.BASE_URL + 'ludo-logo.png';
  const loadingText = lang === 'fr' ? 'Chargement...' : 'جارٍ التحميل...';

  // Generate light rays
  const rays = Array.from({ length: 12 });

  return (
    <motion.div 
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1E90FF] via-[#0047AB] to-[#1a0a3d]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Light Rays Background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none mix-blend-screen">
        <motion.div 
          className="relative w-[800px] h-[800px]"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          {rays.map((_, i) => (
            <div 
              key={i} 
              className="absolute top-1/2 left-1/2 origin-left"
              style={{
                width: '400px',
                height: '40px',
                marginTop: '-20px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
                transform: `rotate(${i * (360 / 12)}deg)`,
                clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 60%)'
              }}
            />
          ))}
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full px-8">
        
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.2, y: 50, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2
          }}
          className="relative drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)]"
        >
          {/* Fallback styling in case image fails to load, but we rely on the image */}
          <div className="w-40 h-40 bg-white/10 rounded-3xl p-4 backdrop-blur-sm border-2 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden relative group">
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-white/10 opacity-70 z-10"></div>
            
            <img 
              src={logoPath} 
              alt="Ludo Logo" 
              className="w-full h-full object-contain relative z-0 drop-shadow-xl"
              onError={(e) => {
                // If the placeholder image doesn't exist, replace with a CSS representation
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('bg-dz-green', 'border-dz-gold');
              }}
            />
            {/* Fallback CSS Ludo Board icon if img fails */}
            <div className="absolute inset-0 z-0 hidden group-[.bg-dz-green]:grid grid-cols-2 gap-1 p-2">
               <div className="bg-dz-red rounded-tl-xl border border-black/20"></div>
               <div className="bg-dz-green rounded-tr-xl border border-black/20"></div>
               <div className="bg-sky-blue rounded-bl-xl border border-black/20"></div>
               <div className="bg-dz-gold rounded-br-xl border border-black/20"></div>
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 12,
            delay: 0.5
          }}
          className="mt-6 mb-12 drop-shadow-title"
        >
          <h1 className="text-6xl font-heading text-white tracking-wider text-shadow-glow">
            LUDO <span className="text-dz-gold">DZ</span>
          </h1>
        </motion.div>

        {/* Loading Bar */}
        <motion.div 
          className="w-full max-w-[240px] mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/20 p-[2px] shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-dz-green via-[#00cc66] to-dz-green rounded-full relative"
              style={{ width: `${progress}%` }}
              layout
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 shimmer-bar rounded-full"></div>
            </motion.div>
          </div>
          <div className="flex justify-between items-center mt-3">
            <p className="text-white/80 font-bold text-sm tracking-widest uppercase">
              {loadingText}
            </p>
            <p className="text-dz-gold font-bold text-sm">
              {Math.floor(progress)}%
            </p>
          </div>
        </motion.div>

      </div>
      
      {/* Decorative floating bits */}
      <motion.div className="absolute top-20 left-10 text-dz-gold opacity-50 text-2xl" animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }} transition={{ duration: 3, repeat: Infinity }}>★</motion.div>
      <motion.div className="absolute bottom-40 right-10 text-sky-blue opacity-50 text-3xl" animate={{ y: [0, 20, 0], rotate: [0, -15, 0] }} transition={{ duration: 4, repeat: Infinity }}>☽</motion.div>
    </motion.div>
  );
}
