import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Whether the engine supports the `dvh` (dynamic viewport height) unit.
// Some Android WebView versions don't, and — unlike a browser quirk that
// would just misbehave — treat it as a genuinely invalid value, dropping
// the whole declaration back to its initial value instead of falling back
// to `vh`. That silently collapses any layout sized with `dvh` to zero
// height. CSS class fallbacks (declare `vh` then `dvh` in one rule; the
// invalid line is dropped and the `vh` line stands) handle this natively,
// but values built as plain JS strings for inline styles can't express
// that, so those call sites should branch on this constant instead.
export const supportsDvh: boolean =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('height', '100dvh')
    : true;
