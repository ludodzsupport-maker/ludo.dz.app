// GameBoardScreen — major overhaul
// • Correct path/corner alignment (Red=TL, Blue=TR, Yellow=BR, Green=BL)
// • Side-column per-player dice panels; only active player interactive
// • Middle lane only colored; outer strips neutral
// • Animation speed setting (Fast / Normal / Slow)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bot, RotateCcw, Settings, Trophy, X, Zap } from 'lucide-react';
import { GamePiece } from './GamePiece';
import * as E from '../lib/ludo-engine';
import type { GameConfig } from './GameConfigOverlay';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props { config: GameConfig; lang: 'fr' | 'ar'; onBack: () => void; }
type AnimSpeed = 'fast' | 'normal' | 'slow';

// ─── Animation speed presets ──────────────────────────────────────────────────
const ANIM = {
  fast:   { cycles: 8,  baseMs: 32, stepMs: 15, stiffness: 520, damping: 32, mass: 0.60 },
  normal: { cycles: 11, baseMs: 50, stepMs: 24, stiffness: 400, damping: 30, mass: 0.75 },
  slow:   { cycles: 16, baseMs: 80, stepMs: 42, stiffness: 180, damping: 22, mass: 1.20 },
} as const;

// ─── Dice dot positions (SVG viewBox −3…3) ───────────────────────────────────
const DOTS: Record<number, [number,number][]> = {
  1: [[0,0]],
  2: [[-1,-1],[1,1]],
  3: [[-1,-1],[0,0],[1,1]],
  4: [[-1,-1],[1,-1],[-1,1],[1,1]],
  5: [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  6: [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
};

// ─── Board cell classification ────────────────────────────────────────────────
// Home zones corrected to match path start positions:
//   Red=TL, Blue=TR, Yellow=BR, Green=BL
type CellKind = 'home'|'strip'|'homecol'|'path'|'center'|'outside';
interface Cell { kind: CellKind; player?: number }

function classifyCell(r: number, c: number): Cell {
  // Corner home zones — aligned to where each player's path starts
  if (r <= 5 && c <= 5)  return { kind: 'home', player: 0 }; // Red   TL
  if (r <= 5 && c >= 9)  return { kind: 'home', player: 1 }; // Blue  TR
  if (r >= 9 && c >= 9)  return { kind: 'home', player: 2 }; // Yell  BR
  if (r >= 9 && c <= 5)  return { kind: 'home', player: 3 }; // Green BL
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { kind: 'center' };
  const inCross = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
  if (!inCross) return { kind: 'outside' };
  // Colored approach strips (outer rows of each arm — path cells, rendered neutral)
  if (r === 6 && c >= 1 && c <= 5)  return { kind: 'strip',   player: 0 };
  if (c === 8 && r >= 1 && r <= 5)  return { kind: 'strip',   player: 1 };
  if (r === 8 && c >= 9 && c <= 13) return { kind: 'strip',   player: 2 };
  if (c === 6 && r >= 9 && r <= 13) return { kind: 'strip',   player: 3 };
  // Home columns — MIDDLE row/col of each arm, the only colored lanes
  if (r === 7 && c >= 1 && c <= 6)  return { kind: 'homecol', player: 0 };
  if (c === 7 && r >= 1 && r <= 6)  return { kind: 'homecol', player: 1 };
  if (r === 7 && c >= 8 && c <= 13) return { kind: 'homecol', player: 2 };
  if (c === 7 && r >= 8 && r <= 13) return { kind: 'homecol', player: 3 };
  return { kind: 'path' };
}

const GRID: Cell[][] = Array.from({ length: 15 }, (_, r) =>
  Array.from({ length: 15 }, (_, c) => classifyCell(r, c))
);

const PATH_POS_MAP = new Map<string, number>(
  E.MAIN_PATH.map(([r, c], i) => [`${r},${c}`, i])
);

// ─── Piece display position ───────────────────────────────────────────────────
function getPieceXY(piece: E.Piece, all: E.Piece[]): [number, number] {
  if (piece.relPos === -1) {
    const [br, bc] = E.HOME_BASES[piece.player][piece.index];
    return [bc + 0.5, br + 0.5];
  }
  if (piece.relPos === E.FINISHED_POS) {
    const done = all.filter(p => p.relPos === E.FINISHED_POS);
    const idx  = done.indexOf(piece);
    const off: [number,number][] = [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]];
    const [dx, dy] = off[idx % 4] || [0, 0];
    return [7.5 + dx, 7.5 + dy];
  }
  const gp = E.getGridPos(piece.player, piece.relPos);
  if (!gp) return [7.5, 7.5];
  const [row, col] = gp;
  const cx = col + 0.5, cy = row + 0.5;
  // Stack multiple pieces on same cell
  const sharers = all.filter(p => {
    if (p === piece || p.relPos < 0 || p.relPos === E.FINISHED_POS) return false;
    const g2 = E.getGridPos(p.player, p.relPos);
    return g2 && g2[0] === row && g2[1] === col;
  });
  if (!sharers.length) return [cx, cy];
  const stack = [piece, ...sharers].sort(
    (a, b) => a.player * 4 + a.index - (b.player * 4 + b.index)
  );
  const rank = stack.indexOf(piece);
  const offsets: [number,number][] = [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]];
  const [dx, dy] = offsets[rank % 4] || [0, 0];
  return [cx + dx, cy + dy];
}

// ─── Die SVG face ─────────────────────────────────────────────────────────────
function DieFace({
  value, neon, col, size, rolling, justLanded, dim,
}: {
  value: number; neon: string; col: string; size: number;
  rolling?: boolean; justLanded?: boolean; dim?: boolean;
}) {
  const dots = DOTS[Math.max(1, Math.min(6, value))] ?? DOTS[1];
  const opacity = dim ? 0.28 : 1;

  const anim =
    rolling    ? { rotate: [0, 22, -18, 14, -10, 6, -3, 0] }
    : justLanded ? { scale: [1.35, 0.80, 1.10, 0.95, 1.0] }
    : {};

  const trans =
    rolling    ? { duration: 0.40, repeat: Infinity, ease: 'linear' as const }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : justLanded ? { duration: 0.45, ease: [0.22, 1.7, 0.36, 1] as any }
    : {};

  return (
    <motion.svg width={size} height={size} viewBox="-3 -3 6 6"
      style={{ display: 'block', opacity }}
      animate={anim} transition={trans}>
      <defs>
        <radialGradient id={`dg-${neon.replace('#','')}`} cx="35%" cy="28%" r="75%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor={col} stopOpacity="0.08" />
        </radialGradient>
        <filter id={`df-${neon.replace('#','')}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.20" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Body */}
      <rect x="-3" y="-3" width="6" height="6" rx="0.90"
        fill={`url(#dg-${neon.replace('#','')})`}
        stroke={neon} strokeWidth={dim ? 0.12 : 0.22}
      />
      {/* Sheen */}
      <rect x="-2.6" y="-2.7" width="2.0" height="0.75" rx="0.30"
        fill="white" opacity="0.18"/>
      {/* Shadow */}
      <ellipse cx="0.1" cy="2.5" rx="2.1" ry="0.50" fill="rgba(0,0,0,0.28)"/>
      {/* Dots */}
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="0.55"
          fill={neon} filter={`url(#df-${neon.replace('#','')})`}/>
      ))}
    </motion.svg>
  );
}

// ─── Per-player dice panel (side column) ─────────────────────────────────────
// Each panel occupies roughly half the board height.
// Left col: players 0 (top=TL=Red) and 3 (bottom=BL=Green)
// Right col: players 1 (top=TR=Blue) and 2 (bottom=BR=Yellow)
function DicePanel({
  player, game, isAI, lang,
  rolling, animDice, justLanded, lastDice,
  onRoll, canRoll,
  side,
}: {
  player: number; game: E.GameState; isAI: boolean; lang: 'fr'|'ar';
  rolling: boolean; animDice: number; justLanded: boolean; lastDice: number[];
  onRoll: () => void; canRoll: boolean;
  side: 'left'|'right';
}) {
  const col      = E.PLAYER_COLORS[player];
  const neon     = E.PLAYER_NEONS[player];
  const isActive = game.activePlayer === player && game.phase !== 'done';
  const exists   = player < game.numPlayers;
  const pieces   = game.pieces.filter(p => p.player === player);
  const name     = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];
  const isRollingMe = rolling && isActive;
  const diceVal  = isActive ? animDice : (lastDice[player] || 1);
  const canTap   = canRoll && isActive;

  if (!exists) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.08,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#555' }}/>
      </div>
    );
  }

  return (
    <motion.div
      onClick={canTap ? onRoll : undefined}
      whileTap={canTap ? { scale: 0.93 } : {}}
      animate={isActive ? {
        boxShadow: [
          `inset 0 0 14px ${col}18, 0 0 8px ${col}28`,
          `inset 0 0 22px ${col}30, 0 0 16px ${col}50`,
          `inset 0 0 14px ${col}18, 0 0 8px ${col}28`,
        ],
      } : { boxShadow: 'inset 0 0 0px transparent' }}
      transition={{ duration: 1.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        padding: '6px 3px',
        cursor: canTap ? 'pointer' : 'default',
        position: 'relative',
        borderLeft:  side === 'right' ? `2px solid ${isActive ? neon : col + '22'}` : undefined,
        borderRight: side === 'left'  ? `2px solid ${isActive ? neon : col + '22'}` : undefined,
        background: isActive
          ? `linear-gradient(${side === 'left' ? '270deg' : '90deg'}, ${col}20 0%, ${col}06 100%)`
          : 'transparent',
        transition: 'background 0.35s, border-color 0.35s',
        overflow: 'hidden',
      }}
    >
      {/* Active bar shimmer */}
      {isActive && (
        <motion.div style={{
          position: 'absolute',
          [side === 'left' ? 'right' : 'left']: 0,
          top: 0, bottom: 0, width: 2,
          background: `linear-gradient(180deg, transparent, ${neon}cc, transparent)`,
        }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Player indicator dot + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <motion.div
          animate={isActive ? { boxShadow: [`0 0 4px ${neon}80`, `0 0 10px ${neon}`, `0 0 4px ${neon}80`] } : {}}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: col,
            boxShadow: isActive ? `0 0 8px ${neon}` : 'none',
          }}
        />
        <span style={{
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9,
          color: isActive ? neon : col + '80',
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          writingMode: 'horizontal-tb' as const,
        }}>
          {isAI ? '🤖' : name.slice(0,1)}
        </span>
      </div>

      {/* Die face */}
      <div style={{ position: 'relative' }}>
        {/* Pulse ring when ready */}
        {canTap && !rolling && (
          <motion.div style={{
            position: 'absolute', inset: -5, borderRadius: 10,
            border: `1.5px solid ${neon}`,
          }}
            animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <DieFace
          value={diceVal}
          neon={neon} col={col}
          size={42}
          rolling={isRollingMe}
          justLanded={justLanded && isActive}
          dim={!isActive}
        />
      </div>

      {/* Token progress dots */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[0,1,2,3].map(i => {
          const p = pieces[i];
          const st = !p ? 'none'
                   : p.relPos === E.FINISHED_POS ? 'done'
                   : p.relPos >= 0 ? 'on'
                   : 'home';
          return (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: st === 'done' ? neon : st === 'on' ? col : `${col}38`,
              border: `0.5px solid ${col}40`,
              boxShadow: st === 'done' ? `0 0 4px ${neon}` : 'none',
              transition: 'all 0.3s',
            }}/>
          );
        })}
      </div>

      {/* Phase label */}
      <div style={{ minHeight: 14, display: 'flex', alignItems: 'center' }}>
        <AnimatePresence mode="wait">
          {canTap && (
            <motion.span key="tap"
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              style={{
                fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700,
                color: neon, letterSpacing: '0.06em',
                textShadow: `0 0 6px ${neon}`,
              }}>
              {lang === 'ar' ? 'ارمِ' : 'TAP'}
            </motion.span>
          )}
          {isRollingMe && (
            <motion.span key="roll"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                fontFamily: 'Rajdhani, sans-serif', fontSize: 9,
                color: 'rgba(255,255,255,0.45)',
              }}>
              …
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── BoardSVG — pure game board ───────────────────────────────────────────────
interface BoardSVGProps {
  game: E.GameState;
  onPieceClick: (pid: string) => void;
  springCfg: { stiffness: number; damping: number; mass: number };
}

function BoardSVG({ game, onPieceClick, springCfg }: BoardSVGProps) {
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const pieces      = game.pieces;

  const piecePositions = useMemo(
    () => pieces.map(p => ({ ...p, xy: getPieceXY(p, pieces) })),
    [pieces]
  );

  const movableHighlights = useMemo(() => {
    if (game.phase !== 'selecting' || !game.movable.length) return [];
    return game.movable.flatMap(pid => {
      const [ps, is] = pid.split(':').map(Number);
      const piece = pieces.find(p => p.player === ps && p.index === is);
      if (!piece || piece.relPos < 0) return [];
      const gp = E.getGridPos(piece.player, piece.relPos);
      if (!gp) return [];
      return [{ col: gp[1], row: gp[0], neon: E.PLAYER_NEONS[piece.player] }];
    });
  }, [game.movable, game.phase, pieces]);

  return (
    <svg viewBox="0 0 15 15"
      style={{ width: '100%', height: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        {E.PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`pg${i}`} cx="35%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.80"/>
            <stop offset="30%"  stopColor={c}/>
            <stop offset="100%" stopColor={c} stopOpacity="0.85"/>
          </radialGradient>
        ))}
        {E.PLAYER_NEONS.map((_, i) => (
          <filter key={i} id={`pglow${i}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.18" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
        <filter id="star-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.08" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="tile-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.16" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="lane-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.12" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── Background ── */}
      <rect width="15" height="15" fill="#030b16"/>

      {/* ── Home zones — correct corners: Red=TL, Blue=TR, Yellow=BR, Green=BL ── */}
      {[0,1,2,3].map(player => {
        // Zone top-left corners aligned to path start positions
        const [zr, zc] = [[0,0],[0,9],[9,9],[9,0]][player] as [number,number];
        const col  = E.PLAYER_COLORS[player];
        const neon = E.PLAYER_NEONS[player];
        const exists   = player < game.numPlayers;
        const isCurrent = player === game.activePlayer && game.phase !== 'done';
        return (
          <g key={`hz-${player}`}>
            <rect x={zc} y={zr} width="6" height="6"
              fill={col}
              fillOpacity={isCurrent ? 0.20 : exists ? 0.10 : 0.02}
              stroke={neon}
              strokeWidth={isCurrent ? 0.09 : 0.05}
              strokeOpacity={isCurrent ? 0.90 : exists ? 0.45 : 0.12}
            />
            <circle cx={zc+3} cy={zr+3} r="2.32"
              fill={col}
              fillOpacity={isCurrent ? 0.28 : exists ? 0.14 : 0.03}
              stroke={neon}
              strokeWidth={isCurrent ? 0.11 : 0.07}
              strokeOpacity={isCurrent ? 0.85 : exists ? 0.40 : 0.10}
            />
            {/* Piece slots — symmetric ±1.5 SVG units from zone center */}
            {E.HOME_BASES[player].map(([br, bc], si) => (
              <circle key={si}
                cx={bc+0.5} cy={br+0.5} r="0.44"
                fill="rgba(0,0,0,0.45)"
                stroke={neon} strokeWidth="0.055"
                strokeOpacity={exists ? 0.40 : 0.08}
              />
            ))}
            {/* Player initial */}
            {exists && (
              <text
                x={zc+3}
                y={zr + (player >= 2 ? 5.60 : 0.90)}
                textAnchor="middle" fontSize="0.42"
                fontFamily="Rajdhani, sans-serif" fontWeight="700"
                fill={neon} opacity={isCurrent ? 1 : 0.42}
              >
                {['R','B','J','V'][player]}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Cross path cells ── */}
      {GRID.flatMap((row, r) => row.map((cell, c) => {
        if (cell.kind === 'home' || cell.kind === 'center' || cell.kind === 'outside') return null;
        const pathPos = PATH_POS_MAP.get(`${r},${c}`);
        const isStar  = pathPos !== undefined && E.SAFE_SET.has(pathPos);
        const isStart = pathPos !== undefined && (E.PLAYER_STARTS as readonly number[]).includes(pathPos);
        const player  = cell.player ?? -1;

        // Visual rule: ONLY homecol (middle lane) cells get player color.
        // Strip and path cells stay neutral/dark for clean contrast.
        let fill    = '#0d1f38';
        let fillOp  = 1;
        let stroke  = 'rgba(255,255,255,0.06)';
        let useGlow = false;

        if (cell.kind === 'homecol') {
          // Depth gradient: brighter toward center
          const depth = r === 7
            ? (player === 0 ? c - 1 : 13 - c)   // horizontal arms
            : (player === 1 ? r - 1 : 13 - r);   // vertical arms
          const t = Math.max(0, Math.min(1, depth / 5));
          fill    = E.PLAYER_COLORS[player];
          fillOp  = player < game.numPlayers ? 0.18 + t * 0.52 : 0.04;
          stroke  = player < game.numPlayers ? E.PLAYER_NEONS[player] : 'transparent';
          useGlow = player < game.numPlayers && t > 0.5;
        }
        // strip + path → remain the neutral dark fill defined above

        const starNeon = isStart
          ? E.PLAYER_NEONS[(E.PLAYER_STARTS as readonly number[]).indexOf(pathPos as number)]
          : 'rgba(255,255,255,0.50)';

        return (
          <g key={`${r}-${c}`}>
            <rect x={c} y={r} width="1" height="1"
              fill={fill} fillOpacity={fillOp}
              stroke={stroke} strokeWidth="0.028"
              filter={useGlow ? 'url(#lane-glow)' : undefined}
            />
            {/* Subtle glass sheen */}
            <rect x={c+0.04} y={r+0.04} width="0.28" height="0.13" rx="0.05"
              fill="rgba(255,255,255,0.07)"/>
            {isStar && (
              <text x={c+0.5} y={r+0.68} textAnchor="middle"
                fontSize="0.42" fill={starNeon} filter="url(#star-glow)">
                ✦
              </text>
            )}
          </g>
        );
      }))}

      {/* ── Movable-piece tile highlights ── */}
      {movableHighlights.map(({ col, row, neon }, i) => (
        <motion.rect key={`hi-${i}`}
          x={col} y={row} width={1} height={1} rx={0.10}
          fill={neon} filter="url(#tile-glow)"
          animate={{ opacity: [0.06, 0.24, 0.06] }}
          transition={{ duration: 0.88, repeat: Infinity, ease: 'easeInOut', delay: i*0.14 }}
        />
      ))}

      {/* ── Center 3×3 — triangles point toward each player's home column ── */}
      {/* top  → Blue  (home col goes DOWN from TR) */}
      <polygon points="6,6 9,6 7.5,7.5"
        fill={E.PLAYER_COLORS[1]} opacity={1 < game.numPlayers ? 0.58 : 0.14}/>
      {/* right → Yellow (home col goes LEFT from BR) */}
      <polygon points="9,6 9,9 7.5,7.5"
        fill={E.PLAYER_COLORS[2]} opacity={2 < game.numPlayers ? 0.58 : 0.14}/>
      {/* bottom → Green (home col goes UP from BL) */}
      <polygon points="9,9 6,9 7.5,7.5"
        fill={E.PLAYER_COLORS[3]} opacity={3 < game.numPlayers ? 0.58 : 0.14}/>
      {/* left  → Red   (home col goes RIGHT from TL) */}
      <polygon points="6,9 6,6 7.5,7.5"
        fill={E.PLAYER_COLORS[0]} opacity="0.58"/>
      <rect x="6" y="6" width="3" height="3" fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.055"/>
      <circle cx="7.5" cy="7.5" r="0.52" fill="white" opacity="0.16"/>

      {/* ── Active-player board border pulse ── */}
      <motion.rect x="0.05" y="0.05" width="14.90" height="14.90"
        fill="none" rx="0.20"
        animate={{
          stroke: activeNeon,
          strokeOpacity: [0.40, 0.78, 0.40],
          strokeWidth:   [0.08, 0.12, 0.08],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Pieces ── */}
      {piecePositions.map(({ player, index, xy: [cx, cy] }) => {
        const pid       = E.pieceId(player, index);
        const isMovable = game.movable.includes(pid);
        const neon      = E.PLAYER_NEONS[player];
        const R         = 0.37;

        return (
          <motion.g key={pid}
            animate={{ x: cx, y: cy }}
            initial={{ x: cx, y: cy }}
            transition={{ type: 'spring', ...springCfg }}
            onClick={() => isMovable && onPieceClick(pid)}
            style={{ cursor: isMovable ? 'pointer' : 'default' }}>
            {/* Movable pulse ring */}
            {isMovable && (
              <motion.circle cx={0} cy={0} r={R+0.16} fill="none"
                stroke={neon} strokeWidth="0.09"
                animate={{ opacity: [0.20, 0.90, 0.20], r: [R+0.09, R+0.26, R+0.09] }}
                transition={{ duration: 0.90, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Drop shadow */}
            <ellipse cx={0.04} cy={0.12} rx={R*0.82} ry={R*0.30}
              fill="rgba(0,0,0,0.42)"/>
            {/* Body */}
            <circle cx={0} cy={0} r={R}
              fill={`url(#pg${player})`}
              stroke={isMovable ? neon : 'rgba(0,0,0,0.28)'}
              strokeWidth={isMovable ? 0.08 : 0.04}
              filter={isMovable ? `url(#pglow${player})` : undefined}
            />
            {/* Specular */}
            <circle cx={-R*0.37} cy={-R*0.40} r={R*0.26}
              fill="white" opacity="0.65"/>
          </motion.g>
        );
      })}
    </svg>
  );
}

// ─── Settings overlay ─────────────────────────────────────────────────────────
function SettingsOverlay({ lang, animSpeed, onSpeed, onClose }: {
  lang: 'fr'|'ar'; animSpeed: AnimSpeed;
  onSpeed: (s: AnimSpeed) => void; onClose: () => void;
}) {
  const speeds: { key: AnimSpeed; fr: string; ar: string; icon: string }[] = [
    { key: 'slow',   fr: 'Lent',   ar: 'بطيء',  icon: '🐢' },
    { key: 'normal', fr: 'Normal', ar: 'عادي',  icon: '⚡' },
    { key: 'fast',   fr: 'Rapide', ar: 'سريع',  icon: '🚀' },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-end justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(18px)', background: 'rgba(3,11,22,0.85)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0d1f38 0%, #071427 100%)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 20px 40px',
          width: '100%', maxWidth: 480,
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} color="rgba(255,255,255,0.6)"/>
            <span style={{
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 16,
              color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em',
            }}>
              {lang === 'ar' ? 'الإعدادات' : 'PARAMÈTRES'}
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="rgba(255,255,255,0.6)"/>
          </button>
        </div>

        {/* Animation speed */}
        <p style={{
          fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.40)', letterSpacing: '0.10em',
          marginBottom: 10,
        }}>
          {lang === 'ar' ? 'سرعة الرسوم المتحركة' : 'VITESSE D\'ANIMATION'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {speeds.map(({ key, fr, ar, icon }) => {
            const active = animSpeed === key;
            return (
              <motion.button key={key}
                onClick={() => onSpeed(key)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{
                  flex: 1, padding: '12px 6px', borderRadius: 14,
                  background: active
                    ? 'linear-gradient(135deg, #1E90FF33, #1E90FF15)'
                    : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${active ? '#4DBBFF' : 'rgba(255,255,255,0.10)'}`,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  boxShadow: active ? '0 0 14px #1E90FF30' : 'none',
                }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
                  fontSize: 12, color: active ? '#4DBBFF' : 'rgba(255,255,255,0.50)',
                  letterSpacing: '0.04em',
                }}>
                  {lang === 'ar' ? ar : fr}
                </span>
                {active && (
                  <Zap size={10} color="#4DBBFF"/>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Divider + tip */}
        <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{
            fontFamily: 'Cairo, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
          }}>
            {lang === 'ar'
              ? 'تحكّم في سرعة رمي الحجر وحركة القطع'
              : 'Contrôle la vitesse du lancer et des déplacements'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Player chip (header bar) ─────────────────────────────────────────────────
function PlayerChip({ game, player, isAI, lang }: {
  game: E.GameState; player: number; isAI: boolean; lang: 'fr'|'ar';
}) {
  const col      = E.PLAYER_COLORS[player];
  const neon     = E.PLAYER_NEONS[player];
  const isActive = game.activePlayer === player && game.phase !== 'done';
  const pieces   = game.pieces.filter(p => p.player === player);
  const name     = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];

  return (
    <motion.div
      animate={{
        scale: isActive ? 1.06 : 1,
        boxShadow: isActive
          ? `0 0 12px ${neon}70, inset 0 0 6px ${col}18`
          : '0 0 0px transparent',
      }}
      transition={{ duration: 0.22 }}
      style={{
        background: `linear-gradient(135deg, ${col}18, ${col}08)`,
        border: `1.5px solid ${isActive ? neon : col + '25'}`,
        borderRadius: 12, padding: '5px 8px', minWidth: 56, position: 'relative', overflow: 'hidden',
      }}>
      {isActive && (
        <motion.div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${neon}, transparent)`,
        }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: col,
          boxShadow: `0 0 4px ${neon}80`, flexShrink: 0,
        }}/>
        <span style={{
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10,
          color: isActive ? '#fff' : 'rgba(255,255,255,0.50)',
          letterSpacing: '0.05em',
        }}>
          {name.slice(0,4).toUpperCase()}
        </span>
        {isAI && <Bot size={8} color="rgba(255,255,255,0.30)"/>}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0,1,2,3].map(i => {
          const p  = pieces[i];
          const st = !p ? 'none' : p.relPos === E.FINISHED_POS ? 'done' : p.relPos >= 0 ? 'on' : 'home';
          return (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: st === 'done' ? neon : st === 'on' ? col : `${col}40`,
              border: `0.5px solid ${col}30`,
              boxShadow: st === 'done' ? `0 0 4px ${neon}` : 'none',
              transition: 'all 0.28s',
            }}/>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main GameBoardScreen ─────────────────────────────────────────────────────
export function GameBoardScreen({ config, lang, onBack }: Props) {
  const [game, setGame]             = useState<E.GameState>(() => E.createGame(config.players));
  const [rolling, setRolling]       = useState(false);
  const [animDice, setAnimDice]     = useState(1);
  const [justLanded, setJustLanded] = useState(false);
  const [lastDice, setLastDice]     = useState<number[]>([0, 0, 0, 0]);
  const [animSpeed, setAnimSpeed]   = useState<AnimSpeed>('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const rollTimers = useRef<NodeJS.Timeout[]>([]);

  const isComputer  = config.modeId === 'computer';
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const isHumanTurn = !isComputer || game.activePlayer === 0;
  const canRoll     = isHumanTurn && game.phase === 'rolling' && !rolling && !game.winner;
  const cfg         = ANIM[animSpeed];
  const springCfg   = { stiffness: cfg.stiffness, damping: cfg.damping, mass: cfg.mass };

  // ── Roll handler ──────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || game.phase !== 'rolling' || game.winner) return;
    const rollingPlayer = game.activePlayer; // capture now — must not close over future state
    setRolling(true);
    setJustLanded(false);

    const { cycles, baseMs, stepMs } = ANIM[animSpeed];
    let count = 0;
    const cycle = () => {
      setAnimDice(Math.floor(Math.random() * 6) + 1);
      count++;
      // Ease out: fast ticks → slow ticks for satisfying deceleration
      const delay = count < Math.floor(cycles * 0.4)
        ? baseMs
        : baseMs + (count - Math.floor(cycles * 0.4)) * stepMs;

      if (count < cycles) {
        const t = setTimeout(cycle, delay);
        rollTimers.current.push(t);
      } else {
        const t = setTimeout(() => {
          setGame(prev => {
            const next = E.doRoll(prev);
            setAnimDice(next.dice);
            setLastDice(ld => { const n = [...ld]; n[rollingPlayer] = next.dice; return n; });
            setRolling(false);
            setJustLanded(true);
            const clear = setTimeout(() => setJustLanded(false), 560);
            rollTimers.current.push(clear);
            return next;
          });
        }, delay);
        rollTimers.current.push(t);
      }
    };
    cycle();
  }, [rolling, game.phase, game.winner, game.activePlayer, animSpeed]);

  // ── Piece click ───────────────────────────────────────────────────────────
  const handlePieceClick = useCallback((pid: string) => {
    if (!isHumanTurn || !game.movable.includes(pid)) return;
    setGame(prev => E.doMove(prev, pid));
  }, [isHumanTurn, game.movable]);

  // ── Auto-pass when no valid moves ────────────────────────────────────────
  useEffect(() => {
    if (game.phase !== 'selecting' || game.movable.length > 0 || game.winner) return;
    const t = setTimeout(() => setGame(E.autoPassTurn), 1080);
    return () => clearTimeout(t);
  }, [game.phase, game.movable.length, game.winner]);

  // ── AI roll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'rolling' || rolling || game.winner) return;
    const t = setTimeout(handleRoll, 620 + Math.random() * 320);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, rolling, game.winner, handleRoll]);

  // ── AI move ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'selecting' || !game.movable.length || game.winner) return;
    const pid = E.aiPickMove(game);
    if (!pid) return;
    const t = setTimeout(() => setGame(prev => E.doMove(prev, pid)), 480);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, game.movable.length, game.winner]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => { rollTimers.current.forEach(clearTimeout); }, []);

  // ── Restart ───────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    rollTimers.current.forEach(clearTimeout);
    rollTimers.current = [];
    setRolling(false);
    setAnimDice(1);
    setJustLanded(false);
    setLastDice([0,0,0,0]);
    setGame(E.createGame(config.players));
    setRestartKey(k => k + 1);
  }, [config.players]);

  // ── Status text ───────────────────────────────────────────────────────────
  const statusMsg =
    game.message
    || (game.phase === 'selecting' && game.movable.length
        ? (lang === 'ar' ? 'انقر على قطعة' : 'Sélectionner une pièce')
        : game.phase === 'rolling' && !isHumanTurn && !rolling
        ? (lang === 'ar' ? 'انتظر الكمبيوتر…' : 'IA réfléchit…')
        : '');

  // ── Shared DicePanel props ─────────────────────────────────────────────────
  const dpCommon = { game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll };

  return (
    <motion.div key={restartKey}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(175deg, #060f1d 0%, #09152a 55%, #050d18 100%)' }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28 }}>

      {/* ── Ambient decorative pieces ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { color: '#DC143C', top: '-3%',  right: '-5%',  size: 70, delay: 0 },
          { color: '#1E90FF', top: '18%',  left: '-9%',   size: 55, delay: 5 },
          { color: '#FFD700', bottom: '4%',right: '-4%',  size: 45, delay: 9 },
        ].map(({ color, size, delay, ...pos }, i) => (
          <motion.div key={i} className="absolute opacity-[0.06]"
            style={{ ...pos, width: size, height: size*1.5 }}
            animate={{ y: [0,16,0], rotate: [0,25,0] }}
            transition={{ duration: 13+i*3, repeat: Infinity, ease: 'easeInOut', delay }}>
            <GamePiece color={color}/>
          </motion.div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex-shrink-0 flex items-center gap-2 px-3 pt-10 pb-2">
        {/* Back */}
        <motion.button onClick={onBack}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ArrowLeft className="w-4 h-4 text-white"
            style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}/>
        </motion.button>

        {/* Player chips */}
        <div className="flex-1 flex gap-1.5 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: game.numPlayers }, (_, i) => (
            <PlayerChip key={i} game={game} player={i}
              isAI={isComputer && i !== 0} lang={lang}/>
          ))}
        </div>

        {/* Settings */}
        <motion.button onClick={() => setShowSettings(true)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Settings className="w-4 h-4 text-white/50"/>
        </motion.button>

        {/* Restart */}
        <motion.button onClick={handleRestart}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <RotateCcw className="w-4 h-4 text-white/50"/>
        </motion.button>
      </div>

      {/* ── Board + side dice panels ── */}
      {/* Layout: [Left col: Red(top) + Green(bot)] [Board] [Right col: Blue(top) + Yellow(bot)] */}
      <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 px-2">
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          width: '100%',
          maxWidth: 480,
          gap: 4,
        }}>
          {/* ── Left dice column (Red top, Green bottom) ── */}
          <div style={{
            width: 52, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.25)',
          }}>
            <DicePanel {...dpCommon} player={0} isAI={false} side="left"/>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }}/>
            <DicePanel {...dpCommon} player={3} isAI={isComputer} side="left"/>
          </div>

          {/* ── Board ── */}
          <motion.div style={{ flex: 1, aspectRatio: '1', borderRadius: 14, overflow: 'hidden' }}
            animate={{
              boxShadow: [
                `0 0 22px ${activeColor}22, 0 0 50px rgba(0,0,0,0.60)`,
                `0 0 38px ${activeColor}48, 0 0 70px rgba(0,0,0,0.60)`,
                `0 0 22px ${activeColor}22, 0 0 50px rgba(0,0,0,0.60)`,
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>
            <BoardSVG game={game} onPieceClick={handlePieceClick} springCfg={springCfg}/>
          </motion.div>

          {/* ── Right dice column (Blue top, Yellow bottom) ── */}
          <div style={{
            width: 52, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.25)',
          }}>
            <DicePanel {...dpCommon} player={1} isAI={isComputer} side="right"/>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }}/>
            <DicePanel {...dpCommon} player={2} isAI={isComputer} side="right"/>
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="relative z-10 flex-shrink-0 px-4 pt-2 pb-8">
        <AnimatePresence mode="wait">
          {statusMsg ? (
            <motion.div key={statusMsg}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              style={{
                textAlign: 'center',
                fontFamily: 'Cairo, sans-serif', fontSize: 13,
                color: activeNeon, fontWeight: 700,
                textShadow: `0 0 12px ${activeNeon}55`,
              }}>
              {statusMsg}
            </motion.div>
          ) : (
            <motion.div key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                textAlign: 'center',
                fontFamily: 'Rajdhani, sans-serif', fontSize: 11,
                color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em',
              }}>
              LUDO DZ
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Settings overlay ── */}
      <AnimatePresence>
        {showSettings && (
          <SettingsOverlay lang={lang} animSpeed={animSpeed}
            onSpeed={s => { setAnimSpeed(s); }}
            onClose={() => setShowSettings(false)}/>
        )}
      </AnimatePresence>

      {/* ── Victory overlay ── */}
      <AnimatePresence>
        {game.winner !== null && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(16px)', background: 'rgba(3,11,22,0.92)' }}>
            {/* Confetti */}
            {Array.from({ length: 22 }, (_, i) => (
              <motion.div key={i}
                className="absolute rounded-full"
                style={{
                  width: 6+(i%5)*4, height: 6+(i%5)*4,
                  background: E.PLAYER_COLORS[i%4],
                  left: `${6+(i*4)%88}%`, top: '-5%', opacity: 0.85,
                }}
                animate={{
                  y: ['0vh','115vh'],
                  rotate: [0, 360*(i%2?1:-1)],
                  x: [0, (i%2?1:-1)*(16+i*4)],
                }}
                transition={{
                  duration: 2.0+(i%4)*0.28, delay: i*0.06,
                  ease: 'easeIn', repeat: Infinity, repeatDelay: 0.3,
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.55, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.10 }}
              style={{
                background: `linear-gradient(145deg, ${E.PLAYER_COLORS[game.winner]}22, rgba(3,11,22,0.97))`,
                border: `2px solid ${E.PLAYER_NEONS[game.winner]}65`,
                boxShadow: `0 0 55px ${E.PLAYER_COLORS[game.winner]}35, 0 0 110px ${E.PLAYER_COLORS[game.winner]}15`,
                borderRadius: 28, padding: '32px 28px 28px',
                maxWidth: 300, width: '88%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              }}>
              <motion.div
                animate={{ rotate: [0,-12,12,-6,6,0], scale: [1,1.18,1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}>
                <Trophy size={54} color={E.PLAYER_NEONS[game.winner]}
                  style={{ filter: `drop-shadow(0 0 12px ${E.PLAYER_NEONS[game.winner]})` }}/>
              </motion.div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: 12,
                  color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                  {lang === 'ar' ? 'الفائز' : 'VAINQUEUR'}
                </p>
                <p style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 34,
                  color: E.PLAYER_NEONS[game.winner],
                  textShadow: `0 0 22px ${E.PLAYER_NEONS[game.winner]}`,
                }}>
                  {lang === 'ar'
                    ? E.PLAYER_NAMES_AR[game.winner]
                    : E.PLAYER_NAMES_FR[game.winner].toUpperCase()}
                </p>
                {isComputer && game.winner === 0 && (
                  <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: 13, marginTop: 6,
                    color: E.PLAYER_NEONS[game.winner], opacity: 0.88 }}>
                    {lang === 'ar' ? '🎉 لقد فزت!' : '🎉 Vous avez gagné !'}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <motion.button onClick={handleRestart}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 18, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${E.PLAYER_COLORS[game.winner]}cc, ${E.PLAYER_COLORS[game.winner]}88)`,
                    border: `1.5px solid ${E.PLAYER_NEONS[game.winner]}`,
                    color: '#fff', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13,
                    boxShadow: `0 0 20px ${E.PLAYER_COLORS[game.winner]}40`,
                  }}>
                  {lang === 'ar' ? 'جديد' : 'Rejouer'}
                </motion.button>
                <motion.button onClick={onBack}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 18, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.07)',
                    border: '1.5px solid rgba(255,255,255,0.16)',
                    color: 'rgba(255,255,255,0.72)',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13,
                  }}>
                  {lang === 'ar' ? 'القائمة' : 'Menu'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
