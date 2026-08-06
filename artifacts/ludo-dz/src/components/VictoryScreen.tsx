// VictoryScreen — match-end results screen.
// Shared layout across all three board themes (Classic / Neon / DZ); each
// theme gets its own backdrop, card frame, gold/glow accent, and confetti
// shape so the result feels native to whichever board the match was played
// on. Reads only game/session data already produced by GameBoardScreen —
// it does not touch engine logic.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, Footprints, Swords, Sparkles, Crown } from 'lucide-react';
import { GamePiece } from './GamePiece';
import * as E from '../lib/ludo-engine';
import * as DZ from '../lib/board-theme-dz';
import type { BoardStyle } from '../App';
import { supportsDvh } from '../lib/utils';

interface VictoryScreenProps {
  game: E.GameState;
  lang: 'fr' | 'ar';
  boardStyle?: BoardStyle;
  isComputer: boolean;
  moveCount: number;
  captureCounts: number[];
  matchDurationMs: number;
  onPlayAgain: () => void;
  onMenu: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Confetti — theme-specific falling shapes ────────────────────────────────
type ConfettiShape = 'spark' | 'petal' | 'diamond';

function Confetti({ shape, colors, count = 22 }: { shape: ConfettiShape; colors: readonly string[]; count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    i,
    color: colors[i % colors.length],
    size: shape === 'petal' ? 11 + (i % 4) * 5 : 6 + (i % 5) * 4,
    left: `${4 + (i * 13) % 92}%`,
    duration: shape === 'petal' ? 3.2 + (i % 4) * 0.5 : 2.0 + (i % 4) * 0.28,
    delay: i * 0.09,
    drift: (i % 2 ? 1 : -1) * (14 + (i % 5) * 6),
    spin: 360 * (i % 2 ? 1 : -1),
  }));

  return (
    <>
      {pieces.map(p => (
        <motion.div key={p.i}
          className="absolute pointer-events-none"
          style={{
            width: p.size, height: p.size, left: p.left, top: '-6%',
            background: p.color,
            borderRadius: shape === 'spark' ? '50%' : shape === 'petal' ? '50% 50% 50% 4%' : 2,
            transform: shape === 'diamond' ? 'rotate(45deg)' : undefined,
            opacity: shape === 'petal' ? 0.55 : 0.85,
            filter: shape === 'petal' ? 'blur(1px)' : shape === 'spark' ? `drop-shadow(0 0 4px ${p.color})` : undefined,
          }}
          animate={{ y: ['0vh', '112vh'], x: [0, p.drift], rotate: [0, p.spin] }}
          transition={{
            duration: p.duration, delay: p.delay,
            ease: shape === 'petal' ? 'easeInOut' : 'easeIn',
            repeat: Infinity, repeatDelay: 0.3,
          }}
        />
      ))}
    </>
  );
}

function StatChip({ icon, value, label, bg, border }:
  { icon: ReactNode; value: string; label: string; bg: string; border: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1"
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '9px 4px', gap: 3, minWidth: 0 }}>
      {icon}
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: '#fff' }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function VictoryScreen({
  game, lang, boardStyle, isComputer, moveCount, captureCounts, matchDurationMs, onPlayAgain, onMenu,
}: VictoryScreenProps) {
  if (game.winner === null) return null; // parent already guards this; kept for type-narrowing safety

  const winner    = game.winner;
  const isAr      = lang === 'ar';
  const isClassic = boardStyle === 'classic';
  const isDz      = boardStyle === 'dz';

  const winnerColor = isDz ? DZ.HOME_COLORS[winner] : E.PLAYER_COLORS[winner];
  const winnerGlow  = isDz ? DZ.PLAYER_ACCENT_COLORS[winner] : E.PLAYER_NEONS[winner];
  const winnerName  = isAr ? E.PLAYER_NAMES_AR[winner] : E.PLAYER_NAMES_FR[winner].toUpperCase();

  // Per-theme design tokens. Classic and DZ both lean on the app's shared
  // "gold leaf" accent (#C9A227, already used for both themes' board
  // borders/diamond grids) so this screen reads as a continuation of the
  // board it just finished on, not a generic 4th theme.
  const theme = isClassic ? {
    scrim: 'radial-gradient(ellipse 120% 100% at 50% 38%, rgba(56,24,88,0.55) 0%, rgba(9,4,18,0.95) 75%)',
    cardBg: `linear-gradient(165deg, ${winnerColor}28 0%, rgba(30,15,50,0.97) 42%, rgba(13,6,24,0.98) 100%)`,
    borderOuter: '#C9A227',
    borderInner: 'rgba(255,228,154,0.30)',
    ringGlow: `0 0 60px ${winnerColor}30, 0 0 140px rgba(201,162,39,0.20), inset 0 0 40px rgba(201,162,39,0.06)`,
    eyebrow: 'rgba(255,228,154,0.78)',
    gold: '#E8C766',
    chipBg: 'rgba(201,162,39,0.09)',
    chipBorder: 'rgba(201,162,39,0.32)',
    confettiShape: 'petal' as ConfettiShape,
    confettiColors: ['#C9A227', '#FFDC64', winnerColor, '#FCE9B0'],
  } : isDz ? {
    scrim: 'radial-gradient(ellipse 120% 100% at 50% 38%, rgba(0,84,45,0.5) 0%, rgba(2,13,8,0.95) 75%)',
    cardBg: `linear-gradient(165deg, ${winnerColor}26 0%, rgba(3,38,21,0.97) 42%, rgba(2,15,9,0.98) 100%)`,
    borderOuter: '#C9A227',
    borderInner: 'rgba(255,238,196,0.28)',
    ringGlow: `0 0 60px ${winnerColor}2c, 0 0 140px rgba(201,162,39,0.22), inset 0 0 40px rgba(201,162,39,0.07)`,
    eyebrow: 'rgba(255,238,196,0.75)',
    gold: '#D9B54A',
    chipBg: 'rgba(201,162,39,0.10)',
    chipBorder: 'rgba(201,162,39,0.34)',
    confettiShape: 'diamond' as ConfettiShape,
    confettiColors: [DZ.BORDER_GOLD, winnerColor, DZ.PATH_CREAM, DZ.BOARD_BG],
  } : {
    scrim: 'rgba(3,11,22,0.92)',
    cardBg: `linear-gradient(150deg, ${winnerColor}22 0%, rgba(6,14,26,0.97) 100%)`,
    borderOuter: `${winnerGlow}80`,
    borderInner: `${winnerGlow}30`,
    ringGlow: `0 0 55px ${winnerColor}35, 0 0 120px ${winnerColor}18`,
    eyebrow: 'rgba(255,255,255,0.48)',
    gold: winnerGlow,
    chipBg: 'rgba(255,255,255,0.05)',
    chipBorder: `${winnerGlow}35`,
    confettiShape: 'spark' as ConfettiShape,
    confettiColors: [...E.PLAYER_NEONS],
  };

  // Standings — winner pinned first, others by pieces-home desc, then captures desc.
  const standingsRaw = game.playerSlots.map(slot => {
    const pieces = game.pieces.filter(p => p.player === slot);
    return {
      slot,
      total: pieces.length,
      home: pieces.filter(p => p.relPos === E.FINISHED_POS).length,
      captures: captureCounts[slot] ?? 0,
    };
  });
  const standings = [...standingsRaw].sort((a, b) => {
    if (a.slot === winner) return -1;
    if (b.slot === winner) return 1;
    return b.home - a.home || b.captures - a.captures;
  });
  const maxOtherCaptures = Math.max(0, ...standingsRaw.filter(s => s.slot !== winner).map(s => s.captures));
  const totalCaptures = standingsRaw.reduce((sum, s) => sum + s.captures, 0);
  const showPersonalWin = isComputer && winner === 0;

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ backdropFilter: 'blur(16px)', background: theme.scrim }}>

      <Confetti shape={theme.confettiShape} colors={theme.confettiColors} />

      <motion.div
        initial={{ scale: 0.55, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.10 }}
        className="relative flex flex-col items-center"
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.borderOuter}`,
          boxShadow: theme.ringGlow,
          borderRadius: 28, padding: '28px 22px 22px',
          maxWidth: 336, width: '90%', maxHeight: supportsDvh ? '88dvh' : '88vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
        {/* Ornamental inner hairline — gold-leaf double-border feel on Classic/DZ */}
        {(isClassic || isDz) && (
          <div className="absolute pointer-events-none"
            style={{ inset: 6, borderRadius: 21, border: `1px solid ${theme.borderInner}` }} />
        )}

        {/* Trophy */}
        <motion.div
          animate={{ rotate: [0, -12, 12, -6, 6, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          className="relative">
          <Trophy size={52} color={theme.gold}
            style={{ filter: `drop-shadow(0 0 14px ${theme.gold})` }} />
          {(isClassic || isDz) && (
            <Sparkles size={18} color={theme.gold}
              className="absolute -top-1 -right-2"
              style={{ filter: `drop-shadow(0 0 6px ${theme.gold})` }} />
          )}
        </motion.div>

        {/* Winner name block */}
        <div className="text-center">
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.14em',
            color: theme.eyebrow, marginBottom: 4 }}>
            {isAr ? 'الفائز' : 'VAINQUEUR'}
          </p>
          <div className="flex items-center justify-center" style={{ gap: 8 }}>
            <GamePiece color={winnerColor} className="w-5 h-8" />
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32,
              color: theme.gold, textShadow: `0 0 22px ${theme.gold}` }}>
              {winnerName}
            </p>
          </div>
          {showPersonalWin && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, marginTop: 4,
              color: theme.gold, opacity: 0.9 }}>
              {isAr ? '🎉 لقد فزت!' : '🎉 Vous avez gagné !'}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-stretch w-full" style={{ gap: 8 }}>
          <StatChip icon={<Clock size={16} color={theme.gold} />} value={formatDuration(matchDurationMs)}
            label={isAr ? 'المدة' : 'Durée'} bg={theme.chipBg} border={theme.chipBorder} />
          <StatChip icon={<Footprints size={16} color={theme.gold} />} value={String(moveCount)}
            label={isAr ? 'الحركات' : 'Coups'} bg={theme.chipBg} border={theme.chipBorder} />
          <StatChip icon={<Swords size={16} color={theme.gold} />} value={String(totalCaptures)}
            label={isAr ? 'الأسر' : 'Captures'} bg={theme.chipBg} border={theme.chipBorder} />
        </div>

        {/* Standings */}
        <div className="w-full">
          <div className="flex items-center justify-between" style={{ padding: '0 4px 6px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', color: theme.eyebrow }}>
              {isAr ? 'الترتيب' : 'CLASSEMENT'}
            </span>
            <div className="flex items-center" style={{ gap: 13 }}>
              <Crown size={12} color={theme.eyebrow} style={{ opacity: 0.7 }} />
              <Swords size={12} color={theme.eyebrow} style={{ opacity: 0.7 }} />
            </div>
          </div>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {standings.map(s => {
              const isWinnerRow  = s.slot === winner;
              const color        = isDz ? DZ.HOME_COLORS[s.slot] : E.PLAYER_COLORS[s.slot];
              const name         = isAr ? E.PLAYER_NAMES_AR[s.slot] : E.PLAYER_NAMES_FR[s.slot];
              const isTopAttacker = !isWinnerRow && s.captures > 0 && s.captures === maxOtherCaptures;
              return (
                <div key={s.slot} className="flex items-center"
                  style={{
                    gap: 8, padding: '7px 10px', borderRadius: 12,
                    background: isWinnerRow ? `${color}1c` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isWinnerRow ? color + '55' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0,
                    boxShadow: isWinnerRow ? `0 0 8px ${color}` : undefined,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: isWinnerRow ? 700 : 500,
                    color: isWinnerRow ? '#fff' : 'rgba(255,255,255,0.72)', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                  {isWinnerRow && <Crown size={13} color={theme.gold} style={{ flexShrink: 0 }} />}
                  {isTopAttacker && <Swords size={12} color="rgba(255,255,255,0.55)" style={{ flexShrink: 0 }} />}
                  <span className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
                    {Array.from({ length: s.total }, (_, pi) => (
                      <span key={pi} style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: pi < s.home ? color : 'transparent',
                        border: `1.3px solid ${color}`, opacity: pi < s.home ? 1 : 0.45,
                      }} />
                    ))}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700,
                    color: 'rgba(255,255,255,0.55)', minWidth: 14, textAlign: isAr ? 'left' : 'right',
                  }}>
                    {s.captures}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex w-full" style={{ gap: 10, marginTop: 4 }}>
          <motion.button onClick={onPlayAgain}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 18, cursor: 'pointer',
              background: `linear-gradient(135deg, ${winnerColor}cc, ${winnerColor}88)`,
              border: `1.5px solid ${theme.gold}`,
              color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
              boxShadow: `0 0 20px ${winnerColor}40`,
            }}>
            {isAr ? 'جديد' : 'Rejouer'}
          </motion.button>
          <motion.button onClick={onMenu}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 18, cursor: 'pointer',
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.16)',
              color: 'rgba(255,255,255,0.72)',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
            }}>
            {isAr ? 'القائمة' : 'Menu'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
