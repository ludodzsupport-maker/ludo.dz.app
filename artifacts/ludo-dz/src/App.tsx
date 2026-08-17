import { useState, useEffect, useCallback, useTransition } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SplashScreen } from '@/components/SplashScreen';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { GameModeScreen } from '@/components/GameModeScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { AboutScreen } from '@/components/AboutScreen';
import { GameBoardScreen } from '@/components/GameBoardScreen';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameConfig } from '@/components/GameConfigOverlay';
import { clearSavedGame, readSavedGame, type SavedGameSnapshot } from '@/lib/saved-game';

type Screen = 'welcome' | 'mode-select' | 'settings' | 'about' | 'preparing-match' | 'game';
export type BoardStyle = 'neon' | 'classic' | 'dz';

// Splash stays on screen at least this long so its tumble-and-impact
// choreography always finishes before it's dismissed, but never longer than
// MAX_SPLASH_MS even if fonts/assets are unusually slow to settle.
const MIN_SPLASH_MS = 2700;
const MAX_SPLASH_MS = 4200;
const PREPARING_MATCH_MS = 800;

const SCREEN_LAYER_STYLE = {
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
  willChange: 'transform, opacity',
} as const;

function AppContent() {
  const [showSplash, setShowSplash]   = useState(true);
  const [screen, setScreen]           = useState<Screen>('welcome');
  const [lang, setLang]               = useState<'fr' | 'ar'>('fr');
  const [gameConfig, setGameConfig]   = useState<GameConfig | null>(null);
  const [boardStyle, setBoardStyle]   = useState<BoardStyle>('classic');
  const [savedGame, setSavedGame]     = useState<SavedGameSnapshot | null>(null);
  const [showResumeChoice, setShowResumeChoice] = useState(false);
  const [resumingSnapshot, setResumingSnapshot] = useState<SavedGameSnapshot | null>(null);
  const [, startScreenTransition]      = useTransition();

  const navigate = useCallback((nextScreen: Screen) => {
    startScreenTransition(() => {
      setScreen(nextScreen);
    });
  }, [startScreenTransition]);

  // Gate the dice splash on real readiness (fonts + hero logo decoded) instead of
  // a blind timer, so the main menu never flashes in with un-swapped
  // fonts or a popping-in logo — while keeping a min/max floor so it neither
  // flickers on a fast load nor hangs on a slow one.
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const logoReady = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = import.meta.env.BASE_URL + 'ludo-logo.png';
    });
    const fontsReady = typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready
      : Promise.resolve();

    const readiness = Promise.all([logoReady, fontsReady]);
    const maxWait = new Promise<void>((resolve) => setTimeout(resolve, MAX_SPLASH_MS));

    Promise.race([readiness, maxWait]).then(() => {
      if (cancelled) return;
      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - start));
      setTimeout(() => {
        if (!cancelled) {
          setShowSplash(false);
        }
      }, remaining);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (showSplash) return;
    const snapshot = readSavedGame();
    setSavedGame(snapshot);
    setShowResumeChoice(Boolean(snapshot));
  }, [showSplash]);

  useEffect(() => {
    if (screen !== 'preparing-match') return;
    const timer = setTimeout(() => navigate('game'), PREPARING_MATCH_MS);
    return () => clearTimeout(timer);
  }, [navigate, screen]);

  const handleStartGame = useCallback((config: GameConfig) => {
    clearSavedGame();
    setSavedGame(null);
    setResumingSnapshot(null);
    setGameConfig(config);
    navigate('preparing-match');
  }, [navigate]);

  const handleContinueSavedGame = useCallback(() => {
    const snapshot = savedGame ?? readSavedGame();
    if (!snapshot) {
      setShowResumeChoice(false);
      setSavedGame(null);
      navigate('mode-select');
      return;
    }
    setShowResumeChoice(false);
    setResumingSnapshot(snapshot);
    setGameConfig(snapshot.config);
    setBoardStyle(snapshot.boardStyle ?? 'classic');
    navigate('preparing-match');
  }, [navigate, savedGame]);

  const handleStartFreshFromSavedGame = useCallback(() => {
    clearSavedGame();
    setSavedGame(null);
    setResumingSnapshot(null);
    setShowResumeChoice(false);
    navigate('mode-select');
  }, [navigate]);

  return (
    <div
      className={`min-h-viewport-full w-full flex items-center justify-center bg-black overflow-hidden select-none ${lang === 'ar' ? 'rtl' : 'ltr'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[430px] h-viewport-full h-viewport-capped-sm relative bg-deep-blue shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden text-white sm:rounded-[2rem] sm:border-[8px] sm:border-gray-900 mx-auto" style={SCREEN_LAYER_STYLE}>
        <AnimatePresence mode="wait" presenceAffectsLayout={false}>
          {showSplash ? (
            <SplashScreen key="splash" lang={lang} />
          ) : screen === 'welcome' ? (
            <WelcomeScreen
              key="welcome"
              lang={lang}
              onPlay={() => {
                const snapshot = readSavedGame();
                setSavedGame(snapshot);
                if (snapshot) {
                  setShowResumeChoice(true);
                  return;
                }
                navigate('mode-select');
              }}
              onSettings={() => navigate('settings')}
              onAbout={() => navigate('about')}
            />
          ) : screen === 'mode-select' ? (
            <GameModeScreen
              key="mode-select"
              lang={lang}
              onBack={() => navigate('welcome')}
              onStart={handleStartGame}
            />
          ) : screen === 'settings' ? (
            <SettingsScreen
              key="settings"
              lang={lang}
              setLang={setLang}
              boardStyle={boardStyle}
              setBoardStyle={setBoardStyle}
              onBack={() => navigate('welcome')}
              onAbout={() => navigate('about')}
            />
          ) : screen === 'about' ? (
            <AboutScreen
              key="about"
              lang={lang}
              onBack={() => navigate('welcome')}
            />
          ) : screen === 'preparing-match' ? (
            <LoadingOverlay
              key="preparing-match"
              boardStyle={boardStyle}
              lang={lang}
              variant="curtain"
              label={lang === 'ar' ? 'جارٍ تحضير اللعبة' : 'Préparation de la partie'}
            />
          ) : screen === 'game' && gameConfig ? (
            <GameBoardScreen
              key="game"
              config={gameConfig}
              lang={lang}
              boardStyle={boardStyle}
              initialSnapshot={resumingSnapshot}
              onBack={() => {
                setResumingSnapshot(null);
                navigate('mode-select');
              }}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showResumeChoice && savedGame ? (
            <ResumeSavedGameDialog
              lang={lang}
              savedAt={savedGame.savedAt}
              onContinue={handleContinueSavedGame}
              onNewGame={handleStartFreshFromSavedGame}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}


function ResumeSavedGameDialog({ lang, savedAt, onContinue, onNewGame }: {
  lang: 'fr' | 'ar';
  savedAt: string;
  onContinue: () => void;
  onNewGame: () => void;
}) {
  const isRtl = lang === 'ar';
  const savedDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(savedAt));
  const copy = lang === 'ar'
    ? {
        title: 'متابعة المباراة المحفوظة؟',
        message: `تم العثور على مباراة محفوظة من ${savedDate}. يمكنك المتابعة أو بدء مباراة جديدة`,
        continue: 'تابع المباراة',
        newGame: 'مباراة جديدة',
        note: 'بدء مباراة جديدة يحذف الحفظ القديم.',
      }
    : {
        title: 'Continuer la partie sauvegardée ?',
        message: `Une partie sauvegardée le ${savedDate} est disponible. Vous pouvez la reprendre ou commencer autrement.`,
        continue: 'Continuer la partie',
        newGame: 'Nouvelle partie',
        note: 'Nouvelle partie supprimera cette sauvegarde.',
      };

  return (
    <motion.div
      className="absolute inset-0 z-[60] grid place-items-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,6,23,0.92))', backdropFilter: 'blur(18px)' }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-save-title"
        initial={{ y: 18, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 14, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 30,
          padding: 24,
          background: 'linear-gradient(145deg, rgba(13,24,54,0.98), rgba(5,12,30,0.98))',
          border: '1px solid rgba(255,215,0,0.34)',
          boxShadow: '0 28px 70px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.12)',
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        <p style={{ margin: '0 0 8px', color: '#FFD700', fontFamily: 'Rajdhani, Cairo, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: isRtl ? 0 : '0.16em' }}>LUDO DZ</p>
        <h2 id="resume-save-title" style={{ margin: 0, color: '#FFF7CC', fontFamily: 'Rajdhani, Cairo, sans-serif', fontSize: 27, lineHeight: 1.05, fontWeight: 900 }}>{copy.title}</h2>
        <p style={{ margin: '14px 0 20px', color: 'rgba(255,255,255,0.76)', fontFamily: 'Cairo, sans-serif', fontSize: 14, lineHeight: 1.55 }}>{copy.message}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onContinue} style={{ minHeight: 50, borderRadius: 18, border: '1px solid rgba(255,215,0,0.62)', background: 'linear-gradient(135deg, #FFE76B, #FFB000)', color: '#201400', fontFamily: 'Rajdhani, Cairo, sans-serif', fontSize: 17, fontWeight: 900, cursor: 'pointer' }}>{copy.continue}</button>
          <button onClick={onNewGame} style={{ minHeight: 48, borderRadius: 18, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.07)', color: '#FFFFFF', fontFamily: 'Rajdhani, Cairo, sans-serif', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{copy.newGame}</button>
        </div>
        <p style={{ margin: '14px 0 0', color: 'rgba(255,255,255,0.48)', fontFamily: 'Cairo, sans-serif', fontSize: 12 }}>{copy.note}</p>
      </motion.div>
    </motion.div>
  );
}

function App() {
  return (
    <TooltipProvider>
      {/*
        The game is a single-screen state machine. Previously AppContent was
        behind a wouter <Route path="/"> with a catch-all NotFound route. Any
        deployment that served the app at another path (for example
        /index.html in an Android WebView or a Vercel preview/deep link) missed
        that route before SplashScreen mounted, leaving #root empty. Render the
        app shell directly so boot is not gated by the browser pathname.
      */}
      <AppContent />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
