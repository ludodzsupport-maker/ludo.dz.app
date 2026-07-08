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

// ─── Layout constants for corner dice panels ──────────────────────────────────
// Each panel hovers above/below its board corner, inset to the frame's own
// left/right edge (see PANEL_INSET below), flat (no rotation), and linked to
// the frame via a small connector "tail" so it reads as anchored rather than
// floating. Container's vertical padding must be ≥ PANEL_H+GAP so panels
// never clip into the header or status bar; horizontal padding is a small
// fixed BOARD_MARGIN since panels never overhang sideways.
const PANEL_W = 54;   // px — panel width
const PANEL_H = 78;   // px — panel height
const PANEL_GAP = 6;  // px — space between panel edge and board frame edge
// Board is portrait (narrower than tall), so board SIZE is bottlenecked by
// horizontal space, not vertical. Panels therefore hover above/below the frame
// (using the vertical headroom, which is plentiful) and hug the frame's own
// left/right edge horizontally instead of overhanging sideways — this keeps
// them fully outside the board while costing almost no extra board width.
const BOARD_MARGIN = 14;   // px — minimal side margin for the board frame itself
const PANEL_INSET  = 9;    // px — how far the panel sits inward from the frame's corner
// Connector tail — a small triangle inside the untouched PANEL_GAP buffer,
// pointing from the panel toward its board corner. TAIL_H + TAIL_GAP must
// stay ≤ PANEL_GAP so it never touches the frame.
const TAIL_W   = 5;   // px — half-width of the tail triangle
const TAIL_H   = 4;   // px — tail height
const TAIL_GAP = 2;   // px — clear buffer between the tail tip and the frame edge

// ─── Corner dice panel ────────────────────────────────────────────────────────
// Sits outside its board corner, flat and mirror-symmetric across both axes,
// with a small tail pointing at the frame so it reads as anchored, not
// floating. Vertical layout: colour dot + name → die face → TAP label →
// progress dots.
function CornerDice({
  player, anchor, game, isAI, lang,
  rolling, animDice, justLanded, lastDice,
  onRoll, canRoll,
}: {
  player: number;
  anchor: 'tl' | 'tr' | 'bl' | 'br';
  game: E.GameState; isAI: boolean; lang: 'fr' | 'ar';
  rolling: boolean; animDice: number; justLanded: boolean; lastDice: number[];
  onRoll: () => void; canRoll: boolean;
}) {
  const col         = E.PLAYER_COLORS[player];
  const neon        = E.PLAYER_NEONS[player];
  const isActive    = game.activePlayer === player && game.phase !== 'done';
  const exists      = player < game.numPlayers;
  const pieces      = game.pieces.filter(p => p.player === player);
  const name        = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];
  const isRollingMe = rolling && isActive;
  const diceVal     = isActive ? animDice : (lastDice[player] || 1);
  const canTap      = canRoll && isActive;
  const isTop       = anchor === 'tl' || anchor === 'tr';

  // Wrapper hovers entirely above/below the frame (outside the board vertically)
  // while hugging the frame's own left/right edge horizontally — this avoids
  // eating into board WIDTH, which is the dimension that actually bottlenecks
  // the board's size on a portrait screen. Board frame has overflow:visible
  // so these render outside its bounds without being clipped.
  const pos = {
    tl: { top:    -(PANEL_H + PANEL_GAP), left:  PANEL_INSET },
    tr: { top:    -(PANEL_H + PANEL_GAP), right: PANEL_INSET },
    bl: { bottom: -(PANEL_H + PANEL_GAP), left:  PANEL_INSET },
    br: { bottom: -(PANEL_H + PANEL_GAP), right: PANEL_INSET },
  }[anchor];
  // Tail sits in the empty PANEL_GAP strip between the panel and the frame —
  // never overlaps the board itself.
  const tailPos = isTop
    ? { top: PANEL_H + TAIL_GAP }
    : { top: -(TAIL_H + TAIL_GAP) };
  const tailBorderSide = isTop ? 'borderTop' : 'borderBottom';

  if (!exists) {
    return (
      <div style={{ position: 'absolute', ...pos, width: PANEL_W, height: PANEL_H }}>
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)', ...tailPos,
          width: 0, height: 0,
          borderLeft: `${TAIL_W}px solid transparent`,
          borderRight: `${TAIL_W}px solid transparent`,
          [tailBorderSide]: `${TAIL_H}px solid rgba(255,255,255,0.05)`,
        }}/>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 12,
          background: 'rgba(3,10,22,0.40)',
          border: '1px solid rgba(255,255,255,0.04)',
          opacity: 0.35,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a2a40' }}/>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', ...pos, width: PANEL_W, height: PANEL_H, zIndex: 12 }}>
      {/* Connector tail — visually anchors the panel to its board corner */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)', ...tailPos,
        width: 0, height: 0,
        borderLeft: `${TAIL_W}px solid transparent`,
        borderRight: `${TAIL_W}px solid transparent`,
        [tailBorderSide]: `${TAIL_H}px solid ${isActive ? neon : col + '55'}`,
        filter: isActive ? `drop-shadow(0 0 3px ${neon})` : 'none',
        transition: 'border-color 0.4s',
        pointerEvents: 'none',
      }}/>
    <motion.div
      onClick={canTap ? onRoll : undefined}
      whileTap={canTap ? { scale: 0.91 } : {}}
      animate={isActive ? {
        boxShadow: [
          `0 0 14px ${col}40, inset 0 0 10px ${col}14`,
          `0 0 28px ${neon}65, inset 0 0 18px ${col}28`,
          `0 0 14px ${col}40, inset 0 0 10px ${col}14`,
        ],
      } : {
        boxShadow: `0 2px 10px rgba(0,0,0,0.55)`,
      }}
      transition={{ duration: 1.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-evenly',
        padding: '6px 4px',
        borderRadius: 12,
        cursor: canTap ? 'pointer' : 'default',
        background: isActive
          ? `linear-gradient(145deg, ${col}38 0%, ${col}12 100%)`
          : `linear-gradient(145deg, ${col}16 0%, rgba(4,12,26,0.90) 100%)`,
        border: `1.5px solid ${isActive ? neon : col + '38'}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'background 0.4s, border-color 0.4s',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Active edge shimmer */}
      {isActive && (
        <motion.div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 1.5,
          background: `linear-gradient(90deg, transparent, ${neon}cc, transparent)`,
          pointerEvents: 'none',
        }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Colour dot + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <motion.div
          animate={isActive
            ? { boxShadow: [`0 0 3px ${neon}80`, `0 0 10px ${neon}`, `0 0 3px ${neon}80`] }
            : {}}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }}
        />
        <span style={{
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9,
          color: isActive ? neon : col + '90',
          letterSpacing: '0.05em', textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {name.slice(0, 4)}
        </span>
        {isAI && <Bot size={8} color="rgba(255,255,255,0.30)" style={{ flexShrink: 0 }}/>}
      </div>

      {/* Die face with pulse ring */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {canTap && !rolling && (
          <motion.div style={{
            position: 'absolute', inset: -6, borderRadius: 10,
            border: `1.5px solid ${neon}`,
            pointerEvents: 'none',
          }}
            animate={{ scale: [1, 1.22, 1], opacity: [0.80, 0, 0.80] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <DieFace
          value={diceVal} neon={neon} col={col}
          size={36}
          rolling={isRollingMe}
          justLanded={justLanded && isActive}
          dim={!isActive}
        />
      </div>

      {/* TAP / rolling label — fixed height so panel doesn't resize */}
      <div style={{ height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {canTap && !isRollingMe ? (
            <motion.span key="tap"
              initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              style={{
                fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700,
                color: neon, letterSpacing: '0.08em',
                textShadow: `0 0 7px ${neon}`,
              }}>
              {lang === 'ar' ? 'ارمِ' : 'TAP'}
            </motion.span>
          ) : isRollingMe ? (
            <motion.span key="roll"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, color: 'rgba(255,255,255,0.40)' }}>
              …
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Token progress dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map(i => {
          const p  = pieces[i];
          const st = !p ? 'none'
                   : p.relPos === E.FINISHED_POS ? 'done'
                   : p.relPos >= 0 ? 'on'
                   : 'home';
          return (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: st === 'done' ? neon : st === 'on' ? col : `${col}35`,
              border: `0.5px solid ${col}45`,
              boxShadow: st === 'done' ? `0 0 5px ${neon}` : 'none',
              transition: 'all 0.3s',
            }}/>
          );
        })}
      </div>
    </motion.div>
    </div>
  );
}

// ─── Player chip (header bar — name + colour only, no dice) ───────────────────
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
        borderRadius: 12, padding: '5px 8px', minWidth: 52,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
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
        {/* ── Deep gem body gradient (white highlight → neon → color) ── */}
        {E.PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`pg${i}`} cx="30%" cy="22%" r="80%">
            <stop offset="0%"   stopColor="white"            stopOpacity="0.98"/>
            <stop offset="15%"  stopColor={E.PLAYER_NEONS[i]} stopOpacity="0.90"/>
            <stop offset="48%"  stopColor={c}/>
            <stop offset="100%" stopColor={c}               stopOpacity="0.50"/>
          </radialGradient>
        ))}
        {/* ── Metallic rim gradient (diagonal light sweep) ── */}
        {E.PLAYER_NEONS.map((n, i) => (
          <linearGradient key={i} id={`pgrim${i}`} x1="15%" y1="15%" x2="90%" y2="90%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.98"/>
            <stop offset="30%"  stopColor={n}     stopOpacity="0.80"/>
            <stop offset="65%"  stopColor="#000000" stopOpacity="0.20"/>
            <stop offset="100%" stopColor={n}     stopOpacity="0.38"/>
          </linearGradient>
        ))}
        {/* ── Inner jewel table gradient ── */}
        {E.PLAYER_NEONS.map((n, i) => (
          <radialGradient key={i} id={`jewel${i}`} cx="32%" cy="25%" r="75%">
            <stop offset="0%"   stopColor="white" stopOpacity="1.0"/>
            <stop offset="28%"  stopColor={n}/>
            <stop offset="100%" stopColor={E.PLAYER_COLORS[i]} stopOpacity="0.80"/>
          </radialGradient>
        ))}
        {/* ── Crown spike gradient (white tip → neon → color base) ── */}
        {E.PLAYER_NEONS.map((n, i) => (
          <linearGradient key={i} id={`pgcrwn${i}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.98"/>
            <stop offset="45%"  stopColor={n}     stopOpacity="0.92"/>
            <stop offset="100%" stopColor={E.PLAYER_COLORS[i]} stopOpacity="0.70"/>
          </linearGradient>
        ))}
        {/* ── Home base atmospheric radial gradient ── */}
        {E.PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`hbg${i}`} cx="50%" cy="50%" r="75%">
            <stop offset="0%"   stopColor={c} stopOpacity="0.22"/>
            <stop offset="55%"  stopColor={c} stopOpacity="0.10"/>
            <stop offset="100%" stopColor={c} stopOpacity="0.01"/>
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

      {/* ── Home zones — Crystal Nexus Chambers ── */}
      {[0,1,2,3].map(player => {
        const [zr, zc] = [[0,0],[0,9],[9,9],[9,0]][player] as [number,number];
        const col  = E.PLAYER_COLORS[player];
        const neon = E.PLAYER_NEONS[player];
        const exists    = player < game.numPlayers;
        const isCurrent = player === game.activePlayer && game.phase !== 'done';
        const bLen = 0.85;
        const corners: [[number,number],[number,number],[number,number]][] = [
          [[zc+bLen,zr],[zc,zr],[zc,zr+bLen]],
          [[zc+6-bLen,zr],[zc+6,zr],[zc+6,zr+bLen]],
          [[zc,zr+6-bLen],[zc,zr+6],[zc+bLen,zr+6]],
          [[zc+6-bLen,zr+6],[zc+6,zr+6],[zc+6,zr+6-bLen]],
        ];
        return (
          <g key={`hz-${player}`}>
            {/* Dark crystalline base */}
            <rect x={zc} y={zr} width="6" height="6" fill="#020912" fillOpacity="0.96"/>
            {/* Radial color atmosphere */}
            <rect x={zc} y={zr} width="6" height="6"
              fill={`url(#hbg${player})`}
              fillOpacity={isCurrent ? 1.0 : exists ? 0.55 : 0.14}
            />
            {/* Outer border */}
            <rect x={zc} y={zr} width="6" height="6" fill="none"
              stroke={neon}
              strokeWidth={isCurrent ? 0.09 : 0.05}
              strokeOpacity={isCurrent ? 0.82 : exists ? 0.36 : 0.10}
            />
            {/* HUD corner brackets */}
            {corners.map(([[x1,y1],[x2,y2],[x3,y3]], ci) => (
              <polyline key={ci}
                points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                stroke={neon} strokeWidth="0.11"
                strokeOpacity={isCurrent ? 0.95 : exists ? 0.52 : 0.14}
                fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
            ))}
            {/* Outer dashed orbital ring */}
            <circle cx={zc+3} cy={zr+3} r="2.26"
              fill="none" stroke={neon} strokeWidth="0.028"
              strokeOpacity={isCurrent ? 0.42 : exists ? 0.18 : 0.05}
              strokeDasharray="0.20 0.13"
            />
            {/* Middle solid orbital ring */}
            <circle cx={zc+3} cy={zr+3} r="1.56"
              fill="none" stroke={neon} strokeWidth="0.052"
              strokeOpacity={isCurrent ? 0.62 : exists ? 0.28 : 0.07}
            />
            {/* 8 tick marks on middle ring */}
            {Array.from({length: 8}, (_, ti) => {
              const a = (ti * Math.PI) / 4;
              return (
                <line key={ti}
                  x1={zc+3 + Math.cos(a)*1.46} y1={zr+3 + Math.sin(a)*1.46}
                  x2={zc+3 + Math.cos(a)*1.66} y2={zr+3 + Math.sin(a)*1.66}
                  stroke={neon} strokeWidth="0.038"
                  strokeOpacity={isCurrent ? 0.68 : exists ? 0.30 : 0.08}
                />
              );
            })}
            {/* Inner glow ring */}
            <circle cx={zc+3} cy={zr+3} r="0.84"
              fill={col} fillOpacity={isCurrent ? 0.24 : exists ? 0.10 : 0.03}
              stroke={neon} strokeWidth="0.068"
              strokeOpacity={isCurrent ? 0.85 : exists ? 0.38 : 0.09}
            />
            {/* Energy lines from center to slot positions */}
            {E.HOME_BASES[player].map(([br, bc], si) => (
              <line key={si}
                x1={zc+3} y1={zr+3} x2={bc+0.5} y2={br+0.5}
                stroke={neon} strokeWidth="0.024"
                strokeOpacity={exists ? 0.20 : 0.04}
              />
            ))}
            {/* Center nexus — pulses when active */}
            {isCurrent ? (
              <motion.circle cx={zc+3} cy={zr+3} r={0.22} fill={neon}
                animate={{ r: [0.17, 0.27, 0.17], fillOpacity: [0.80, 1.0, 0.80] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : (
              <circle cx={zc+3} cy={zr+3} r="0.20"
                fill={neon} fillOpacity={exists ? 0.62 : 0.10}
              />
            )}
            {/* Slot landing pads */}
            {E.HOME_BASES[player].map(([br, bc], si) => {
              const sx = bc+0.5, sy = br+0.5;
              return (
                <g key={si}>
                  {/* Outer glow halo */}
                  <circle cx={sx} cy={sy} r="0.56"
                    fill={neon} fillOpacity={exists ? 0.07 : 0.015}/>
                  {/* Outer dark ring */}
                  <circle cx={sx} cy={sy} r="0.46"
                    fill="#020912" fillOpacity="0.88"
                    stroke={neon} strokeWidth="0.058"
                    strokeOpacity={exists ? 0.55 : 0.10}
                  />
                  {/* Mid colored ring */}
                  <circle cx={sx} cy={sy} r="0.31"
                    fill={col} fillOpacity={exists ? 0.18 : 0.04}
                    stroke={neon} strokeWidth="0.034"
                    strokeOpacity={exists ? 0.40 : 0.08}
                  />
                  {/* Deep concave well */}
                  <circle cx={sx} cy={sy} r="0.17" fill="rgba(0,0,0,0.80)"/>
                  {/* Inner jewel dot */}
                  <circle cx={sx} cy={sy} r="0.076"
                    fill={neon} fillOpacity={exists ? 0.92 : 0.12}
                  />
                  {/* Specular glint */}
                  <circle cx={sx-0.05} cy={sy-0.05} r="0.032"
                    fill="white" opacity={exists ? 0.58 : 0.08}
                  />
                </g>
              );
            })}
            {/* Player label */}
            {exists && (
              <text
                x={zc+3}
                y={zr + (player >= 2 ? 5.62 : 0.88)}
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

      {/* ── Pieces — Crystal Crown Gems ── */}
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
            {/* Ambient glow aura */}
            <circle cx={0} cy={0} r={R*1.60} fill={neon} fillOpacity="0.05"/>
            {/* Movable pulse ring */}
            {isMovable && (
              <motion.circle cx={0} cy={0} r={R+0.16} fill="none"
                stroke={neon} strokeWidth="0.09"
                animate={{ opacity: [0.20, 0.90, 0.20], r: [R+0.09, R+0.26, R+0.09] }}
                transition={{ duration: 0.90, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Drop shadow */}
            <ellipse cx={0.03} cy={R*0.92} rx={R*0.76} ry={R*0.22}
              fill="rgba(0,0,0,0.68)"/>
            {/* Gem body */}
            <circle cx={0} cy={0} r={R}
              fill={`url(#pg${player})`}
              filter={isMovable ? `url(#pglow${player})` : undefined}
            />
            {/* Metallic outer rim */}
            <circle cx={0} cy={0} r={R - 0.018}
              fill="none"
              stroke={isMovable ? neon : `url(#pgrim${player})`}
              strokeWidth={isMovable ? 0.060 : 0.036}
            />
            {/* Internal gem facets */}
            <line x1={-R*0.52} y1={-R*0.72} x2={R*0.22} y2={R*0.72}
              stroke="white" strokeWidth="0.013" strokeOpacity="0.18"/>
            <line x1={-R*0.82} y1={-R*0.08} x2={R*0.82} y2={R*0.08}
              stroke="white" strokeWidth="0.010" strokeOpacity="0.12"/>
            <line x1={R*0.52} y1={-R*0.72} x2={-R*0.22} y2={R*0.72}
              stroke="white" strokeWidth="0.011" strokeOpacity="0.10"/>
            {/* Crown spikes — 3 points emerging from top of gem */}
            <polygon
              points="-0.127,-0.348 -0.212,-0.453 -0.080,-0.371 0,-0.500 0.080,-0.371 0.212,-0.453 0.127,-0.348"
              fill={`url(#pgcrwn${player})`}
              stroke={neon} strokeWidth="0.014" strokeOpacity="0.72"
              strokeLinejoin="round"
            />
            {/* Inner jewel table */}
            <circle cx={0} cy={-R*0.07} r={R*0.41}
              fill={`url(#jewel${player})`} opacity="0.88"/>
            {/* Jewel setting ring */}
            <circle cx={0} cy={-R*0.07} r={R*0.41}
              fill="none" stroke="white" strokeWidth="0.014" strokeOpacity="0.22"/>
            {/* Primary specular catchlight */}
            <ellipse cx={-R*0.24} cy={-R*0.36} rx={R*0.19} ry={R*0.13}
              fill="white" opacity="0.88"/>
            {/* Secondary specular */}
            <circle cx={R*0.16} cy={-R*0.50} r={R*0.08}
              fill="white" opacity="0.62"/>
            {/* Micro rim glint */}
            <circle cx={-R*0.70} cy={-R*0.16} r={R*0.05}
              fill="white" opacity="0.50"/>
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
      <div className="relative z-10 flex-shrink-0 flex items-center gap-2 px-3 pt-10 pb-3">
        {/* Back */}
        <motion.button onClick={onBack}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ArrowLeft className="w-4 h-4 text-white"
            style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}/>
        </motion.button>

        {/* Player chips — colour + name only; dice panels live at board corners */}
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

      {/* ── Board + corner dice panels ── */}
      {/* Vertical padding reserves room for the panels hovering above/below the
          frame (never clips into header/status bar). Horizontal padding is a
          minimal fixed margin since panels hug the frame's own edge rather
          than overhanging sideways — on this portrait screen, board size is
          bottlenecked by WIDTH, so keeping side margins small is what lets the
          board grow to fill the available space. */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center"
        style={{
          paddingTop:    PANEL_H + PANEL_GAP + 4,
          paddingBottom: PANEL_H + PANEL_GAP + 4,
          paddingLeft:   BOARD_MARGIN,
          paddingRight:  BOARD_MARGIN,
        }}>
        <motion.div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxHeight: 'calc(100% - 4px)',
            boxSizing: 'border-box',
            borderRadius: 22,
            overflow: 'visible',
            padding: '6px',
            background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #0e2647 0%, #030b16 70%)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
          animate={{
            boxShadow: [
              `0 0 28px ${activeColor}28, 0 0 60px rgba(0,0,0,0.65)`,
              `0 0 48px ${activeColor}55, 0 0 80px rgba(0,0,0,0.65)`,
              `0 0 28px ${activeColor}28, 0 0 60px rgba(0,0,0,0.65)`,
            ],
          }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}>

          {/* Inner felt — live SVG board, clipped to the rounded frame */}
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.60), inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}>
            <BoardSVG game={game} onPieceClick={handlePieceClick} springCfg={springCfg}/>
          </div>

          {/* ── Corner dice panels — outside the board, adjacent to each corner ── */}
          {/* Red   → top-left    (player 0) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={0} anchor="tl" isAI={false}/>
          {/* Blue  → top-right   (player 1) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={1} anchor="tr" isAI={isComputer}/>
          {/* Yellow → bottom-right (player 2) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={2} anchor="br" isAI={isComputer}/>
          {/* Green  → bottom-left  (player 3) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={3} anchor="bl" isAI={isComputer}/>
        </motion.div>
      </div>

      {/* ── Status bar ── */}
      <div className="relative z-10 flex-shrink-0 px-4 pt-3 pb-8">
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
