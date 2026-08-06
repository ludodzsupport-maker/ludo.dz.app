import { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SplashScreen } from '@/components/SplashScreen';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { GameModeScreen } from '@/components/GameModeScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { GameBoardScreen } from '@/components/GameBoardScreen';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { AnimatePresence } from 'framer-motion';
import type { GameConfig } from '@/components/GameConfigOverlay';

type Screen = 'welcome' | 'mode-select' | 'settings' | 'preparing-match' | 'game';
export type BoardStyle = 'neon' | 'classic' | 'dz';

// Splash stays on screen at least this long so its tumble-and-impact
// choreography always finishes before it's dismissed, but never longer than
// MAX_SPLASH_MS even if fonts/assets are unusually slow to settle.
const MIN_SPLASH_MS = 2700;
const MAX_SPLASH_MS = 4200;
const PREPARING_MATCH_MS = 800;

function AppContent() {
  // TEMP DEBUG - remove after diagnosis: confirms the Route actually
  // matched and this component's function body executes at all. Added
  // alongside the App()-level location log below because on-device the
  // SplashScreen component function was never called while "App rendered"
  // still fired -- this narrows down whether AppContent itself ever ran.
  (window as any).__diagLog?.('AppContent: component function called');
  // TEMP DEBUG - remove after diagnosis: confirms which pathname the
  // now-unconditional <Route> (see App() below) matched on for this
  // render, to verify the routing fix actually took effect on the next
  // device test.
  (window as any).__diagLog?.(
    `AppContent: rendering (matched unconditional route) for pathname=${window.location.pathname}`,
  );

  const [showSplash, setShowSplash]   = useState(true);
  const [screen, setScreen]           = useState<Screen>('welcome');
  const [lang, setLang]               = useState<'fr' | 'ar'>('fr');
  const [gameConfig, setGameConfig]   = useState<GameConfig | null>(null);
  const [boardStyle, setBoardStyle]   = useState<BoardStyle>('classic');

  // Gate the splash on real readiness (fonts + hero logo decoded) instead of
  // a blind timer, so the welcome screen never flashes in with un-swapped
  // fonts or a popping-in logo — while keeping a min/max floor so it neither
  // flickers on a fast load nor hangs on a slow one.
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    // TEMP DEBUG - remove after diagnosis
    (window as any).__diagLog?.('App: splash-gating effect started');

    const logoReady = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // TEMP DEBUG - remove after diagnosis
        (window as any).__diagLog?.('App: hero logo loaded');
        resolve();
      };
      img.onerror = () => {
        // TEMP DEBUG - remove after diagnosis
        (window as any).__diagLog?.('App: hero logo failed to load (resolving anyway)');
        resolve();
      };
      img.src = import.meta.env.BASE_URL + 'ludo-logo.png';
    });
    const fontsReady = typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready
      : Promise.resolve();
    // TEMP DEBUG - remove after diagnosis: tap the promise for logging only,
    // does not consume or alter it -- fontsReady is still passed to
    // Promise.all below exactly as before.
    fontsReady.then(() => (window as any).__diagLog?.('App: fonts ready resolved'));

    const readiness = Promise.all([logoReady, fontsReady]);
    // TEMP DEBUG - remove after diagnosis
    readiness.then(() => (window as any).__diagLog?.('App: readiness (logo+fonts) resolved'));

    const maxWait = new Promise<void>((resolve) => setTimeout(resolve, MAX_SPLASH_MS));
    // TEMP DEBUG - remove after diagnosis
    maxWait.then(() => (window as any).__diagLog?.('App: max-wait timer (4200ms) elapsed'));

    Promise.race([readiness, maxWait]).then(() => {
      if (cancelled) return;
      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - start));
      setTimeout(() => {
        if (!cancelled) {
          // TEMP DEBUG - remove after diagnosis
          (window as any).__diagLog?.('App: calling setShowSplash(false)');
          setShowSplash(false);
        }
      }, remaining);
    });

    return () => { cancelled = true; };
  }, []);

  // Brief themed curtain between confirming a match and the board mounting,
  // so a heavy screen swap always reads as an intentional beat rather than
  // an abrupt cut.
  useEffect(() => {
    if (screen !== 'preparing-match') return;
    const timer = setTimeout(() => setScreen('game'), PREPARING_MATCH_MS);
    return () => clearTimeout(timer);
  }, [screen]);

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setScreen('preparing-match');
  };

  // TEMP DEBUG - remove after diagnosis: main.tsx has no direct access to
  // this component's local state, so expose the values that determine what
  // gets rendered on `window` and read them from main.tsx right after
  // 'App rendered' logs. Runs on every render, so it always reflects the
  // latest values.
  (window as any).__appDebugState = {
    showSplash,
    screen,
    lang,
    hasGameConfig: gameConfig !== null,
    boardStyle,
  };

  return (
    <div
      className={`min-h-viewport-full w-full flex items-center justify-center bg-black overflow-hidden select-none ${lang === 'ar' ? 'rtl' : 'ltr'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[430px] h-viewport-full h-viewport-capped-sm relative bg-deep-blue shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden text-white sm:rounded-[2rem] sm:border-[8px] sm:border-gray-900 mx-auto">
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
              boardStyle={boardStyle}
              setBoardStyle={setBoardStyle}
              onBack={() => setScreen('welcome')}
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
              onBack={() => setScreen('mode-select')}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  // TEMP DEBUG - remove after diagnosis: confirms the exact location/base
  // wouter matches routes against. On-device, SplashScreen's component
  // function was never called even though "App rendered" fired -- if
  // location.pathname doesn't match "/" under this base, <Route path="/">
  // silently falls through to the catch-all NotFound route instead of
  // AppContent, which would explain that without any thrown error.
  (window as any).__diagLog?.(
    `App: location.href=${window.location.href} pathname=${window.location.pathname} base="${import.meta.env.BASE_URL}"`
  );

  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          {/* Root cause confirmed on-device: the Cordova Android WebView
              reports location.pathname as "/index.html", not "/", so the
              previous path-gated <Route path="/"> never matched and
              AppContent silently never rendered (no thrown error -- just
              an empty #root). Wouter has no other Route anywhere in this
              codebase and the app has no real multi-page navigation (all
              screens are internal React state in AppContent), so instead
              of hardcoding every pathname a WebView build might report,
              the robust fix is to make this one meaningful route match
              unconditionally (no `path` prop matches any location -- see
              wouter's Route/matchRoute implementation). The former
              catch-all NotFound route is now unreachable by construction
              and has been removed along with its import. */}
          <Route component={AppContent} />
        </Switch>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
