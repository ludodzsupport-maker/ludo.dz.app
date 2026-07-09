import { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { SplashScreen } from '@/components/SplashScreen';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { GameModeScreen } from '@/components/GameModeScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { GameBoardScreen } from '@/components/GameBoardScreen';
import { AnimatePresence } from 'framer-motion';
import type { GameConfig } from '@/components/GameConfigOverlay';

type Screen = 'welcome' | 'mode-select' | 'settings' | 'game';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen]         = useState<Screen>('welcome');
  const [lang, setLang]             = useState<'fr' | 'ar'>('fr');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>({ rule: 'classic', players: 4, modeId: 'computer' });

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setScreen('game');
  };

  return (
    <div
      className={`min-h-[100dvh] w-full flex items-center justify-center bg-black overflow-hidden select-none ${lang === 'ar' ? 'rtl' : 'ltr'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[430px] h-[100dvh] relative bg-deep-blue shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden text-white sm:rounded-[2rem] sm:h-[min(100dvh,900px)] sm:border-[8px] sm:border-gray-900 mx-auto">
        <AnimatePresence mode="wait">
          {showSplash ? (
            <SplashScreen key="splash" lang={lang} />
          ) : screen === 'welcome' ? (
            <WelcomeScreen
              key="welcome"
              lang={lang}
              onPlay={() => setScreen('mode-select')}
              onSettings={() => setScreen('settings')}
            />
          ) : screen === 'mode-select' ? (
            <GameModeScreen
              key="mode-select"
              lang={lang}
              onBack={() => setScreen('welcome')}
              onStart={handleStartGame}
            />
          ) : screen === 'settings' ? (
            <SettingsScreen
              key="settings"
              lang={lang}
              setLang={setLang}
              onBack={() => setScreen('welcome')}
            />
          ) : screen === 'game' && gameConfig ? (
            <GameBoardScreen
              key="game"
              config={gameConfig}
              lang={lang}
              onBack={() => setScreen('mode-select')}
            />
          ) : null}
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
