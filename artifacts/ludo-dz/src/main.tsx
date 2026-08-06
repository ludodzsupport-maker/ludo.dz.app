import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// TEMP DEBUG - remove after diagnosis: progressive load-stage logging. Appends to the
// on-screen overlay created in index.html (stage 1, "HTML parsed") so we can see exactly
// which stage the app reaches on a device with no console access.
(window as any).__diagLog?.('main.tsx started');

// TEMP DEBUG - remove after diagnosis: minimal global error/rejection
// listeners that write straight to the __diagLog overlay (not just
// console, which isn't visible on-device) so any error shows up inline
// with the rest of the load-stage timeline. Deliberately separate from the
// permanent showFatalError-based handlers below, and placed as early as
// possible -- before that function even exists -- so this whole block can
// be deleted later without touching any non-debug code.
window.addEventListener('error', (e: ErrorEvent) => {
  (window as any).__diagLog?.(
    `TEMP DEBUG error: ${e.message ?? '(no message)'} @ ${e.filename ?? '?'}:${e.lineno ?? '?'}`,
  );
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const { reason } = e;
  (window as any).__diagLog?.(
    `TEMP DEBUG unhandledrejection: ${reason instanceof Error ? reason.message : String(reason)}`,
  );
});

// --- Diagnostic error visibility -----------------------------------------
//
// Added to debug a blank-screen failure in the Cordova/Android WebView build
// where we have no device console access. If anything throws before or
// during React's first render, paint it directly onto the page instead of
// letting the screen stay blank with zero information.
//
// Important limitation: this can only report failures that happen AFTER
// this script begins executing. If the WebView can't load or parse this
// bundle at all (a blocked/failed script request, or a syntax error the
// WebView's JS engine can't handle), none of this code ever runs either --
// there is no way to catch that class of failure from inside the file it
// would prevent from loading. It mainly covers uncaught exceptions during
// React's render, unhandled promise rejections, and later resource loads
// (e.g. a lazy-loaded chunk) that fail after startup.
function showFatalError(title: string, detail: string): void {
  // Replace rather than stack overlays if multiple errors fire in a row.
  document.getElementById('__fatal-error-overlay__')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '__fatal-error-overlay__';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'background:#1a0000',
    'color:#ffdddd',
    'font-family:monospace',
    'font-size:13px',
    'line-height:1.5',
    'white-space:pre-wrap',
    'word-break:break-word',
    'overflow:auto',
    'padding:16px',
    'box-sizing:border-box',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText =
    'color:#ff6b6b;font-weight:bold;font-size:15px;margin-bottom:8px;';

  const body = document.createElement('div');
  body.textContent = detail;

  overlay.append(heading, body);
  document.body.appendChild(overlay);
}

window.onerror = (message, source, lineno, colno, error) => {
  showFatalError(
    'Uncaught error',
    `${String(message)}\nat ${source ?? '(unknown)'}:${lineno ?? '?'}:${colno ?? '?'}\n\n${
      error?.stack ?? '(no stack available)'
    }`,
  );
};

window.addEventListener(
  'unhandledrejection',
  (event: PromiseRejectionEvent) => {
    const { reason } = event;
    showFatalError(
      'Unhandled promise rejection',
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason),
    );
  },
);

// Capturing-phase listener: resource load failures (e.g. a script/link that
// fails to fetch) dispatch a plain error event on the element, which
// window.onerror above does not receive. Capturing at the window level
// catches those too, for chunks that fail after this script is running.
window.addEventListener(
  'error',
  (event: Event) => {
    const target = event.target;
    if (
      (target instanceof HTMLScriptElement ||
        target instanceof HTMLLinkElement) &&
      target !== document.currentScript
    ) {
      const src = target.getAttribute('src') ?? target.getAttribute('href');
      showFatalError('Resource failed to load', `${target.tagName}: ${src}`);
    }
  },
  true,
);

try {
  const root = createRoot(document.getElementById('root')!);
  // TEMP DEBUG - remove after diagnosis
  (window as any).__diagLog?.('React root created');
  root.render(<App />);
  // TEMP DEBUG - remove after diagnosis
  (window as any).__diagLog?.('App rendered');

  // TEMP DEBUG - remove after diagnosis: AppContent (see App.tsx) writes its
  // current state to window.__appDebugState on every render, since main.tsx
  // has no direct access to that component's local state. Reading it here
  // -- immediately after 'App rendered' -- doubles as a check for whether
  // AppContent ever ran at all: React 18's initial createRoot().render() is
  // synchronous, so if the route matched and AppContent executed, this
  // value is already set by the time root.render() returns above. If it's
  // still "not set" here, AppContent's function body never ran (e.g. the
  // Switch/Route matched NotFound instead -- see the location/base log
  // App() emits -- rather than any loading/asset condition inside it).
  const appDebugState = (window as any).__appDebugState;
  (window as any).__diagLog?.(
    appDebugState
      ? `AppContent state: ${JSON.stringify(appDebugState)}`
      : 'AppContent state: NOT SET (component function likely never ran)',
  );

  // TEMP DEBUG - remove after diagnosis: if SplashScreen's fade-in never
  // completes, say so explicitly instead of leaving the timeline silent --
  // distinguishes "truly stuck" from "just slow". The flag is set by
  // SplashScreen's onAnimationComplete callback (see SplashScreen.tsx).
  setTimeout(() => {
    if (!(window as any).__splashAnimComplete) {
      (window as any).__diagLog?.('TIMEOUT: animation did not complete within 3s');
    }
  }, 3000);

  // TEMP DEBUG - remove after diagnosis: deeper on-screen layout diagnostics
  // for the "React renders but nothing is visible" Cordova blank-screen
  // investigation. We have no chrome://inspect access on-device, so every
  // value that would normally come from devtools gets appended to the same
  // on-screen overlay instead. Isolated in its own try/catch so a failure
  // here logs a line rather than being mistaken for a render failure.
  try {
    const diagLog = (window as any).__diagLog as ((msg: string) => void) | undefined;

    // 1. Actual rendered height of the literal #root element.
    const rootEl = document.getElementById('root');
    if (rootEl) {
      const rect = rootEl.getBoundingClientRect();
      const computedHeight = getComputedStyle(rootEl).height;
      diagLog?.(`#root height: ${rect.height}px (computed height: ${computedHeight})`);
    } else {
      diagLog?.('#root height: element not found');
    }

    // 2. Does this WebView's CSS engine support the dvh unit at all?
    const dvhSupported =
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
        ? String(CSS.supports('height', '100dvh'))
        : 'CSS.supports unavailable';
    diagLog?.(`CSS.supports("height", "100dvh"): ${dvhSupported}`);

    // 3. Computed height actually applied to the two dvh-based containers
    // App.tsx renders (queried by class instead of editing App.tsx itself,
    // per the "only touch index.html/main.tsx/SplashScreen.tsx" scope).
    const outer = document.querySelector('.min-h-viewport-full');
    diagLog?.(
      outer
        ? `.min-h-viewport-full computed height: ${getComputedStyle(outer).height}`
        : '.min-h-viewport-full: NOT FOUND IN DOM',
    );

    const card = document.querySelector('.h-viewport-full');
    diagLog?.(
      card
        ? `.h-viewport-full computed height: ${getComputedStyle(card).height}`
        : '.h-viewport-full: NOT FOUND IN DOM',
    );
  } catch (diagError) {
    (window as any).__diagLog?.(
      `Diagnostic measurement threw: ${diagError instanceof Error ? diagError.message : String(diagError)}`,
    );
  }
} catch (error) {
  showFatalError(
    'Error during initial render',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}
