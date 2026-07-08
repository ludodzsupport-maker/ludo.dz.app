import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bot, RotateCcw, Trophy } from 'lucide-react';
import { GamePiece } from './GamePiece';
import * as E from '../lib/ludo-engine';
import type { GameConfig } from './GameConfigOverlay';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  config: GameConfig;
  lang: 'fr' | 'ar';
  onBack: () => void;
}

// ─── Dice dot layouts (in -3..+3 space matching DiceFace viewBox) ─────────────
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.9, -0.9], [0.9, 0.9]],
  3: [[-0.9, -0.9], [0, 0], [0.9, 0.9]],
  4: [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]],
  5: [[-0.9, -0.9], [0.9, -0.9], [0, 0], [-0.9, 0.9], [0.9, 0.9]],
  6: [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0], [0.9, 0], [-0.9, 0.9], [0.9, 0.9]],
};

// ─── Per-player dice SVG positions (x=col, y=row) ─────────────────────────────
// Placed in the gap between piece slots and home-zone inner circle — no overlap.
// Home-zone centers: Red=(3,12), Blue=(3,3), Yellow=(12,3), Green=(12,12).
// Piece slots sit ~±1.5 from zone center, so we offset slightly inward.
const DICE_POSITIONS: readonly [number, number][] = [
  [2.8, 11.8],  // Player 0 – Red   (bottom-left)
  [2.8,  2.2],  // Player 1 – Blue  (top-left)
  [11.2,  2.2], // Player 2 – Yellow (top-right)
  [11.2, 11.8], // Player 3 – Green  (bottom-right)
] as const;

// Scale factor: dice face viewBox is 6 units wide; 0.30 → 1.8 SVG units per die
const DICE_S = 0.30;

// ─── Board cell classification ────────────────────────────────────────────────
type CellKind = 'home' | 'strip' | 'homecol' | 'path' | 'center' | 'outside';
interface Cell { kind: CellKind; player?: number }

function classifyCell(r: number, c: number): Cell {
  if (r >= 9 && c <= 5)  return { kind: 'home', player: 0 };
  if (r <= 5 && c <= 5)  return { kind: 'home', player: 1 };
  if (r <= 5 && c >= 9)  return { kind: 'home', player: 2 };
  if (r >= 9 && c >= 9)  return { kind: 'home', player: 3 };
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { kind: 'center' };
  const inCross = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
  if (!inCross) return { kind: 'outside' };
  if (r === 6 && c >= 1 && c <= 5)  return { kind: 'strip',   player: 0 };
  if (c === 8 && r >= 1 && r <= 5)  return { kind: 'strip',   player: 1 };
  if (r === 8 && c >= 9 && c <= 13) return { kind: 'strip',   player: 2 };
  if (c === 6 && r >= 9 && r <= 13) return { kind: 'strip',   player: 3 };
  if (r === 7 && c >= 1 && c <= 6)  return { kind: 'homecol', player: 0 };
  if (c === 7 && r >= 1 && r <= 6)  return { kind: 'homecol', player: 1 };
  if (r === 7 && c >= 8 && c <= 13) return { kind: 'homecol', player: 2 };
  if (c === 7 && r >= 8 && r <= 13) return { kind: 'homecol', player: 3 };
  return { kind: 'path' };
}

const GRID: Cell[][] = Array.from({ length: 15 }, (_, r) =>
  Array.from({ length: 15 }, (_, c) => classifyCell(r, c))
);

const PATH_POS_MAP: Map<string, number> = new Map(
  E.MAIN_PATH.map(([r, c], i) => [`${r},${c}`, i])
);

// ─── Piece display position ───────────────────────────────────────────────────
function getPieceXY(piece: E.Piece, allPieces: E.Piece[]): [number, number] {
  if (piece.relPos === -1) {
    const [br, bc] = E.HOME_BASES[piece.player][piece.index];
    return [bc + 0.5, br + 0.5];
  }
  if (piece.relPos === E.FINISHED_POS) {
    const finished = allPieces.filter(p => p.relPos === E.FINISHED_POS);
    const idx = finished.indexOf(piece);
    const off: [number, number][] = [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22],
                                     [0,-0.22],[0,0.22],[-0.22,0],[0.22,0]];
    const [dx, dy] = off[idx % 8] || [0, 0];
    return [7.5 + dx, 7.5 + dy];
  }
  const gp = E.getGridPos(piece.player, piece.relPos);
  if (!gp) return [7.5, 7.5];
  const [row, col] = gp;
  const cx = col + 0.5, cy = row + 0.5;
  const sharers = allPieces.filter(p => {
    if (p === piece || p.relPos < 0 || p.relPos === E.FINISHED_POS) return false;
    const g2 = E.getGridPos(p.player, p.relPos);
    return g2 && g2[0] === row && g2[1] === col;
  });
  if (!sharers.length) return [cx, cy];
  const stack = [piece, ...sharers].sort(
    (a, b) => a.player * 4 + a.index - (b.player * 4 + b.index)
  );
  const rank = stack.indexOf(piece);
  const offsets: [number, number][] = [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]];
  const [dx, dy] = offsets[rank % 4] || [0, 0];
  return [cx + dx, cy + dy];
}

// ─── Inline Dice (SVG <g> element for embedding inside the board) ─────────────
interface InlineDiceProps {
  player: number;
  value: number;
  isActive: boolean;
  isRolling: boolean;
  justLanded: boolean;
  canClick: boolean;
  onDiceClick: () => void;
}

function InlineDice({
  player, value, isActive, isRolling, justLanded, canClick, onDiceClick,
}: InlineDiceProps) {
  const neon   = E.PLAYER_NEONS[player];
  const col    = E.PLAYER_COLORS[player];
  const [dx, dy] = DICE_POSITIONS[player];
  const dots   = DICE_DOTS[value] ?? DICE_DOTS[1];
  const S      = DICE_S;

  // Rolling: rapid shake. Landed: snappy bounce. Idle: nothing.
  const rollVariants = isRolling
    ? { rotate: [0, 22, -18, 16, -12, 8, -4, 0], scale: [1, 1.04, 0.98, 1.02, 0.99, 1] }
    : justLanded
    ? { rotate: 0, scale: [1.35, 0.82, 1.10, 0.95, 1.0] }
    : { rotate: 0, scale: 1 };

  const rollTransition = isRolling
    ? { duration: 0.44, repeat: Infinity, ease: 'linear' as const }
    : justLanded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? { duration: 0.48, ease: [0.22, 1.6, 0.36, 1] as any }
    : { duration: 0.25 };

  return (
    <g transform={`translate(${dx}, ${dy})`}>
      {/* Ambient glow halo */}
      {isActive && (
        <motion.circle
          cx={0} cy={0} r={S * 4.5}
          fill={col}
          animate={{ opacity: [0.10, 0.28, 0.10], r: [S * 4.2, S * 5.0, S * 4.2] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* Outer active ring — pulses when it's your turn to roll */}
      {isActive && canClick && (
        <motion.rect
          x={-S * 3.8} y={-S * 3.8} width={S * 7.6} height={S * 7.6}
          rx={S * 1.4} fill="none"
          stroke={neon} strokeWidth={S * 0.28}
          animate={{ opacity: [0.45, 1.0, 0.45], strokeWidth: [S * 0.20, S * 0.36, S * 0.20] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        />
      )}

      {/* The dice — animated wrapper */}
      <motion.g
        animate={rollVariants}
        transition={rollTransition}
        style={{ cursor: canClick ? 'pointer' : 'default' }}
        onClick={canClick ? onDiceClick : undefined}
      >
        {/* Scaled dice face */}
        <g transform={`scale(${S})`}>
          {/* Shadow beneath the die */}
          <ellipse cx={0.2} cy={0.3} rx={2.6} ry={0.9}
            fill="rgba(0,0,0,0.35)" />
          {/* Dice body */}
          <rect x="-3" y="-3" width="6" height="6" rx="1.0"
            fill={isActive ? col : 'rgba(20,30,50,0.85)'}
            fillOpacity={isActive ? 0.22 : 0.60}
            stroke={neon}
            strokeWidth={isActive ? 0.26 : 0.12}
            opacity={isActive ? 1 : 0.28}
          />
          {/* Glass sheen */}
          {isActive && (
            <rect x="-2.6" y="-2.7" width="2.2" height="0.9" rx="0.4"
              fill="white" opacity={0.20} />
          )}
          {/* Dots */}
          {dots.map(([ddx, ddy], i) => (
            <circle key={i} cx={ddx} cy={ddy} r={isActive ? 0.60 : 0.45}
              fill={neon} opacity={isActive ? 1 : 0.22}
            />
          ))}
          {/* Dot glow (active only) */}
          {isActive && dots.map(([ddx, ddy], i) => (
            <circle key={`g${i}`} cx={ddx} cy={ddy} r={0.80}
              fill={neon} opacity={0.18} />
          ))}
          {/* Invisible large click target */}
          <rect x="-4" y="-4" width="8" height="8" fill="transparent" />
        </g>
      </motion.g>
    </g>
  );
}

// ─── BoardSVG ─────────────────────────────────────────────────────────────────
interface BoardSVGProps {
  game: E.GameState;
  onPieceClick: (pid: string) => void;
  onDiceClick: () => void;
  rolling: boolean;
  canRoll: boolean;
  displayDiceByPlayer: Record<number, number>;
  justLandedPlayer: number | null;
}

function BoardSVG({
  game, onPieceClick, onDiceClick, rolling, canRoll,
  displayDiceByPlayer, justLandedPlayer,
}: BoardSVGProps) {
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const pieces      = game.pieces;

  const piecePositions = useMemo(() =>
    pieces.map(p => ({ ...p, xy: getPieceXY(p, pieces) })),
    [pieces]
  );

  // Cells that light up when movable pieces could move there
  const movableHighlights = useMemo(() => {
    if (game.phase !== 'selecting' || !game.movable.length) return [];
    return game.movable.map(pid => {
      const [ps, is] = pid.split(':').map(Number);
      const piece = pieces.find(p => p.player === ps && p.index === is);
      if (!piece || piece.relPos < 0) return null;
      const gp = E.getGridPos(piece.player, piece.relPos);
      if (!gp) return null;
      return { col: gp[1], row: gp[0], neon: E.PLAYER_NEONS[piece.player] };
    }).filter(Boolean) as { col: number; row: number; neon: string }[];
  }, [game.movable, game.phase, pieces]);

  return (
    <svg
      viewBox="0 0 15 15"
      style={{ width: '100%', height: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Piece radial gradients */}
        {E.PLAYER_COLORS.map((col, i) => (
          <radialGradient key={i} id={`pg${i}`} cx="35%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.75" />
            <stop offset="30%"  stopColor={col} />
            <stop offset="100%" stopColor={col} stopOpacity="0.85" />
          </radialGradient>
        ))}
        {/* Piece glow filters */}
        {E.PLAYER_NEONS.map((_, i) => (
          <filter key={i} id={`pg-glow-${i}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.20" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
        {/* Star glow */}
        <filter id="star-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.09" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Active tile glow */}
        <filter id="tile-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.15" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Background ── */}
      <rect width="15" height="15" fill="#040c18" />

      {/* ── Subtle radial ambient on active corner ── */}
      <radialGradient id="corner-ambient" cx="50%" cy="50%" r="70%">
        <stop offset="0%"   stopColor={activeColor} stopOpacity="0.12" />
        <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
      </radialGradient>

      {/* ── Corner home zones ── */}
      {[0,1,2,3].map(player => {
        const [zr, zc] = [[9,0],[0,0],[0,9],[9,9]][player] as [number, number];
        const col   = E.PLAYER_COLORS[player];
        const neon  = E.PLAYER_NEONS[player];
        const active = player < game.numPlayers;
        const isCurrentPlayer = player === game.activePlayer && game.phase !== 'done';
        return (
          <g key={`home-${player}`}>
            <rect x={zc} y={zr} width="6" height="6"
              fill={col}
              fillOpacity={isCurrentPlayer ? 0.16 : active ? 0.09 : 0.02}
              stroke={neon}
              strokeWidth={isCurrentPlayer ? 0.09 : 0.06}
              strokeOpacity={isCurrentPlayer ? 0.90 : active ? 0.55 : 0.18}
            />
            {/* Inner circle */}
            <circle cx={zc + 3} cy={zr + 3} r="2.3"
              fill={col}
              fillOpacity={isCurrentPlayer ? 0.22 : active ? 0.14 : 0.03}
              stroke={neon}
              strokeWidth={isCurrentPlayer ? 0.11 : 0.08}
              strokeOpacity={isCurrentPlayer ? 0.75 : active ? 0.45 : 0.12}
            />
            {/* Piece slots */}
            {E.HOME_BASES[player].map(([br, bc], si) => (
              <circle key={si} cx={bc + 0.5} cy={br + 0.5} r="0.44"
                fill="rgba(0,0,0,0.40)"
                stroke={neon}
                strokeWidth="0.055"
                strokeOpacity={active ? 0.40 : 0.10}
              />
            ))}
            {/* Corner player label */}
            {active && (
              <text
                x={zc + 3}
                y={zr + (player >= 2 ? 5.55 : 0.88)}
                textAnchor="middle" fontSize="0.40"
                fontFamily="Rajdhani, sans-serif" fontWeight="700"
                fill={neon} opacity={isCurrentPlayer ? 0.90 : 0.50}
              >
                {['R','B','Y','G'][player]}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Cross path cells ── */}
      {GRID.flatMap((row, r) =>
        row.map((cell, c) => {
          if (cell.kind === 'home' || cell.kind === 'center' || cell.kind === 'outside') return null;

          const pathPos = PATH_POS_MAP.get(`${r},${c}`);
          const isStar  = pathPos !== undefined && E.SAFE_SET.has(pathPos);
          const isStart = pathPos !== undefined && (E.PLAYER_STARTS as readonly number[]).includes(pathPos);
          const player  = cell.player ?? -1;

          let fill = 'rgba(255,255,255,0.055)';
          let fillOp = 1;

          if (cell.kind === 'strip') {
            fill   = E.PLAYER_COLORS[player];
            fillOp = player < game.numPlayers ? 0.30 : 0.07;
          } else if (cell.kind === 'homecol') {
            const depth = (() => {
              if (r === 7) return player === 0 ? c - 1 : 13 - c;
              return player === 1 ? r - 1 : 13 - r;
            })();
            fill   = E.PLAYER_COLORS[player];
            fillOp = player < game.numPlayers ? 0.20 + depth * 0.06 : 0.04;
          }

          const starColor = isStart
            ? E.PLAYER_NEONS[(E.PLAYER_STARTS as readonly number[]).indexOf(pathPos as number)]
            : 'rgba(255,255,255,0.55)';

          return (
            <g key={`${r}-${c}`}>
              <rect x={c} y={r} width="1" height="1"
                fill={fill} fillOpacity={fillOp}
                stroke="rgba(255,255,255,0.07)" strokeWidth="0.030"
              />
              {/* Glass sheen */}
              <rect x={c + 0.05} y={r + 0.05} width="0.32" height="0.16" rx="0.06"
                fill="rgba(255,255,255,0.08)"
              />
              {/* Star / start marker */}
              {isStar && (
                <text x={c + 0.5} y={r + 0.67} textAnchor="middle"
                  fontSize="0.44" fill={starColor} filter="url(#star-glow)">
                  ✦
                </text>
              )}
            </g>
          );
        })
      )}

      {/* ── Movable-piece tile highlights ── */}
      {movableHighlights.map(({ col, row, neon }, i) => (
        <motion.rect key={`hi-${i}`}
          x={col} y={row} width={1} height={1}
          fill={neon}
          rx={0.12}
          filter="url(#tile-glow)"
          animate={{ opacity: [0.10, 0.32, 0.10] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
        />
      ))}

      {/* ── Center 3×3 triangles ── */}
      <polygon points="6,6 9,6 7.5,7.5"
        fill={E.PLAYER_COLORS[1]} opacity={1 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="9,6 9,9 7.5,7.5"
        fill={E.PLAYER_COLORS[2]} opacity={2 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="9,9 6,9 7.5,7.5"
        fill={E.PLAYER_COLORS[3]} opacity={3 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="6,9 6,6 7.5,7.5"
        fill={E.PLAYER_COLORS[0]} opacity="0.55" />
      <rect x="6" y="6" width="3" height="3" fill="none"
        stroke="rgba(255,255,255,0.14)" strokeWidth="0.06" />
      <circle cx="7.5" cy="7.5" r="0.55" fill="white" opacity="0.18" />

      {/* ── Board outer neon border ── */}
      <rect x="0.05" y="0.05" width="14.90" height="14.90"
        fill="none" stroke={activeNeon} strokeWidth="0.10" strokeOpacity="0.55" rx="0.20"
      />

      {/* ── Per-player dice (one per corner) ── */}
      {Array.from({ length: game.numPlayers }, (_, player) => {
        const isActive    = player === game.activePlayer && game.phase !== 'done';
        const isRolling   = isActive && rolling;
        const justLanded  = justLandedPlayer === player;
        const diceCanClick = isActive && canRoll;
        return (
          <InlineDice key={`dice-${player}`}
            player={player}
            value={displayDiceByPlayer[player] ?? 1}
            isActive={isActive}
            isRolling={isRolling}
            justLanded={justLanded}
            canClick={diceCanClick}
            onDiceClick={onDiceClick}
          />
        );
      })}

      {/* ── Pieces ── */}
      {piecePositions.map(({ player, index, xy: [cx, cy] }) => {
        const pid       = E.pieceId(player, index);
        const isMovable = game.movable.includes(pid);
        const neon      = E.PLAYER_NEONS[player];
        const r         = 0.36;

        return (
          <motion.g
            key={pid}
            animate={{ x: cx, y: cy }}
            initial={{ x: cx, y: cy }}
            transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
            onClick={() => isMovable && onPieceClick(pid)}
            style={{ cursor: isMovable ? 'pointer' : 'default' }}
          >
            {/* Movable pulse ring */}
            {isMovable && (
              <motion.circle cx={0} cy={0} r={r + 0.16} fill="none"
                stroke={neon} strokeWidth="0.10"
                animate={{ opacity: [0.25, 0.95, 0.25], r: [r + 0.08, r + 0.24, r + 0.08] }}
                transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Drop shadow */}
            <ellipse cx={0.04} cy={0.11} rx={r * 0.85} ry={r * 0.33}
              fill="rgba(0,0,0,0.40)" />
            {/* Main piece body */}
            <circle cx={0} cy={0} r={r}
              fill={`url(#pg${player})`}
              stroke={isMovable ? neon : 'rgba(0,0,0,0.35)'}
              strokeWidth={isMovable ? 0.08 : 0.04}
              filter={isMovable ? `url(#pg-glow-${player})` : undefined}
            />
            {/* Specular highlight */}
            <circle cx={-r * 0.38} cy={-r * 0.40} r={r * 0.28}
              fill="white" opacity="0.60" />
          </motion.g>
        );
      })}
    </svg>
  );
}

// ─── Player Chip ──────────────────────────────────────────────────────────────
function PlayerChip({ game, player, isAI, lang }: {
  game: E.GameState; player: number; isAI: boolean; lang: 'fr' | 'ar';
}) {
  const col      = E.PLAYER_COLORS[player];
  const neon     = E.PLAYER_NEONS[player];
  const isActive = game.activePlayer === player && game.phase !== 'done';
  const pieces   = game.pieces.filter(p => p.player === player);
  const name     = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];

  return (
    <motion.div
      animate={{
        scale:     isActive ? 1.07 : 1,
        boxShadow: isActive
          ? `0 0 14px ${neon}88, 0 0 5px ${neon}55, inset 0 0 8px ${col}22`
          : '0 0 0px transparent',
      }}
      transition={{ duration: 0.28 }}
      style={{
        background:   `linear-gradient(135deg, ${col}1a 0%, ${col}09 100%)`,
        border:       `1.5px solid ${isActive ? neon : col + '28'}`,
        borderRadius: '12px',
        padding:      '6px 8px',
        minWidth:     '62px',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* Active top stripe */}
      {isActive && (
        <motion.div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${neon}, transparent)`,
          }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0,
          boxShadow: `0 0 5px ${neon}90`,
        }} />
        <span style={{
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11,
          color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', letterSpacing: '0.05em',
        }}>
          {name}
        </span>
        {isAI && <Bot size={9} color="rgba(255,255,255,0.35)" />}
      </div>
      {/* Piece status dots */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2,3].map(i => {
          const p     = pieces[i];
          const state = !p ? 'none'
                      : p.relPos === E.FINISHED_POS ? 'done'
                      : p.relPos >= 0 ? 'active' : 'home';
          return (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: state === 'done'   ? neon
                        : state === 'active' ? col
                        : state === 'home'   ? `${col}45`
                        : 'transparent',
              border: `1px solid ${col}35`,
              boxShadow: state === 'done' ? `0 0 5px ${neon}` : 'none',
              transition: 'all 0.3s ease',
            }} />
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main GameBoardScreen ─────────────────────────────────────────────────────
export function GameBoardScreen({ config, lang, onBack }: Props) {
  const [game, setGame]       = useState<E.GameState>(() => E.createGame(config.players));
  const [rolling, setRolling] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  // Per-player last-shown dice value (used by corner dice)
  const [displayDiceByPlayer, setDisplayDiceByPlayer] = useState<Record<number, number>>(
    () => ({ 0: 1, 1: 1, 2: 1, 3: 1 })
  );
  // Which player's die just landed (triggers bounce animation)
  const [justLandedPlayer, setJustLandedPlayer] = useState<number | null>(null);

  const rollTimers = useRef<NodeJS.Timeout[]>([]);

  const isComputer  = config.modeId === 'computer';
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const isHumanTurn = !isComputer || game.activePlayer === 0;
  const canRoll     = isHumanTurn && game.phase === 'rolling' && !rolling && !game.winner;

  // ── Roll handler ─────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || game.phase !== 'rolling' || game.winner) return;
    // Capture active player at call time so the closure stays correct
    const rollingPlayer = game.activePlayer;
    setRolling(true);

    let count = 0;
    const cycle = () => {
      const rnd = Math.floor(Math.random() * 6) + 1;
      setDisplayDiceByPlayer(prev => ({ ...prev, [rollingPlayer]: rnd }));
      count++;
      // Ease off: fast starts, slow finish
      const delay = count < 5 ? 55 : 55 + (count - 4) * 22;
      if (count < 11) {
        const t = setTimeout(cycle, delay);
        rollTimers.current.push(t);
      } else {
        const t = setTimeout(() => {
          setGame(prev => {
            const next = E.doRoll(prev);
            setDisplayDiceByPlayer(p => ({ ...p, [rollingPlayer]: next.dice }));
            setRolling(false);
            // Trigger landing animation
            setJustLandedPlayer(rollingPlayer);
            const clear = setTimeout(() => setJustLandedPlayer(null), 520);
            rollTimers.current.push(clear);
            return next;
          });
        }, delay);
        rollTimers.current.push(t);
      }
    };
    cycle();
  }, [rolling, game.phase, game.winner, game.activePlayer]);

  // ── Piece click ───────────────────────────────────────────────────────────
  const handlePieceClick = useCallback((pid: string) => {
    if (!isHumanTurn || !game.movable.includes(pid)) return;
    setGame(prev => E.doMove(prev, pid));
  }, [isHumanTurn, game.movable]);

  // ── Auto-pass when no moves available ────────────────────────────────────
  useEffect(() => {
    if (game.phase !== 'selecting' || game.movable.length > 0 || game.winner) return;
    const t = setTimeout(() => setGame(E.autoPassTurn), 1050);
    return () => clearTimeout(t);
  }, [game.phase, game.movable.length, game.winner]);

  // ── AI roll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'rolling' || rolling || game.winner) return;
    const delay = 680 + Math.random() * 350;
    const t = setTimeout(() => handleRoll(), delay);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, rolling, game.winner, handleRoll]);

  // ── AI move ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'selecting' || !game.movable.length || game.winner) return;
    const pid = E.aiPickMove(game);
    if (!pid) return;
    const t = setTimeout(() => setGame(prev => E.doMove(prev, pid)), 520);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, game.movable.length, game.winner]);

  // ── Cleanup timers ────────────────────────────────────────────────────────
  useEffect(() => () => { rollTimers.current.forEach(clearTimeout); }, []);

  // ── Restart ───────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    rollTimers.current.forEach(clearTimeout);
    rollTimers.current = [];
    setRolling(false);
    setJustLandedPlayer(null);
    setDisplayDiceByPlayer({ 0: 1, 1: 1, 2: 1, 3: 1 });
    setGame(E.createGame(config.players));
    setRestartKey(k => k + 1);
  }, [config.players]);

  // ── UI strings ───────────────────────────────────────────────────────────
  const ui = {
    back:     lang === 'ar' ? 'عودة'        : 'Retour',
    tapDice:  lang === 'ar' ? '▲ انقر على النرد للرمي' : '▲ TAPEZ VOTRE DÉ POUR LANCER',
    select:   lang === 'ar' ? '▲ اختر قطعة'  : '▲ CHOISISSEZ UNE PIÈCE',
    waiting:  lang === 'ar' ? 'الذكاء يفكر…'  : 'IA EN RÉFLEXION…',
  };

  const phaseHint =
    rolling           ? ''
    : game.winner !== null ? ''
    : isHumanTurn && game.phase === 'rolling'               ? ui.tapDice
    : isHumanTurn && game.phase === 'selecting' && game.movable.length > 0 ? ui.select
    : !isHumanTurn                                          ? ui.waiting
    : '';

  return (
    <motion.div
      key={restartKey}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(175deg, #07101f 0%, #0a1628 50%, #060e1a 100%)' }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.30 }}
    >
      {/* ── Floating decorative pieces (background) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { color: '#DC143C', top: '-4%',  right: '-6%',  size: 80, delay: 0  },
          { color: '#1E90FF', top: '20%',  left: '-10%',  size: 60, delay: 4  },
          { color: '#FFD700', bottom: '5%',right: '-4%',  size: 50, delay: 8  },
        ].map(({ color, size, delay, ...pos }, i) => (
          <motion.div key={i} className="absolute opacity-[0.07]"
            style={{ ...pos, width: size, height: size * 1.5 }}
            animate={{ y: [0, 18, 0], rotate: [0, 28, 0] }}
            transition={{ duration: 14 + i * 3, repeat: Infinity, ease: 'easeInOut', delay }}>
            <GamePiece color={color} />
          </motion.div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center gap-3 px-4 pt-10 pb-3 flex-shrink-0">
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <ArrowLeft className="w-5 h-5 text-white"
            style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }} />
        </motion.button>

        {/* Player chips */}
        <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: game.numPlayers }, (_, i) => (
            <PlayerChip key={i} game={game} player={i}
              isAI={isComputer && i !== 0} lang={lang} />
          ))}
        </div>

        <motion.button
          onClick={handleRestart}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <RotateCcw className="w-4 h-4 text-white/60" />
        </motion.button>
      </div>

      {/* ── Board ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-3">
        <motion.div
          style={{
            width: '100%',
            maxWidth: 420,
            aspectRatio: '1',
            position: 'relative',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
          animate={{
            boxShadow: [
              `0 0 22px ${activeColor}28, 0 0 55px rgba(0,0,0,0.65)`,
              `0 0 40px ${activeColor}50, 0 0 70px rgba(0,0,0,0.65)`,
              `0 0 22px ${activeColor}28, 0 0 55px rgba(0,0,0,0.65)`,
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BoardSVG
            game={game}
            onPieceClick={handlePieceClick}
            onDiceClick={handleRoll}
            rolling={rolling}
            canRoll={canRoll}
            displayDiceByPlayer={displayDiceByPlayer}
            justLandedPlayer={justLandedPlayer}
          />
        </motion.div>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="relative z-10 flex-shrink-0 px-4 pb-8 pt-3">
        <div className="flex items-end justify-between gap-3">

          {/* Left: message + phase hint */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {game.message ? (
                <motion.p key={game.message}
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  style={{
                    fontFamily: 'Cairo, sans-serif', fontSize: 14,
                    color: activeNeon, fontWeight: 700, marginBottom: 5,
                    textShadow: `0 0 10px ${activeNeon}60`,
                  }}>
                  {game.message}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {phaseHint && (
                <motion.p key={phaseHint}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    fontFamily: 'Rajdhani, sans-serif', fontSize: 11,
                    color: `${activeNeon}99`, letterSpacing: '0.07em', fontWeight: 600,
                  }}>
                  {phaseHint}
                </motion.p>
              )}
            </AnimatePresence>

            <p style={{
              fontFamily: 'Rajdhani, sans-serif', fontSize: 12,
              color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginTop: 4,
            }}>
              {lang === 'ar' ? E.PLAYER_NAMES_AR[game.activePlayer] : E.PLAYER_NAMES_FR[game.activePlayer].toUpperCase()}
              {game.consecutiveSixes > 0 ? ` · ×${game.consecutiveSixes}` : ''}
            </p>
          </div>

          {/* Right: dice result badge */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            minWidth: 52,
          }}>
            <motion.div
              style={{
                width: 52, height: 52,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${activeColor}25, ${activeColor}10)`,
                border: `1.5px solid ${game.diceRolled ? activeNeon : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: game.diceRolled ? `0 0 14px ${activeColor}55` : 'none',
              }}
              animate={game.diceRolled
                ? { scale: [1, 1.07, 1], boxShadow: [
                    `0 0 10px ${activeColor}40`,
                    `0 0 22px ${activeColor}80`,
                    `0 0 10px ${activeColor}40`,
                  ]}
                : { scale: 1 }}
              transition={{ duration: 2, repeat: game.diceRolled ? Infinity : 0 }}
            >
              <span style={{
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 26,
                color: game.diceRolled ? activeNeon : 'rgba(255,255,255,0.25)',
                textShadow: game.diceRolled ? `0 0 12px ${activeNeon}` : 'none',
                lineHeight: 1,
              }}>
                {game.diceRolled ? game.dice : '?'}
              </span>
            </motion.div>
            <span style={{
              fontFamily: 'Rajdhani, sans-serif', fontSize: 9,
              color: 'rgba(255,255,255,0.30)', letterSpacing: '0.06em',
            }}>
              {lang === 'ar' ? 'النرد' : 'DÉ'}
            </span>
          </div>

        </div>
      </div>

      {/* ── Victory overlay ── */}
      <AnimatePresence>
        {game.winner !== null && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backdropFilter: 'blur(14px)', background: 'rgba(4,12,24,0.90)' }}
          >
            {/* Confetti particles */}
            {Array.from({ length: 20 }, (_, i) => (
              <motion.div key={i}
                className="absolute rounded-full"
                style={{
                  width: 7 + (i % 5) * 4,
                  height: 7 + (i % 5) * 4,
                  background: E.PLAYER_COLORS[i % 4],
                  left: `${8 + (i * 5) % 84}%`,
                  top: `-6%`,
                  opacity: 0.85,
                }}
                animate={{
                  y: ['0vh', '115vh'],
                  rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (18 + i * 4)],
                }}
                transition={{
                  duration: 2.2 + (i % 4) * 0.3,
                  delay: i * 0.07,
                  ease: 'easeIn',
                  repeat: Infinity,
                  repeatDelay: 0.4,
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.55, y: 35, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 270, damping: 22, delay: 0.12 }}
              className="flex flex-col items-center gap-5 px-8 py-10 rounded-3xl"
              style={{
                background: `linear-gradient(145deg, ${E.PLAYER_COLORS[game.winner]}20, rgba(4,12,24,0.96))`,
                border: `2px solid ${E.PLAYER_NEONS[game.winner]}70`,
                boxShadow: `0 0 55px ${E.PLAYER_COLORS[game.winner]}38, 0 0 110px ${E.PLAYER_COLORS[game.winner]}18`,
                maxWidth: '300px',
                width: '90%',
              }}
            >
              <motion.div
                animate={{ rotate: [0, -12, 12, -6, 6, 0], scale: [1, 1.18, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
              >
                <Trophy size={58} color={E.PLAYER_NEONS[game.winner]}
                  style={{ filter: `drop-shadow(0 0 14px ${E.PLAYER_NEONS[game.winner]})` }} />
              </motion.div>

              <div className="text-center">
                <p style={{
                  fontFamily: 'Cairo, sans-serif', color: 'rgba(255,255,255,0.50)',
                  fontSize: 13, marginBottom: 5,
                }}>
                  {lang === 'ar' ? 'الفائز' : 'VAINQUEUR'}
                </p>
                <p style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 36,
                  color: E.PLAYER_NEONS[game.winner], letterSpacing: '0.05em',
                  textShadow: `0 0 24px ${E.PLAYER_NEONS[game.winner]}`,
                }}>
                  {lang === 'ar'
                    ? E.PLAYER_NAMES_AR[game.winner]
                    : E.PLAYER_NAMES_FR[game.winner].toUpperCase()}
                </p>
                {isComputer && game.winner === 0 && (
                  <p style={{
                    fontFamily: 'Cairo, sans-serif', color: E.PLAYER_NEONS[game.winner],
                    fontSize: 14, marginTop: 5, opacity: 0.85,
                  }}>
                    {lang === 'ar' ? '🎉 لقد فزت!' : '🎉 Vous avez gagné !'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 w-full">
                <motion.button
                  onClick={handleRestart}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex-1 py-3 rounded-2xl font-heading font-bold text-sm tracking-wider"
                  style={{
                    background: `linear-gradient(135deg, ${E.PLAYER_COLORS[game.winner]}cc, ${E.PLAYER_COLORS[game.winner]}88)`,
                    border: `1.5px solid ${E.PLAYER_NEONS[game.winner]}`,
                    color: '#fff',
                    boxShadow: `0 0 22px ${E.PLAYER_COLORS[game.winner]}44`,
                  }}>
                  {lang === 'ar' ? 'جولة جديدة' : 'Rejouer'}
                </motion.button>
                <motion.button
                  onClick={onBack}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex-1 py-3 rounded-2xl font-heading font-bold text-sm tracking-wider"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.75)',
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
