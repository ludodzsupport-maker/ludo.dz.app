// LoadingOverlay — shared premium loading/transition treatment.
//
// Reused in two places: a full-screen "curtain" while a match is being
// prepared (App.tsx, between mode-select and the board mounting), and a
// small "flourish" contained inside the board-style card in Settings when
// switching themes. Both share one visual language — a rotating gold/neon
// gem-cut ring around a pulsing die glyph — so the app's transitional
// moments read as one designed family rather than ad-hoc spinners.
//
// Per-theme scrim/gold tokens intentionally mirror VictoryScreen's so the
// two "premium overlay" moments in the app (match end, loading) feel related.
// Purely presentational: the parent owns all show/hide timing via
// AnimatePresence, same convention as VictoryScreen/GameConfigOverlay.
import { motion, useReducedMotion } from 'framer-motion';
import { Dices } from 'lucide-react';
import type { BoardStyle } from '../App';

interface LoadingOverlayProps {
  boardStyle: BoardStyle;
  lang: 'fr' | 'ar';
  variant?: 'curtain' | 'flourish';
  label?: string;
}

function useThemeTokens(boardStyle: BoardStyle) {
  if (boardStyle === 'classic') {
    return {
      scrim: 'radial-gradient(ellipse 120% 100% at 50% 38%, rgba(56,24,88,0.55) 0%, rgba(9,4,18,0.95) 75%)',
      track: 'rgba(201,162,39,0.22)',
      arcFrom: '#FFF3C0', arcMid: '#FFBC00', arcTo: '#C9861A',
      glow: 'rgba(255,188,0,0.55)',
      icon: '#E8C766',
      label: 'rgba(255,228,154,0.75)',
    };
  }
  if (boardStyle === 'dz') {
    return {
      scrim: 'radial-gradient(ellipse 120% 100% at 50% 38%, rgba(0,84,45,0.5) 0%, rgba(2,13,8,0.95) 75%)',
      track: 'rgba(201,162,39,0.24)',
      arcFrom: '#FFF3C0', arcMid: '#D9B54A', arcTo: '#C9861A',
      glow: 'rgba(217,181,74,0.55)',
      icon: '#D9B54A',
      label: 'rgba(255,238,196,0.72)',
    };
  }
  if (boardStyle === 'normal') {
    return {
      scrim: 'radial-gradient(ellipse 120% 100% at 50% 38%, rgba(60,86,124,0.5) 0%, rgba(10,12,20,0.95) 75%)',
      track: 'rgba(68,114,196,0.24)',
      arcFrom: '#8FB4E8', arcMid: '#4472C4', arcTo: '#2C4C86',
      glow: 'rgba(68,114,196,0.55)',
      icon: '#7FA5DB',
      label: 'rgba(214,226,246,0.72)',
    };
  }
  return {
    scrim: 'rgba(3,11,22,0.92)',
    track: 'rgba(0,255,238,0.20)',
    arcFrom: '#B44FFF', arcMid: '#4DBBFF', arcTo: '#00FFEE',
    glow: 'rgba(0,255,238,0.55)',
    icon: '#5FE9E0',
    label: 'rgba(210,250,255,0.68)',
  };
}
type ThemeTokens = ReturnType<typeof useThemeTokens>;

function RingSpinner({ size, theme, reduced }: { size: number; theme: ThemeTokens; reduced: boolean }) {
  const gradId = `loading-arc-${theme.arcMid.replace('#', '')}`;
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <motion.svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0 }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={reduced ? undefined : { duration: 1.15, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.arcFrom} />
            <stop offset="55%" stopColor={theme.arcMid} />
            <stop offset="100%" stopColor={theme.arcTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.track} strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${circumference * 0.72} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 6px ${theme.glow})` }}
        />
      </motion.svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={reduced ? undefined : { scale: [1, 1.14, 1] }}
          transition={reduced ? undefined : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Dices size={Math.round(size * 0.36)} color={theme.icon} style={{ filter: `drop-shadow(0 0 8px ${theme.glow})` }} />
        </motion.div>
      </div>
    </div>
  );
}

export function LoadingOverlay({ boardStyle, lang, variant = 'curtain', label }: LoadingOverlayProps) {
  const reduced = useReducedMotion() ?? false;
  const theme = useThemeTokens(boardStyle);
  const isCurtain = variant === 'curtain';

  return (
    <motion.div
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden${isCurtain ? '' : ' rounded-[inherit]'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{ backdropFilter: isCurtain ? 'blur(14px)' : 'blur(5px)', background: theme.scrim }}
      initial={{ opacity: 0, scale: isCurtain ? 1.02 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: isCurtain ? 0.98 : 1.02 }}
      transition={{ duration: isCurtain ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <RingSpinner size={isCurtain ? 72 : 40} theme={theme} reduced={reduced} />
      {isCurtain && label && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
          style={{
            marginTop: 16, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.label, textAlign: 'center',
          }}
        >
          {label}
        </motion.p>
      )}
    </motion.div>
  );
}
