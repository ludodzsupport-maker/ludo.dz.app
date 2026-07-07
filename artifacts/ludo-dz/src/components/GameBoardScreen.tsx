import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
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

// ─── Dice dots layout ────────────────────────────────────────────────────────
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.9, -0.9], [0.9, 0.9]],
  3: [[-0.9, -0.9], [0, 0], [0.9, 0.9]],
  4: [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]],
  5: [[-0.9, -0.9], [0.9, -0.9], [0, 0], [-0.9, 0.9], [0.9, 0.9]],
  6: [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0], [0.9, 0], [-0.9, 0.9], [0.9, 0.9]],
};

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

// Pre-compute the board grid once
const GRID: Cell[][] = Array.from({ length: 15 }, (_, r) =>
  Array.from({ length: 15 }, (_, c) => classifyCell(r, c))
);

// Path position lookup by [row,col]
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
  // stack offset when multiple pieces share the same grid cell
  const sharers = allPieces.filter(p => {
    if (p === piece || p.relPos < 0 || p.relPos === E.FINISHED_POS) return false;
    const g2 = E.getGridPos(p.player, p.relPos);
    return g2 && g2[0] === row && g2[1] === col;
  });
  if (!sharers.length) return [cx, cy];
  const stack = [piece, ...sharers].sort((a, b) => a.player * 4 + a.index - (b.player * 4 + b.index));
  const rank = stack.indexOf(piece);
  const offsets: [number, number][] = [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]];
  const [dx, dy] = offsets[rank % 4] || [0,0];
  return [cx + dx, cy + dy];
}

// ─── Dice Face ───────────────────────────────────────────────────────────────
function DiceFace({ value, neon, size = 72 }: { value: number; neon: string; size?: number }) {
  const dots = DICE_DOTS[value] ?? DICE_DOTS[1];
  return (
    <svg width={size} height={size} viewBox="-3 -3 6 6">
      <defs>
        <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
        </linearGradient>
        <filter id="df">
          <feGaussianBlur stdDeviation="0.25" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="-3" y="-3" width="6" height="6" rx="0.9"
        fill="url(#dg)" stroke={neon} strokeWidth="0.22" />
      <rect x="-2.7" y="-2.7" width="2" height="0.7" rx="0.3"
        fill="white" opacity="0.22" />
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="0.55" fill={neon} filter="url(#df)" />
      ))}
    </svg>
  );
}

// ─── Board SVG ────────────────────────────────────────────────────────────────
interface BoardSVGProps {
  game: E.GameState;
  onPieceClick: (pid: string) => void;
}

function BoardSVG({ game, onPieceClick }: BoardSVGProps) {
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const pieces      = game.pieces;

  const piecePositions = useMemo(() =>
    pieces.map(p => ({ ...p, xy: getPieceXY(p, pieces) })),
    [pieces]
  );

  return (
    <svg
      viewBox="0 0 15 15"
      style={{ width: '100%', height: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Piece gradients */}
        {E.PLAYER_COLORS.map((col, i) => (
          <radialGradient key={i} id={`pg${i}`} cx="35%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="white"  stopOpacity="0.75" />
            <stop offset="30%"  stopColor={col} />
            <stop offset="100%" stopColor={col}     stopOpacity="0.85" />
          </radialGradient>
        ))}
        {/* Piece glow filters */}
        {E.PLAYER_NEONS.map((neon, i) => (
          <filter key={i} id={`pg-glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.18" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
        {/* Star glow */}
        <filter id="star-glow">
          <feGaussianBlur stdDeviation="0.08" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Background ── */}
      <rect width="15" height="15" fill="#040c18" />

      {/* ── Corner home zones ── */}
      {[0,1,2,3].map(player => {
        const [zr, zc] = [[9,0],[0,0],[0,9],[9,9]][player] as [number, number];
        const col  = E.PLAYER_COLORS[player];
        const neon = E.PLAYER_NEONS[player];
        const active = player < game.numPlayers;
        return (
          <g key={`home-${player}`}>
            <rect x={zc} y={zr} width="6" height="6"
              fill={col} fillOpacity={active ? 0.10 : 0.03}
              stroke={neon} strokeWidth="0.07" strokeOpacity={active ? 0.7 : 0.2} />
            {/* Inner circle */}
            <circle cx={zc + 3} cy={zr + 3} r="2.3"
              fill={col} fillOpacity={active ? 0.18 : 0.04}
              stroke={neon} strokeWidth="0.09" strokeOpacity={active ? 0.55 : 0.15} />
            {/* Piece slots */}
            {E.HOME_BASES[player].map(([br, bc], si) => (
              <circle key={si} cx={bc + 0.5} cy={br + 0.5} r="0.44"
                fill="rgba(0,0,0,0.35)"
                stroke={neon} strokeWidth="0.055" strokeOpacity={active ? 0.45 : 0.12} />
            ))}
            {/* Corner label */}
            {active && (
              <text x={zc + 3} y={zr + (player >= 2 ? 5.5 : 0.9)}
                textAnchor="middle" fontSize="0.38"
                fontFamily="Rajdhani, sans-serif" fontWeight="700"
                fill={neon} opacity="0.6">
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
            fillOp = player < game.numPlayers ? 0.32 : 0.08;
          } else if (cell.kind === 'homecol') {
            const depth = (() => {
              if (r === 7) return player === 0 ? c - 1 : 13 - c; // Red/Yellow
              return player === 1 ? r - 1 : 13 - r; // Blue/Green
            })();
            fill   = E.PLAYER_COLORS[player];
            fillOp = player < game.numPlayers ? 0.22 + depth * 0.055 : 0.05;
          }

          const starColor = isStart
            ? E.PLAYER_NEONS[E.PLAYER_STARTS.indexOf(pathPos as any)]
            : 'rgba(255,255,255,0.55)';

          return (
            <g key={`${r}-${c}`}>
              <rect x={c} y={r} width="1" height="1"
                fill={fill} fillOpacity={fillOp}
                stroke="rgba(255,255,255,0.09)" strokeWidth="0.035" />
              {/* Glass sheen */}
              <rect x={c + 0.05} y={r + 0.05} width="0.35" height="0.18" rx="0.07"
                fill="rgba(255,255,255,0.09)" />
              {/* Star or start marker */}
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

      {/* ── Center 3×3 (4 triangles) ── */}
      <polygon points="6,6 9,6 7.5,7.5"
        fill={E.PLAYER_COLORS[1]} opacity={1 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="9,6 9,9 7.5,7.5"
        fill={E.PLAYER_COLORS[2]} opacity={2 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="9,9 6,9 7.5,7.5"
        fill={E.PLAYER_COLORS[3]} opacity={3 < game.numPlayers ? 0.55 : 0.15} />
      <polygon points="6,9 6,6 7.5,7.5"
        fill={E.PLAYER_COLORS[0]} opacity="0.55" />
      {/* Center border + glow ring */}
      <rect x="6" y="6" width="3" height="3" fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth="0.06" />
      <circle cx="7.5" cy="7.5" r="0.55"
        fill="white" opacity="0.18" />

      {/* ── Board outer neon border (active player color) ── */}
      <rect x="0.04" y="0.04" width="14.92" height="14.92"
        fill="none" stroke={activeNeon} strokeWidth="0.12" strokeOpacity="0.5" rx="0.25" />

      {/* ── Pieces ── */}
      {piecePositions.map(({ player, index, relPos, xy: [cx, cy] }) => {
        const pid        = E.pieceId(player, index);
        const isMovable  = game.movable.includes(pid);
        const col        = E.PLAYER_COLORS[player];
        const neon       = E.PLAYER_NEONS[player];
        const r          = 0.36;

        return (
          <motion.g
            key={pid}
            animate={{ x: cx, y: cy }}
            initial={{ x: cx, y: cy }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={() => isMovable && onPieceClick(pid)}
            style={{ cursor: isMovable ? 'pointer' : 'default' }}
          >
            {/* Glow pulse ring for movable pieces */}
            {isMovable && (
              <motion.circle cx={0} cy={0} r={r + 0.16} fill="none"
                stroke={neon} strokeWidth="0.09"
                animate={{ opacity: [0.3, 0.9, 0.3], r: [r + 0.1, r + 0.22, r + 0.1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Shadow */}
            <ellipse cx={0.04} cy={0.1} rx={r * 0.85} ry={r * 0.35}
              fill="rgba(0,0,0,0.35)" />
            {/* Main piece circle */}
            <circle cx={0} cy={0} r={r}
              fill={`url(#pg${player})`}
              stroke={isMovable ? neon : 'rgba(0,0,0,0.4)'}
              strokeWidth={isMovable ? 0.07 : 0.04}
              filter={isMovable ? `url(#pg-glow-${player})` : undefined}
            />
            {/* Specular highlight */}
            <circle cx={-r * 0.38} cy={-r * 0.38} r={r * 0.28}
              fill="white" opacity="0.55" />
          </motion.g>
        );
      })}
    </svg>
  );
}

// ─── Player Chip ─────────────────────────────────────────────────────────────
function PlayerChip({ game, player, isAI, lang }: {
  game: E.GameState; player: number; isAI: boolean; lang: 'fr' | 'ar';
}) {
  const col      = E.PLAYER_COLORS[player];
  const neon     = E.PLAYER_NEONS[player];
  const isActive = game.activePlayer === player && game.phase !== 'done';
  const pieces   = game.pieces.filter(p => p.player === player);
  const finished = pieces.filter(p => p.relPos === E.FINISHED_POS).length;
  const onBoard  = pieces.filter(p => p.relPos >= 0 && p.relPos < E.FINISHED_POS).length;
  const name     = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];

  return (
    <motion.div
      animate={{
        scale:     isActive ? 1.06 : 1,
        boxShadow: isActive
          ? `0 0 12px ${neon}88, 0 0 4px ${neon}55, inset 0 0 8px ${col}22`
          : '0 0 0px transparent',
      }}
      transition={{ duration: 0.3 }}
      style={{
        background: `linear-gradient(135deg, ${col}18 0%, ${col}08 100%)`,
        border:      `1.5px solid ${isActive ? neon : col + '30'}`,
        borderRadius: '12px',
        padding:     '6px 8px',
        minWidth:    '64px',
        position:    'relative',
        overflow:    'hidden',
      }}
    >
      {/* Active indicator stripe */}
      {isActive && (
        <motion.div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${neon}, transparent)`,
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0,
          boxShadow: `0 0 4px ${neon}80` }} />
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11,
          color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
          {name}
        </span>
        {isAI && <Bot size={9} color="rgba(255,255,255,0.35)" />}
      </div>
      {/* Piece status dots */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2,3].map(i => {
          const p = pieces[i];
          const state = !p ? 'none' : p.relPos === E.FINISHED_POS ? 'done'
                      : p.relPos >= 0 ? 'active' : 'home';
          return (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: state === 'done'   ? neon
                        : state === 'active' ? col
                        : state === 'home'   ? `${col}50`
                        : 'transparent',
              border: `1px solid ${col}40`,
              boxShadow: state === 'done' ? `0 0 4px ${neon}` : 'none',
            }} />
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main GameBoardScreen ─────────────────────────────────────────────────────
export function GameBoardScreen({ config, lang, onBack }: Props) {
  const [game, setGame]         = useState<E.GameState>(() => E.createGame(config.players));
  const [rolling, setRolling]   = useState(false);
  const [displayDice, setDisplayDice] = useState(1);
  const [restartKey, setRestartKey]   = useState(0);
  const rollTimers = useRef<NodeJS.Timeout[]>([]);

  const isComputer    = config.modeId === 'computer';
  const activeNeon    = E.PLAYER_NEONS[game.activePlayer];
  const activeColor   = E.PLAYER_COLORS[game.activePlayer];
  const isHumanTurn   = !isComputer || game.activePlayer === 0;
  const canRoll       = isHumanTurn && game.phase === 'rolling' && !rolling && !game.winner;

  // ── Roll handler ───────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || game.phase !== 'rolling' || game.winner) return;
    setRolling(true);

    let count = 0;
    const cycle = () => {
      setDisplayDice(Math.floor(Math.random() * 6) + 1);
      count++;
      const delay = count < 6 ? 60 : 60 + count * 18;
      if (count < 10) {
        const t = setTimeout(cycle, delay);
        rollTimers.current.push(t);
      } else {
        const t = setTimeout(() => {
          setGame(prev => {
            const next = E.doRoll(prev);
            setDisplayDice(next.dice);
            setRolling(false);
            return next;
          });
        }, delay);
        rollTimers.current.push(t);
      }
    };
    cycle();
  }, [rolling, game.phase, game.winner]);

  // ── Piece click ────────────────────────────────────────────────────────────
  const handlePieceClick = useCallback((pid: string) => {
    // Only the human player may interact with pieces
    if (!isHumanTurn || !game.movable.includes(pid)) return;
    setGame(prev => E.doMove(prev, pid));
  }, [isHumanTurn, game.movable]);

  // ── Auto-pass when no moves ────────────────────────────────────────────────
  useEffect(() => {
    if (game.phase !== 'selecting' || game.movable.length > 0 || game.winner) return;
    const t = setTimeout(() => setGame(E.autoPassTurn), 1100);
    return () => clearTimeout(t);
  }, [game.phase, game.movable.length, game.winner]);

  // ── AI turn: roll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'rolling' || rolling || game.winner) return;

    const delay = 650 + Math.random() * 400;
    const t = setTimeout(() => handleRoll(), delay);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, rolling, game.winner]);

  // ── AI turn: move ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'selecting' || !game.movable.length || game.winner) return;

    const pid = E.aiPickMove(game);
    if (!pid) return;
    const t = setTimeout(() => setGame(prev => E.doMove(prev, pid)), 550);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, game.movable.length, game.winner]);

  // ── Cleanup timers ─────────────────────────────────────────────────────────
  useEffect(() => () => { rollTimers.current.forEach(clearTimeout); }, []);

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    rollTimers.current.forEach(clearTimeout);
    rollTimers.current = [];
    setRolling(false);
    setDisplayDice(1);
    setGame(E.createGame(config.players));
    setRestartKey(k => k + 1);
  };

  const t = {
    roll:    lang === 'ar' ? 'ارمِ النرد' : 'Lancer le dé',
    waiting: lang === 'ar' ? 'انتظر...'   : 'Attendre...',
    select:  lang === 'ar' ? 'اختر قطعة'  : 'Choisissez',
    back:    lang === 'ar' ? 'عودة'        : 'Retour',
  };

  return (
    <motion.div
      key={restartKey}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(175deg, #07101f 0%, #0a1628 50%, #060e1a 100%)' }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.32 }}
    >
      {/* ── Floating decorative pieces ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { color: '#DC143C', top: '-4%', right: '-6%', size: 80, delay: 0 },
          { color: '#1E90FF', top: '20%', left: '-10%', size: 60, delay: 4 },
          { color: '#FFD700', bottom: '5%', right: '-4%', size: 50, delay: 8 },
        ].map(({ color, size, delay, ...pos }, i) => (
          <motion.div key={i} className="absolute opacity-10"
            style={{ ...pos, width: size, height: size * 1.5 }}
            animate={{ y: [0, 20, 0], rotate: [0, 30, 0] }}
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
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)' }}
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
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)' }}
        >
          <RotateCcw className="w-4 h-4 text-white/70" />
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
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: `0 0 30px ${activeColor}22, 0 0 60px rgba(0,0,0,0.6), inset 0 0 1px rgba(255,255,255,0.1)`,
          }}
          animate={{
            boxShadow: [
              `0 0 20px ${activeColor}22, 0 0 50px rgba(0,0,0,0.6)`,
              `0 0 35px ${activeColor}44, 0 0 60px rgba(0,0,0,0.6)`,
              `0 0 20px ${activeColor}22, 0 0 50px rgba(0,0,0,0.6)`,
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BoardSVG game={game} onPieceClick={handlePieceClick} />
        </motion.div>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="relative z-10 flex-shrink-0 px-4 pb-8 pt-3">
        <div className="flex items-center justify-between gap-4">
          {/* Status / message */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {game.message ? (
                <motion.p key={game.message}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ fontFamily: 'Cairo, sans-serif', fontSize: 13,
                    color: activeNeon, fontWeight: 600, marginBottom: 4 }}>
                  {game.message}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12,
              color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
              {game.phase === 'rolling' && !game.diceRolled
                ? (isHumanTurn ? t.roll.toUpperCase() : t.waiting.toUpperCase())
                : game.phase === 'selecting' && game.movable.length > 0
                ? t.select.toUpperCase()
                : ''}
            </p>
            <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11,
              color: `${activeNeon}90`, letterSpacing: '0.08em', marginTop: 2 }}>
              {lang === 'ar' ? E.PLAYER_NAMES_AR[game.activePlayer] : E.PLAYER_NAMES_FR[game.activePlayer]}
              {game.consecutiveSixes > 0 ? ` · ×${game.consecutiveSixes}` : ''}
            </p>
          </div>

          {/* Dice + roll button */}
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={rolling ? { rotate: [0, 15, -15, 10, -10, 0] } : {}}
              transition={{ duration: 0.55, repeat: rolling ? Infinity : 0 }}
            >
              <DiceFace value={displayDice} neon={activeNeon} size={68} />
            </motion.div>

            <motion.button
              onClick={handleRoll}
              disabled={!canRoll}
              whileHover={canRoll ? { scale: 1.06 } : {}}
              whileTap={canRoll ? { scale: 0.94 } : {}}
              style={{
                background: canRoll
                  ? `linear-gradient(135deg, ${activeColor}cc, ${activeColor}88)`
                  : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${canRoll ? activeNeon : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '24px',
                padding: '8px 20px',
                color: canRoll ? '#fff' : 'rgba(255,255,255,0.3)',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.08em',
                cursor: canRoll ? 'pointer' : 'not-allowed',
                boxShadow: canRoll ? `0 0 16px ${activeColor}44` : 'none',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {rolling ? '…' : isHumanTurn ? t.roll : t.waiting}
            </motion.button>
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
            style={{ backdropFilter: 'blur(12px)', background: 'rgba(4,12,24,0.88)' }}
          >
            {/* Confetti-like particles */}
            {Array.from({ length: 18 }, (_, i) => (
              <motion.div key={i}
                className="absolute rounded-full"
                style={{
                  width: 8 + (i % 5) * 4,
                  height: 8 + (i % 5) * 4,
                  background: E.PLAYER_COLORS[i % 4],
                  left: `${10 + (i * 5) % 80}%`,
                  top: `-5%`,
                  opacity: 0.8,
                }}
                animate={{
                  y: ['0vh', '110vh'],
                  rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 3)],
                }}
                transition={{
                  duration: 2 + (i % 4) * 0.4,
                  delay: i * 0.08,
                  ease: 'easeIn',
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.6, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
              className="flex flex-col items-center gap-5 px-8 py-10 rounded-3xl"
              style={{
                background: `linear-gradient(145deg, ${E.PLAYER_COLORS[game.winner]}18, rgba(4,12,24,0.95))`,
                border: `2px solid ${E.PLAYER_NEONS[game.winner]}60`,
                boxShadow: `0 0 50px ${E.PLAYER_COLORS[game.winner]}33, 0 0 100px ${E.PLAYER_COLORS[game.winner]}18`,
                maxWidth: '300px',
                width: '90%',
              }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Trophy size={56} color={E.PLAYER_NEONS[game.winner]}
                  style={{ filter: `drop-shadow(0 0 12px ${E.PLAYER_NEONS[game.winner]})` }} />
              </motion.div>

              <div className="text-center">
                <p style={{ fontFamily: 'Cairo, sans-serif', color: 'rgba(255,255,255,0.55)',
                  fontSize: 14, marginBottom: 4 }}>
                  {lang === 'ar' ? 'الفائز' : 'Vainqueur'}
                </p>
                <p style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 34,
                  color: E.PLAYER_NEONS[game.winner], letterSpacing: '0.05em',
                  textShadow: `0 0 20px ${E.PLAYER_NEONS[game.winner]}`,
                }}>
                  {lang === 'ar' ? E.PLAYER_NAMES_AR[game.winner] : E.PLAYER_NAMES_FR[game.winner].toUpperCase()}
                </p>
                {isComputer && game.winner === 0 && (
                  <p style={{ fontFamily: 'Cairo, sans-serif', color: E.PLAYER_NEONS[game.winner],
                    fontSize: 13, marginTop: 4, opacity: 0.8 }}>
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
                    boxShadow: `0 0 20px ${E.PLAYER_COLORS[game.winner]}44`,
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
