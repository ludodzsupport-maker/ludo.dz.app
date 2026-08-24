import { lazy, Suspense, useState, useEffect, useCallback, useTransition } from 'react';
import { tryUnlockBgm } from '@/lib/sound-manager';
import { SplashScreen } from '@/components/SplashScreen';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { AnimatePresence } from 'framer-motion';
import type { GameConfig } from '@/components/GameConfigOverlay';
import { clearSavedGame, type SavedGameSnapshot } from '@/lib/saved-game';

// Heavy screens stay out of the splash/welcome parse path. They are prefetched
// during splash (menus) and mode-select (board) so navigation still lands on
// an already-warmed module — appearance and timing of each screen stay the same.
const GameModeScreen = lazy(() =>
  import('@/components/GameModeScreen').then((m) => ({ default: m.GameModeScreen })),
);
const SettingsScreen = lazy(() =>
  import('@/components/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const AboutScreen = lazy(() =>
  import('@/components/AboutScreen').then((m) => ({ default: m.AboutScreen })),
);
const GameBoardScreen = lazy(() =>
  import('@/components/GameBoardScreen').then((m) => ({ default: m.GameBoardScreen })),
);

function preloadMenuScreens() {
  void import('@/components/GameModeScreen');
  void import('@/components/SettingsScreen');
  void import('@/components/AboutScreen');
}

function preloadGameBoard() {
  void import('@/components/GameBoardScreen');
}

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
  const [resumingSnapshot, setResumingSnapshot] = useState<SavedGameSnapshot | null>(null);
  const [, startScreenTransition]      = useTransition();

  const navigate = useCallback((nextScreen: Screen) => {
    startScreenTransition(() => {
      setScreen(nextScreen);
    });
  }, [startScreenTransition]);

  const goModeSelect = useCallback(() => navigate('mode-select'), [navigate]);
  const goSettings = useCallback(() => navigate('settings'), [navigate]);
  const goAbout = useCallback(() => navigate('about'), [navigate]);
  const goWelcome = useCallback(() => navigate('welcome'), [navigate]);

  // Tap-to-skip on the splash screen: dismisses splash early and unlocks
  // the AudioContext in the same gesture event, so BGM starts fading in
  // the instant the welcome screen appears.
  const handleSplashDismiss = useCallback(() => {
    setShowSplash(false);
    tryUnlockBgm();
  }, []);

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
          // Splash auto-dismissed without a tap — still try to unlock BGM.
          // Succeeds only if a gesture happened during splash (captured by
          // the document-level first-gesture listener); silently no-ops
          // otherwise, and the existing listener catches the next tap.
          tryUnlockBgm();
        }
      }, remaining);
    });

    return () => { cancelled = true; };
  }, []);

  // Warm the menu chunks while the splash is on screen, and the board chunk
  // as soon as the player is heading toward a match. Prefetch only — no
  // visual or navigation-timing change once the destination screen mounts.
  useEffect(() => {
    preloadMenuScreens();
  }, []);

  useEffect(() => {
    if (screen === 'mode-select' || screen === 'preparing-match') {
      preloadGameBoard();
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'preparing-match') return;
    const timer = setTimeout(() => navigate('game'), PREPARING_MATCH_MS);
    return () => clearTimeout(timer);
  }, [navigate, screen]);

  const handleStartGame = useCallback((config: GameConfig) => {
    clearSavedGame();
    setResumingSnapshot(null);
    setGameConfig(config);
    navigate('preparing-match');
  }, [navigate]);

  // Resuming is offered per game mode, from that mode's configuration sheet,
  // so the snapshot always arrives already matched to the selected mode.
  const handleResumeSavedGame = useCallback((snapshot: SavedGameSnapshot) => {
    setResumingSnapshot(snapshot);
    setGameConfig(snapshot.config);
    setBoardStyle(snapshot.boardStyle ?? 'classic');
    navigate('preparing-match');
  }, [navigate]);

  return (
    <div
      className={`min-h-viewport-full w-full flex items-center justify-center bg-black overflow-hidden select-none ${lang === 'ar' ? 'rtl' : 'ltr'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[430px] h-viewport-full h-viewport-capped-sm relative bg-deep-blue shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden text-white sm:rounded-[2rem] sm:border-[8px] sm:border-gray-900 mx-auto screen-paint-root" style={SCREEN_LAYER_STYLE}>
        <Suspense fallback={null}>
          <AnimatePresence mode="wait" presenceAffectsLayout={false}>
            {showSplash ? (
              <SplashScreen key="splash" lang={lang} onDismiss={handleSplashDismiss} />
            ) : screen === 'welcome' ? (
              <WelcomeScreen
                key="welcome"
                lang={lang}
                onPlay={goModeSelect}
                onSettings={goSettings}
                onAbout={goAbout}
              />
            ) : screen === 'mode-select' ? (
              <GameModeScreen
                key="mode-select"
                lang={lang}
                onBack={goWelcome}
                onStart={handleStartGame}
                onResume={handleResumeSavedGame}
              />
            ) : screen === 'settings' ? (
              <SettingsScreen
                key="settings"
                lang={lang}
                setLang={setLang}
                boardStyle={boardStyle}
                setBoardStyle={setBoardStyle}
                onBack={goWelcome}
                onAbout={goAbout}
              />
            ) : screen === 'about' ? (
              <AboutScreen
                key="about"
                lang={lang}
                onBack={goWelcome}
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
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  //
  // The game is a single-screen state machine. Previously AppContent was
  // behind a wouter <Route path="/"> with a catch-all NotFound route. Any
  // deployment that served the app at another path (for example
  // /index.html in an Android WebView or a Vercel preview/deep link) missed
  // that route before SplashScreen mounted, leaving #root empty. Render the
  // app shell directly so boot is not gated by the browser pathname.
  //
  // Unused shadcn TooltipProvider / Toaster wrappers were removed: nothing
  // in the game mounts a tooltip or toast, and they pulled Radix into the
  // critical path for zero on-screen effect.
  return <AppContent />;
}

export default App;
