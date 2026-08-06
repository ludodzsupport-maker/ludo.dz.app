import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

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
  createRoot(document.getElementById('root')!).render(<App />);
} catch (error) {
  showFatalError(
    'Error during initial render',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}
