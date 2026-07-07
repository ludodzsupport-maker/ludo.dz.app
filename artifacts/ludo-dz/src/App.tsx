import { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { SplashScreen } from '@/components/SplashScreen';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { AnimatePresence } from 'framer-motion';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [lang, setLang] = useState<'fr' | 'ar'>('fr');

  useEffect(() => {
    // Show splash screen for exactly 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`min-h-[100dvh] w-full flex items-center justify-center bg-black overflow-hidden select-none ${lang === 'ar' ? 'rtl' : 'ltr'}`} 
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[430px] h-[100dvh] relative bg-deep-blue shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden text-white sm:rounded-[2rem] sm:h-[min(100dvh,900px)] sm:border-[8px] sm:border-gray-900 mx-auto">
        <AnimatePresence mode="wait">
          {showSplash ? (
            <SplashScreen key="splash" lang={lang} />
          ) : (
            <WelcomeScreen key="welcome" lang={lang} setLang={setLang} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/" component={AppContent} />
          <Route component={NotFound} />
        </Switch>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
