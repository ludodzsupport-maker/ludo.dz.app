// GameBoardScreen — major overhaul
// • Correct path/corner alignment (Red=TL, Blue=TR, Yellow=BR, Green=BL)
// • Side-column per-player dice panels; only active player interactive
// • Middle lane only colored; outer strips neutral
// • Animation speed setting (Fast / Normal / Slow)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { ArrowLeft, Bot, Settings, Trophy, X, Zap } from 'lucide-react';
import { GamePiece } from './GamePiece';
import * as E from '../lib/ludo-engine';
import * as DZ from '../lib/board-theme-dz';
import type { GameConfig } from './GameConfigOverlay';

// ─── Types ────────────────────────────────────────────────────────────────────
import type { BoardStyle } from '../App';
interface Props { config: GameConfig; lang: 'fr' | 'ar'; boardStyle?: BoardStyle; onBack: () => void; }
type AnimSpeed = 'fast' | 'normal' | 'slow';

// ─── Animation speed presets ──────────────────────────────────────────────────
const ANIM = {
  fast:   { cycles: 8,  baseMs: 32, stepMs: 15, stiffness: 520, damping: 32, mass: 0.60, hopMs:  90 },
  normal: { cycles: 11, baseMs: 50, stepMs: 24, stiffness: 400, damping: 30, mass: 0.75, hopMs: 150 },
  slow:   { cycles: 16, baseMs: 80, stepMs: 42, stiffness: 180, damping: 22, mass: 1.20, hopMs: 240 },
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

// ─── Classic theme palette — Ludo King quality ────────────────────────────────
// Richer, deeper hues: cardinal crimson / cobalt royal / burnished amber / forest deep
const CL_SOLID  = ['#C31024','#1542B0','#E8A800','#1C6B2E'] as const;
const CL_LIGHT  = ['#FAECEE','#E2ECFF','#FFF4D8','#E4F5EA'] as const;
const CL_BORDER = ['#8A0B1E','#0C3082','#9C6E00','#10481C'] as const;
const CL_ARROW  = ['#640016','#081B5A','#664600','#073010'] as const;
const CL_GOLD   = '#B8863B'; // warm brass/gilt accent for premium home-base trim

// Lighten (positive) or darken (negative) a hex colour by `percent` (-100..100).
// Used to build richly-graded, per-colour gradients for the Classic dome pawns
// and warm ornamental home-base details — premium 3D shading needs true tonal
// steps of each player colour, not just opacity tricks.
function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

// Evenly-spaced points walking clockwise around a rectangle's perimeter —
// used to lay a "beaded" gilt trim line around the Classic home-base panels.
function beadRect(x0: number, y0: number, x1: number, y1: number, step: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) pts.push([x, y0]);
  for (let y = y0 + step; y <= y1 + 1e-6; y += step) pts.push([x1, y]);
  for (let x = x1 - step; x >= x0 - 1e-6; x -= step) pts.push([x, y1]);
  for (let y = y1 - step; y >= y0 + step - 1e-6; y -= step) pts.push([x0, y]);
  return pts;
}

// Point-string for an n-pointed star polygon (alternating outer/inner radius) —
// used for the Classic home-base centre medallion / compass rosette.
function starPoints(cx: number, cy: number, rOuter: number, rInner: number, spikes: number): string {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  for (let i = 0; i < spikes; i++) {
    pts.push(`${cx + Math.cos(rot) * rOuter},${cy + Math.sin(rot) * rOuter}`);
    rot += step;
    pts.push(`${cx + Math.cos(rot) * rInner},${cy + Math.sin(rot) * rInner}`);
    rot += step;
  }
  return pts.join(' ');
}

// Crescent path (evenodd two-circle subtraction) for the DZ crescent-and-star
// motif: an outer circle minus an overlapping inner "cutting" circle leaves a
// moon-sliver whose horns open toward the cutting circle — the companion star
// (via starPoints) sits in that gap. Used for both safe-square markers and the
// center medallion, at different scales.
function crescentPath(
  ocx: number, ocy: number, rOuter: number,
  icx: number, icy: number, rInner: number,
): string {
  const circle = (cx: number, cy: number, r: number) =>
    `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 Z`;
  return `${circle(ocx, ocy, rOuter)} ${circle(icx, icy, rInner)}`;
}

// Onion-dome / lantern silhouette for the DZ pawn body — a bulbous dome that
// bulges wide just above its neck and tapers to a point, evoking a small
// minaret finial. Verified by standalone rasterization before wiring in
// (see artifact-preview-fallback memory note) so the curve reads cleanly at
// on-board pawn scale, not just in the abstract. DZ board theme only.
function dzDomePath(cx: number, cy: number, R: number): string {
  return `M ${cx - 0.62*R},${cy + 0.55*R}
    C ${cx - 1.14*R},${cy + 0.30*R} ${cx - 1.14*R},${cy - 0.26*R} ${cx - 0.66*R},${cy - 0.56*R}
    C ${cx - 0.30*R},${cy - 0.86*R} ${cx - 0.12*R},${cy - 1.05*R} ${cx},${cy - 1.15*R}
    C ${cx + 0.12*R},${cy - 1.05*R} ${cx + 0.30*R},${cy - 0.86*R} ${cx + 0.66*R},${cy - 0.56*R}
    C ${cx + 1.14*R},${cy - 0.26*R} ${cx + 1.14*R},${cy + 0.30*R} ${cx + 0.62*R},${cy + 0.55*R}
    Z`;
}

// ─── Fixed resting slots for finished pawns inside each player's center triangle ──
// Center 3×3 spans columns/rows 6–9, apex at (7.5, 7.5). [x, y] = [col, row].
// Red=left, Blue=top, Yellow=right, Green=bottom.
// Each triangle has 4 slots keyed by piece.index (0-3), arranged in a 2×2 pattern.
const HOME_FINISH_SLOTS: readonly (readonly [number, number][])[] = [
  [[6.30, 6.95], [6.30, 8.05], [6.75, 7.20], [6.75, 7.80]], // Red   — left triangle
  [[6.95, 6.30], [8.05, 6.30], [7.20, 6.75], [7.80, 6.75]], // Blue  — top triangle
  [[8.70, 6.95], [8.70, 8.05], [8.25, 7.20], [8.25, 7.80]], // Yellow — right triangle
  [[6.95, 8.70], [8.05, 8.70], [7.20, 8.25], [7.80, 8.25]], // Green — bottom triangle
];

// ─── Piece display position ───────────────────────────────────────────────────
function getPieceXY(piece: E.Piece, all: E.Piece[]): [number, number] {
  if (piece.relPos === -1) {
    const [br, bc] = E.HOME_BASES[piece.player][piece.index];
    return [bc + 0.5, br + 0.5];
  }
  if (piece.relPos === E.FINISHED_POS) {
    const [x, y] = HOME_FINISH_SLOTS[piece.player][piece.index];
    return [x, y];
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
  // ±0.18 keeps every pawn visually within its cell (max extent: cx ± 0.505,
  // negligibly over the 0.5 half-cell limit). Larger offsets clip on edge cells.
  const offsets: [number,number][] = [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]];
  const [dx, dy] = offsets[rank % 4] || [0, 0];
  return [cx + dx, cy + dy];
}

// ─── Die face — true CSS 3D cube with 6 dot-faces ────────────────────────────
// Cube rotation (rotateX, rotateY) so each face value faces the camera.
// Standard dice: 1-front, 6-back, 2-right, 5-left, 3-top, 4-bottom.
const FACE_SHOW: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, -90], 3: [90, 0], 4: [-90, 0], 5: [0, 90], 6: [0, 180],
};
function cubeFaceTransform(fv: number, half: number): string {
  switch (fv) {
    case 1: return `translateZ(${half}px)`;
    case 6: return `rotateY(180deg) translateZ(${half}px)`;
    case 2: return `rotateY(90deg) translateZ(${half}px)`;
    case 5: return `rotateY(-90deg) translateZ(${half}px)`;
    case 3: return `rotateX(-90deg) translateZ(${half}px)`;
    case 4: return `rotateX(90deg) translateZ(${half}px)`;
    default: return '';
  }
}

function DieFace({
  value, neon, col, size, rolling, justLanded, dim, classic, dz,
}: {
  value: number; neon: string; col: string; size: number;
  rolling?: boolean; justLanded?: boolean; dim?: boolean; classic?: boolean; dz?: boolean;
}) {
  const opacity = dim ? 0.82 : 1;
  const ctrl    = useAnimationControls();
  const half    = size / 2;

  // ── Rolling: multi-axis 3D tumble — 9 keyframes that each cycle ends at
  //    (720°, −720°, 0°) so the cube is visually at the neutral orientation
  //    at the end of every loop, ready for a clean landing interrupt.
  useEffect(() => {
    if (!rolling) return;
    ctrl.start({
      rotateX: [0, 90, 180, 270, 360, 450, 540, 630, 720],
      rotateY: [0, -90, -180, -360, -270, -450, -360, -630, -720],
      rotateZ: [-14, 9, -7, 11, -9, 6, -3, 7, 0],
      scale:   [1.0, 1.20, 0.97, 1.18, 1.0, 1.16, 0.98, 1.15, 1.0],
      transition: { duration: 0.62, repeat: Infinity, ease: 'linear' },
    });
  }, [rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Landing: snap cube to neutral, then spin to the correct face with
  //    a squash-and-stretch bounce so the landing feels physical.
  useEffect(() => {
    if (!justLanded) return;
    const [rx, ry] = FACE_SHOW[Math.max(1, Math.min(6, value))] ?? [0, 0];
    // Instant reset to 0,0,0 so the keyframe sequence has a known start point.
    ctrl.set({ rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 });
    ctrl.start({
      rotateX: [0, rx + 24, rx - 10, rx + 4, rx],
      rotateY: [0, ry - 22, ry + 9,  ry - 3, ry],
      rotateZ: [0, 0, 0, 0, 0],
      scale:   [1.30, 0.76, 1.14, 0.94, 1.0],
      transition: {
        duration: 0.56,
        times: [0, 0.22, 0.52, 0.78, 1.0],
        ease: 'easeOut',
      },
    });
  }, [justLanded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ width: size, height: size, position: 'relative', opacity }}>
      <motion.div
        animate={ctrl}
        initial={{ rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 }}
        style={{
          width: size, height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {([1, 2, 3, 4, 5, 6] as const).map(fv => {
          const d = DOTS[fv] ?? DOTS[1];
          return (
            <div key={fv} style={{
              position: 'absolute', top: 0, left: 0,
              width: size, height: size,
              transform: cubeFaceTransform(fv, half),
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: classic
                ? `radial-gradient(ellipse at 38% 32%, #fffdf8 0%, #f5e8c8 62%, #e8d4a0 100%)`
                : dz
                ? `radial-gradient(ellipse at 38% 32%, #FFFCF2 0%, ${DZ.PATH_CREAM} 58%, #E4CE9C 100%)`
                : `radial-gradient(circle at 36% 28%, rgba(255,255,255,0.26), ${neon}28 42%, ${col}cc)`,
              border: `${Math.max(1, Math.round(size * 0.038))}px solid ${classic ? '#a87820' : dz ? DZ.BORDER_GOLD : neon}`,
              borderRadius: `${size * 0.14}px`,
              overflow: 'hidden',
            }}>
              <svg width={size} height={size} viewBox="-3 -3 6 6"
                style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}>
                {/* Glass sheen — neon only */}
                {!classic && !dz && (
                  <rect x="-2.6" y="-2.7" width="2.1" height="0.76" rx="0.30"
                    fill="white" opacity="0.20"/>
                )}
                {/* Dots — classic: ivory cream on dark wood; DZ: deep green on cream */}
                {d.map(([dx, dy], i) => (
                  <circle key={i} cx={dx} cy={dy} r="0.52" fill={classic ? '#1e0e00' : dz ? DZ.BORDER_DEEP : neon}/>
                ))}
              </svg>
            </div>
          );
        })}
      </motion.div>
    </div>
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
const BOARD_MARGIN = 4;    // px — minimal side margin for the board frame itself
const PANEL_INSET  = 9;    // px — how far the panel sits inward from the frame's corner
// Connector tail — a small triangle inside the untouched PANEL_GAP buffer,
// pointing from the panel toward its board corner. TAIL_H + TAIL_GAP must
// stay ≤ PANEL_GAP so it never touches the frame.
const TAIL_W   = 5;   // px — half-width of the tail triangle
const TAIL_H   = 4;   // px — tail height
const TAIL_GAP = 2;   // px — clear buffer between the tail tip and the frame edge

// ─── Panel layout type — passed from GameBoardScreen so panels scale with vw ──
type PanelLayout = {
  panelW: number; panelH: number; panelGap: number; panelInset: number;
  tailW: number; tailH: number; tailGap: number;
};

// ─── Corner dice panel ────────────────────────────────────────────────────────
// Sits outside its board corner, flat and mirror-symmetric across both axes,
// with a small tail pointing at the frame so it reads as anchored, not
// floating. Vertical layout: colour dot + name → die face → TAP label →
// progress dots.
function CornerDice({
  player, anchor, game, isAI, lang, boardStyle,
  rolling, animDice, justLanded, lastDice,
  onRoll, canRoll, panelLayout,
}: {
  player: number;
  anchor: 'tl' | 'tr' | 'bl' | 'br';
  game: E.GameState; isAI: boolean; lang: 'fr' | 'ar';
  rolling: boolean; animDice: number; justLanded: boolean; lastDice: number[];
  onRoll: () => void; canRoll: boolean;
  boardStyle?: BoardStyle;
  panelLayout: PanelLayout;
}) {
  const col         = E.PLAYER_COLORS[player];
  const neon        = E.PLAYER_NEONS[player];
  const isActive    = game.activePlayer === player && game.phase !== 'done';
  const exists      = game.playerSlots.includes(player);
  const pieces      = game.pieces.filter(p => p.player === player);
  const name        = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];
  const isRollingMe = rolling && isActive;
  const diceVal     = isActive ? animDice : (lastDice[player] || 1);
  const canTap      = canRoll && isActive;
  const isTop       = anchor === 'tl' || anchor === 'tr';
  const isClassic   = boardStyle === 'classic';
  const isDz        = boardStyle === 'dz';
  const clSolid     = CL_SOLID[player as 0|1|2|3];
  const clLight     = CL_LIGHT[player as 0|1|2|3];
  const clBorder    = CL_BORDER[player as 0|1|2|3];
  const dzColor     = DZ.HOME_COLORS[player as 0|1|2|3];
  // Shadow module-level px constants with viewport-scaled values so panels
  // grow/shrink proportionally with the board on all phone sizes.
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const { panelW: PANEL_W, panelH: PANEL_H, panelGap: PANEL_GAP, panelInset: PANEL_INSET, tailW: TAIL_W, tailH: TAIL_H, tailGap: TAIL_GAP } = panelLayout;

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
          [tailBorderSide]: `${TAIL_H}px solid ${isClassic ? 'rgba(160,120,32,0.28)' : isDz ? 'rgba(201,162,39,0.22)' : 'rgba(255,255,255,0.05)'}`,
        }}/>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: isClassic ? 10 : 16,
          background: isClassic ? 'rgba(240,228,190,0.45)' : isDz ? 'rgba(0,58,29,0.40)' : 'rgba(3,10,22,0.40)',
          border: `1px solid ${isClassic ? 'rgba(160,120,32,0.32)' : isDz ? 'rgba(201,162,39,0.28)' : 'rgba(255,255,255,0.04)'}`,
          opacity: 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isClassic ? 'rgba(160,120,32,0.18)' : isDz ? 'rgba(201,162,39,0.22)' : '#1a2a40' }}/>
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
        [tailBorderSide]: `${TAIL_H}px solid ${isClassic ? (isActive ? '#a07820' : 'rgba(160,120,32,0.32)') : isDz ? (isActive ? DZ.BORDER_GOLD : 'rgba(201,162,39,0.35)') : (isActive ? neon : col + '55')}`,
        filter: isClassic ? 'none' : isDz ? (isActive ? `drop-shadow(0 0 3px ${DZ.BORDER_GOLD}90)` : 'none') : (isActive ? `drop-shadow(0 0 3px ${neon})` : 'none'),
        transition: 'border-color 0.4s',
        pointerEvents: 'none',
      }}/>
    <motion.div
      onClick={canTap ? onRoll : undefined}
      whileTap={canTap ? (isClassic ? { scale: 1.02 } : { scale: 0.91 }) : {}}
      animate={isClassic ? {
        scale: isActive ? 1.08 : 0.88,
        opacity: isActive ? 1 : 0.72,
        boxShadow: isActive
          ? [
              `0 0 0 2px ${clLight}, 0 0 0 3.5px ${clBorder}, 0 5px 18px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.82)`,
              `0 0 0 2px ${clLight}, 0 0 0 3.5px ${clBorder}, 0 9px 26px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.82)`,
              `0 0 0 2px ${clLight}, 0 0 0 3.5px ${clBorder}, 0 5px 18px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.82)`,
            ]
          : `0 2px 8px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.65)`,
      } : isDz ? {
        scale: isActive ? 1.08 : 0.88,
        opacity: isActive ? 1 : 0.74,
        boxShadow: isActive
          ? [
              `0 0 0 1.5px ${DZ.BORDER_GOLD}, 0 0 0 3px ${DZ.BORDER_DEEP}, 0 5px 16px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,238,190,0.30)`,
              `0 0 0 1.5px ${DZ.BORDER_GOLD}, 0 0 0 3px ${DZ.BORDER_DEEP}, 0 8px 22px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,238,190,0.42)`,
              `0 0 0 1.5px ${DZ.BORDER_GOLD}, 0 0 0 3px ${DZ.BORDER_DEEP}, 0 5px 16px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,238,190,0.30)`,
            ]
          : `0 2px 10px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,238,190,0.14)`,
      } : {
        scale: isActive ? 1.08 : 0.88,
        opacity: isActive ? 1 : 0.68,
        boxShadow: isActive ? [
          `0 0 14px ${col}40, inset 0 0 10px ${col}14`,
          `0 0 28px ${neon}65, inset 0 0 18px ${col}28`,
          `0 0 14px ${col}40, inset 0 0 10px ${col}14`,
        ] : `0 2px 12px rgba(0,0,0,0.55), 0 0 8px ${col}28`,
      }}
      transition={(isClassic || isDz)
        ? {
            scale:     { type: 'spring', stiffness: 260, damping: 28 },
            opacity:   { duration: 0.38, ease: 'easeOut' },
            boxShadow: { duration: isActive ? 1.6 : 0.3, repeat: isActive ? Infinity : 0, ease: 'easeInOut' },
          }
        : {
            scale:     { type: 'spring', stiffness: 260, damping: 28 },
            opacity:   { duration: 0.38, ease: 'easeOut' },
            boxShadow: { duration: 1.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' },
          }}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-evenly',
        padding: isClassic ? '10px 4px 6px' : '6px 4px',
        borderRadius: isClassic ? 10 : 12,
        cursor: canTap ? 'pointer' : 'default',
        background: isClassic
          ? `linear-gradient(168deg, #fefdf6 0%, #f6e9c6 45%, #ead5a0 100%)`
          : isDz
          ? (isActive
            ? `linear-gradient(150deg, ${dzColor}38 0%, ${DZ.BOARD_BG}d8 100%)`
            : `linear-gradient(150deg, ${dzColor}20 0%, ${DZ.BOARD_BG}c0 100%)`)
          : (isActive
            ? `linear-gradient(145deg, ${col}38 0%, ${col}12 100%)`
            : `linear-gradient(145deg, ${col}26 0%, ${col}0e 100%)`),
        border: isClassic
          ? (isActive ? `1.5px solid ${clBorder}` : `1px solid rgba(160,120,32,0.48)`)
          : isDz
          ? `1.5px solid ${isActive ? DZ.BORDER_GOLD : DZ.BORDER_GOLD + '80'}`
          : `1.5px solid ${isActive ? neon : col + '55'}`,
        backdropFilter: (isClassic || isDz) ? 'none' : 'blur(10px)',
        WebkitBackdropFilter: (isClassic || isDz) ? 'none' : 'blur(10px)',
        transition: 'background 0.4s, border-color 0.4s',
        overflow: 'hidden',
        userSelect: 'none',
        // Scale grows toward the board corner so the active card "leans in" to the game
        transformOrigin: { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' }[anchor],
      }}
    >
      {/* Islamic geometric edge patterning (DZ only) — four tiny 8-point star
          rivets tucked at the panel corners, echoing the board's najma motif. */}
      {isDz && (
        <svg width="100%" height="100%" viewBox={`0 0 ${PANEL_W} ${PANEL_H}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {([[5,5],[PANEL_W-5,5],[5,PANEL_H-5],[PANEL_W-5,PANEL_H-5]] as const).map(([sx,sy],i) => (
            <polygon key={i} points={starPoints(sx, sy, 2.6, 1.05, 8)}
              fill={DZ.BORDER_GOLD} fillOpacity={isActive ? 0.85 : 0.45}/>
          ))}
        </svg>
      )}
      {/* Active edge shimmer — neon only */}
      {isActive && !isClassic && !isDz && (
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
      {/* Active edge shimmer — DZ gold */}
      {isActive && isDz && (
        <motion.div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 1.5,
          background: `linear-gradient(90deg, transparent, ${DZ.BORDER_GOLD}cc, transparent)`,
          pointerEvents: 'none',
        }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      {/* Classic — player-colour top stripe (mirrors board home-zone identity) */}
      {isClassic && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 7,
          background: clSolid,
          borderRadius: '8px 8px 0 0',
          opacity: isActive ? 1 : 0.68,
          pointerEvents: 'none',
          transition: 'opacity 0.4s',
        }}/>
      )}
      {/* DZ — player-colour top stripe + gold hairline (mirrors board home-zone identity) */}
      {isDz && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 5,
          background: dzColor,
          borderRadius: '8px 8px 0 0',
          opacity: isActive ? 1 : 0.60,
          pointerEvents: 'none',
          transition: 'opacity 0.4s',
        }}/>
      )}
      {isDz && (
        <div style={{
          position: 'absolute',
          top: 5, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, rgba(201,162,39,0.05) 0%, rgba(201,162,39,0.75) 26%, rgba(201,162,39,0.75) 74%, rgba(201,162,39,0.05) 100%)',
          pointerEvents: 'none',
        }}/>
      )}
      {/* Classic — antique-gold hairline under stripe */}
      {isClassic && (
        <div style={{
          position: 'absolute',
          top: 7, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, rgba(160,120,32,0.06) 0%, rgba(160,120,32,0.62) 28%, rgba(160,120,32,0.62) 72%, rgba(160,120,32,0.06) 100%)',
          pointerEvents: 'none',
        }}/>
      )}
      {/* Classic active — warm gold breath shimmer inside body */}
      {isActive && isClassic && (
        <motion.div style={{
          position: 'absolute',
          top: 9, left: 0, right: 0, height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(220,180,55,0.52), transparent)',
          pointerEvents: 'none',
        }}
          animate={{ opacity: [0.18, 0.82, 0.18] }}
          transition={{ duration: 1.9, repeat: Infinity }}
        />
      )}
      {/* DZ active — warm gold breath shimmer inside body */}
      {isActive && isDz && (
        <motion.div style={{
          position: 'absolute',
          top: 7, left: 0, right: 0, height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.55), transparent)',
          pointerEvents: 'none',
        }}
          animate={{ opacity: [0.18, 0.82, 0.18] }}
          transition={{ duration: 1.9, repeat: Infinity }}
        />
      )}

      {/* Colour dot + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <motion.div
          animate={(isClassic || isDz) ? {} : (isActive
            ? { boxShadow: [`0 0 3px ${neon}80`, `0 0 10px ${neon}`, `0 0 3px ${neon}80`] }
            : {})}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isClassic ? clSolid : isDz ? dzColor : col,
            flexShrink: 0,
            boxShadow: (isClassic || isDz) ? `0 0 0 1px rgba(160,120,32,0.42)` : undefined,
            opacity: isActive ? 1 : ((isClassic || isDz) ? 0.60 : 0.50),
          }}
        />
        <span style={{
          fontFamily: isDz ? 'Cairo, sans-serif' : 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 9,
          color: isClassic
            ? (isActive ? CL_ARROW[player as 0|1|2|3] : 'rgba(100,70,20,0.48)')
            : isDz
            ? (isActive ? DZ.BORDER_GOLD : dzColor + 'B0')
            : (isActive ? neon : col + '90'),
          letterSpacing: '0.06em', textTransform: 'uppercase',
          lineHeight: 1,
          textShadow: 'none',
        }}>
          {name.slice(0, 4)}
        </span>
        {isAI && <Bot size={8} color={isClassic ? 'rgba(80,50,10,0.42)' : isDz ? 'rgba(201,162,39,0.60)' : 'rgba(255,255,255,0.30)'} style={{ flexShrink: 0 }}/>}
      </div>

      {/* Die face with pulse ring — perspective establishes the 3D rendering context */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '300px' }}>
        {canTap && !rolling && (
          <motion.div style={{
            position: 'absolute', inset: -6, borderRadius: 10,
            border: `1.5px solid ${isClassic ? clBorder : isDz ? DZ.BORDER_GOLD : neon}`,
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
          classic={isClassic}
          dz={isDz}
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
                fontFamily: isDz ? 'Cairo, sans-serif' : 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700,
                color: isClassic ? CL_ARROW[player as 0|1|2|3] : isDz ? DZ.BORDER_GOLD : neon, letterSpacing: '0.08em',
                textShadow: isClassic ? 'none' : isDz ? `0 0 4px ${DZ.BORDER_GOLD}66` : `0 0 7px ${neon}`,
              }}>
              {lang === 'ar' ? 'ارمِ' : 'TAP'}
            </motion.span>
          ) : isRollingMe ? (
            <motion.span key="roll"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: isDz ? 'Cairo, sans-serif' : 'Rajdhani, sans-serif', fontSize: 9, color: isClassic ? 'rgba(100,70,20,0.38)' : isDz ? 'rgba(220,200,150,0.42)' : 'rgba(255,255,255,0.40)' }}>
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
              background: isClassic
                ? (st === 'done' ? clSolid : st === 'on' ? `${clSolid}bb` : st === 'home' ? `${clSolid}50` : 'rgba(180,140,40,0.10)')
                : isDz
                ? (st === 'done' ? DZ.BORDER_GOLD : st === 'on' ? dzColor : st === 'home' ? `${dzColor}55` : 'rgba(201,162,39,0.12)')
                : (st === 'done' ? neon : st === 'on' ? col : `${col}35`),
              border: `0.5px solid ${isClassic ? (st !== 'none' ? `${clBorder}72` : 'rgba(160,120,32,0.26)') : isDz ? (st !== 'none' ? `${DZ.BORDER_GOLD}80` : 'rgba(201,162,39,0.25)') : col + '45'}`,
              boxShadow: (isClassic || isDz)
                ? 'none'
                : (st === 'done' ? `0 0 5px ${neon}` : 'none'),
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
function PlayerChip({ game, player, isAI, lang, boardStyle }: {
  game: E.GameState; player: number; isAI: boolean; lang: 'fr'|'ar'; boardStyle?: BoardStyle;
}) {
  const col       = E.PLAYER_COLORS[player];
  const neon      = E.PLAYER_NEONS[player];
  const isActive  = game.activePlayer === player && game.phase !== 'done';
  const pieces    = game.pieces.filter(p => p.player === player);
  const name      = lang === 'ar' ? E.PLAYER_NAMES_AR[player] : E.PLAYER_NAMES_FR[player];
  const isClassic = boardStyle === 'classic';
  const clSolid   = CL_SOLID[player as 0|1|2|3];
  const clBorder  = CL_BORDER[player as 0|1|2|3];

  return (
    <motion.div
      animate={{
        scale: isActive ? 1.06 : 1,
        boxShadow: isClassic
          ? (isActive ? `0 3px 12px ${clSolid}55` : '0 1px 4px rgba(0,0,0,0.10)')
          : (isActive
            ? `0 0 12px ${neon}70, inset 0 0 6px ${col}18`
            : '0 0 0px transparent'),
      }}
      transition={{ duration: 0.22 }}
      style={isClassic ? {
        background: isActive
          ? `linear-gradient(150deg, ${clSolid} 0%, ${clBorder} 100%)`
          : `linear-gradient(150deg, #FFFFFF 0%, #F4F4F4 100%)`,
        border: `${isActive ? 2 : 1.5}px solid ${isActive ? clSolid : clSolid + 'AA'}`,
        borderRadius: 12, padding: '5px 8px', minWidth: 52,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      } : {
        background: `linear-gradient(135deg, ${col}18, ${col}08)`,
        border: `1.5px solid ${isActive ? neon : col + '25'}`,
        borderRadius: 12, padding: '5px 8px', minWidth: 52,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
      {isActive && !isClassic && (
        <motion.div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${neon}, transparent)`,
        }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
      {isActive && isClassic && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)`,
        }}/>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isClassic ? (isActive ? '#FFFFFF' : clSolid) : col,
          boxShadow: isClassic ? 'none' : `0 0 4px ${neon}80`,
          flexShrink: 0,
        }}/>
        <span style={{
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10,
          color: isClassic
            ? (isActive ? '#FFFFFF' : clSolid)
            : (isActive ? '#fff' : 'rgba(255,255,255,0.50)'),
          letterSpacing: '0.05em',
        }}>
          {name.slice(0,4).toUpperCase()}
        </span>
        {isAI && <Bot size={8} color={isClassic ? (isActive ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.40)') : 'rgba(255,255,255,0.30)'}/>}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0,1,2,3].map(i => {
          const p  = pieces[i];
          const st = !p ? 'none' : p.relPos === E.FINISHED_POS ? 'done' : p.relPos >= 0 ? 'on' : 'home';
          return (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isClassic
                ? (st === 'done' ? (isActive ? '#FFFFFF' : clSolid) : st === 'on' ? (isActive ? '#FFFFFF' : clSolid) : (isActive ? 'rgba(255,255,255,0.30)' : `${clSolid}35`))
                : (st === 'done' ? neon : st === 'on' ? col : `${col}40`),
              border: isClassic
                ? `0.5px solid ${isActive ? 'rgba(255,255,255,0.45)' : clSolid + '45'}`
                : `0.5px solid ${col}30`,
              boxShadow: (!isClassic && st === 'done') ? `0 0 4px ${neon}` : 'none',
              transition: 'all 0.28s',
            }}/>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Classic scoreboard strip (replaces PlayerChip row in Classic mode) ──────
// One unified parchment ribbon — same ivory/gold vocabulary as the dice cards.
// Divided into per-player sections by gilt vertical rules. The active player's
// section carries a player-colour top bar that slides via layoutId as turns
// change, a colour-saturated name, and a warm tint on the section background.
// Inactive sections are muted parchment ink. Nothing loud, nothing accidental.
function ClassicScoreStrip({ game, playerSlots, isComputer, lang }: {
  game: E.GameState; playerSlots: number[]; isComputer: boolean; lang: 'fr'|'ar';
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      position: 'relative',
      borderRadius: 8,
      border: '1.5px solid #a07820',
      background: 'linear-gradient(170deg, #fefdf6 0%, #f0e4c6 100%)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.85)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'row',
    }}>
      {/* Full-width gilt accent line across the top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2,
        background: 'linear-gradient(90deg, rgba(160,120,32,0.08) 0%, rgba(201,162,39,0.68) 22%, rgba(201,162,39,0.68) 78%, rgba(160,120,32,0.08) 100%)',
        pointerEvents: 'none',
      }}/>

      {playerSlots.map((slot, idx) => {
        const isActive = game.activePlayer === slot && game.phase !== 'done';
        const pieces   = game.pieces.filter(p => p.player === slot);
        const name     = lang === 'ar' ? E.PLAYER_NAMES_AR[slot] : E.PLAYER_NAMES_FR[slot];
        const clSolid  = CL_SOLID[slot  as 0|1|2|3];
        const clBorder = CL_BORDER[slot as 0|1|2|3];
        const clArrow  = CL_ARROW[slot  as 0|1|2|3];
        const isAI     = isComputer && slot !== 0;

        return (
          <div key={slot} style={{
            flex: 1, minWidth: 0,
            position: 'relative',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3,
            padding: '8px 4px 6px',
            borderLeft: idx === 0 ? 'none' : '0.5px solid rgba(160,120,32,0.30)',
            background: isActive ? `${clSolid}10` : 'transparent',
            transition: 'background 0.45s',
          }}>
            {/* Player-colour top bar — slides via layoutId as the active player changes */}
            {isActive && (
              <motion.div
                layoutId="classic-active-bar"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: clSolid, zIndex: 1,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}

            {/* Name row: colour pip + abbreviated name + optional AI icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: clSolid,
                opacity: isActive ? 1 : 0.52,
                boxShadow: isActive ? `0 0 0 1px rgba(160,120,32,0.42)` : 'none',
                flexShrink: 0, transition: 'opacity 0.4s',
              }}/>
              <span style={{
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 10,
                color: isActive ? clArrow : 'rgba(100,70,20,0.42)',
                letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1,
                transition: 'color 0.4s',
              }}>
                {name.slice(0,4)}
              </span>
              {isAI && (
                <Bot size={7}
                  color={isActive ? clArrow : 'rgba(100,70,20,0.28)'}
                  style={{ flexShrink: 0 }}/>
              )}
            </div>

            {/* Pawn status pips — same palette as CornerDice progress dots */}
            <div style={{ display: 'flex', gap: 3 }}>
              {[0,1,2,3].map(i => {
                const p  = pieces[i];
                const st = !p ? 'none'
                         : p.relPos === E.FINISHED_POS ? 'done'
                         : p.relPos >= 0 ? 'on' : 'home';
                return (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: st === 'done' ? clSolid
                              : st === 'on'   ? `${clSolid}bb`
                              : st === 'home' ? `${clSolid}50`
                              : 'rgba(180,140,40,0.10)',
                    border: `0.5px solid ${st !== 'none' ? `${clBorder}72` : 'rgba(160,120,32,0.24)'}`,
                    transition: 'all 0.3s',
                  }}/>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Hop animation constants ─────────────────────────────────────────────────
interface HopStep { x: number; y: number }
// Premium cubic-bezier easing: snappy ease-out-quart for lateral movement
const STEP_EASE: [number, number, number, number] = [0.22, 1.0, 0.36, 1.0];
const ARC_H       = 0.80; // SVG units — arc peak height per hop
const INTER_MS    = 50;   // ms pause between consecutive steps ("tap" feel)
const LAND_SPRING = { type: 'spring' as const, stiffness: 680, damping: 34, mass: 0.55 };
// ── Squash & stretch on landing ──────────────────────────────────────────────
const SQUASH_X  = 1.09; // scaleX at squash peak (wider on impact)
const SQUASH_Y  = 0.91; // scaleY at squash peak (shorter on impact)
const SQUASH_MS = 46;   // ms — fits within INTER_MS, plays during the pause gap
// ── Capture: defeat arc (captured piece flies home) ──────────────────────────
const DEFEAT_ARC_H = 3.20; // SVG units — dramatic high parabolic arc

// Build a cell-by-cell SVG hop path for a piece moving from pFrom → pTo.
// Each entry in the returned array is the SVG centre of a MAIN_PATH cell —
// exactly one entry per die pip, no inserted waypoints. The 4 inner-corner
// transitions (e.g. Red relPos 4→5: [6,5]→[5,6]) move both axes in one hop;
// PawnToken's axis-diff loop handles them naturally without adding ghost cells.
function buildHopPath(
  player: number,
  index: number,
  pFrom: number,
  pTo: number,
): HopStep[] {
  const steps: HopStep[] = [];

  if (pFrom === -1) {
    // Exiting home base: single hop to track entry cell (relPos 0)
    const gp = E.getGridPos(player, 0);
    if (gp) steps.push({ x: gp[1] + 0.5, y: gp[0] + 0.5 });
  } else {
    const trackEnd = pTo === E.FINISHED_POS ? E.FINISHED_POS - 1 : pTo;
    for (let r = pFrom + 1; r <= trackEnd; r++) {
      const gp = E.getGridPos(player, r);
      if (gp) steps.push({ x: gp[1] + 0.5, y: gp[0] + 0.5 });
    }
    if (pTo === E.FINISHED_POS) {
      const [fx, fy] = HOME_FINISH_SLOTS[player][index];
      steps.push({ x: fx, y: fy });
    }
  }

  return steps;
}

// ─── PawnToken ────────────────────────────────────────────────────────────────
// Self-animating piece using two nested motion groups:
//   Outer motion.g → moves tile-to-tile in x/y (cubic-bezier STEP_EASE)
//   Inner motion.g → applies parabolic Y-arc overlay per step
// This separation lets X and Y-arc be animated independently, producing a true
// parabolic flight path: piece traverses each cell with a smooth hop, peaks at
// 45% of step duration, then descends and snaps to canonical stacking position.
function PawnToken({
  pid, player, finalX, finalY, startX, startY, hopSteps, hopMs, springCfg, isMovable, onPieceClick,
  onLastHopLand, onDefeatArrived, isClassic, isDz,
}: {
  pid: string; player: number;
  finalX: number; finalY: number;
  startX?: number; // piece's visual X at the moment the hop sequence begins
  startY?: number; // piece's visual Y at the moment the hop sequence begins
  hopSteps: HopStep[] | null | 'defeat'; // null=spring; 'defeat'=capture arc; [...]=hops
  hopMs: number;
  springCfg: { stiffness: number; damping: number; mass: number };
  isMovable: boolean;
  onPieceClick: () => void;
  onLastHopLand?: () => void;   // fires when captor's final hop lands → shockwave
  onDefeatArrived?: () => void; // fires when defeated piece reaches home → impact flash
  isClassic?: boolean; // Classic Board theme only — swaps hex/neon body for a 3D dome token
  isDz?: boolean; // DZ Board theme only — swaps hex/neon body for an onion-dome lantern token
}) {
  const baseCtrl = useAnimationControls();
  const arcCtrl  = useAnimationControls();
  const [isHopping, setIsHopping] = useState(false);

  // Stable refs so async closures always see latest values
  const seqKeyRef      = useRef(0);
  const finalRef       = useRef({ x: finalX, y: finalY });
  const springCfgRef   = useRef(springCfg);
  const onLastHopRef   = useRef(onLastHopLand);
  const onDefeatRef    = useRef(onDefeatArrived);
  finalRef.current     = { x: finalX, y: finalY };
  springCfgRef.current = springCfg;
  onLastHopRef.current = onLastHopLand;
  onDefeatRef.current  = onDefeatArrived;

  // ── Effect 1: hop sequence or defeat arc ────────────────────────────────────
  useEffect(() => {
    if (hopSteps === null) return;

    const key   = ++seqKeyRef.current;
    const stale = () => seqKeyRef.current !== key;

    arcCtrl.set({ y: 0, scaleX: 1, scaleY: 1, rotate: 0 });

    // ── Defeat arc: captured piece spins and flies home on a high parabola ────
    if (hopSteps === 'defeat') {
      setIsHopping(true);
      (async () => {
        // Brief delay so the shockwave renders first
        await new Promise<void>(r => setTimeout(r, 95));
        if (stale()) return;
        const { x, y } = finalRef.current;
        const defMs = Math.max(hopMs * 2.6, 420);
        await Promise.all([
          baseCtrl.start({
            x, y,
            transition: { duration: defMs / 1000, ease: [0.10, 0, 0.68, 1] },
          }),
          arcCtrl.start({
            y:      [0, -DEFEAT_ARC_H, 0],
            rotate: [0, 540],               // 1.5 dramatic spins
            transition: {
              duration: defMs / 1000,
              y:      { times: [0, 0.36, 1], ease: ['easeOut', 'easeIn'] },
              rotate: { ease: 'easeIn' },
            },
          }),
        ]);
        if (stale()) return;
        arcCtrl.set({ y: 0, rotate: 0, scaleX: 1, scaleY: 1 });
        onDefeatRef.current?.();   // trigger home-pad impact flash
        setIsHopping(false);
      })();
      return;
    }

    // ── Normal hop sequence ──────────────────────────────────────────────────
    // Fix 2: strict step-by-step — each hop awaits before the next begins.
    // Fix 3: track previous position so we only animate the axis that changes,
    //        preventing Framer Motion from blending both axes diagonally at corners.
    setIsHopping(true);
    (async () => {
      const dur = hopMs / 1000;

      // Seed previous position from the explicit start props (from triggerMove)
      // or fall back to the current finalX/Y (which is the piece's current tile).
      let prevX = startX ?? finalRef.current.x;
      let prevY = startY ?? finalRef.current.y;

      for (let i = 0; i < hopSteps.length; i++) {
        if (stale()) return;
        const step   = hopSteps[i];
        const isLast = i === hopSteps.length - 1;

        // Only animate the axis that actually changes this step.
        // When only X changes, Framer Motion never touches Y → no diagonal drift.
        const dX = Math.abs(step.x - prevX) > 0.001;
        const dY = Math.abs(step.y - prevY) > 0.001;
        const moveTarget: Record<string, unknown> = {
          transition: { duration: dur, ease: STEP_EASE },
        };
        if (dX) moveTarget.x = step.x;
        if (dY) moveTarget.y = step.y;

        // Lateral movement + parabolic arc run in parallel.
        // Skip the arc for pure downward-vertical steps: the arc animates the
        // inner group's Y upward [0, -ARC_H, 0], which directly opposes the
        // outer group's downward Y translation and causes visible stutter.
        // All other directions (horizontal, upward, diagonal corners) are unaffected.
        const isDownward = !dX && dY && (step.y - prevY) > 0.001;
        await Promise.all([
          baseCtrl.start(moveTarget as Parameters<typeof baseCtrl.start>[0]),
          isDownward
            ? Promise.resolve()
            : arcCtrl.start({
                y: [0, -ARC_H, 0],
                transition: {
                  duration: dur,
                  times: [0, 0.45, 1],
                  ease: ['easeIn', 'easeOut'],
                },
              }),
        ]);

        prevX = step.x;
        prevY = step.y;

        // ── Squash & stretch on landing ──────────────────────────────────────
        // Fired but NOT awaited — plays concurrently with the inter-step pause
        if (!stale()) {
          arcCtrl.start({
            scaleX: [1, SQUASH_X, 1],
            scaleY: [1, SQUASH_Y, 1],
            transition: {
              duration: (isLast ? SQUASH_MS * 1.6 : SQUASH_MS) / 1000,
              times:    [0, 0.28, 1],
              ease:     'easeOut',
            },
          });
        }

        if (isLast) {
          // Fix 1: fire onLastHopLand only when the pawn is physically on the
          // final tile — game state resolution (capture, turn change) happens here.
          onLastHopRef.current?.();
          await new Promise<void>(r => setTimeout(r, Math.ceil(SQUASH_MS * 1.6)));
          if (!stale()) arcCtrl.set({ scaleX: 1, scaleY: 1 });
        } else {
          if (stale()) return;
          await new Promise<void>(r => setTimeout(r, INTER_MS));
          if (!stale()) arcCtrl.set({ scaleX: 1, scaleY: 1 });
        }
      }

      if (stale()) return;
      // Final spring corrects stacking offsets (multiple pieces on same tile).
      const { x, y } = finalRef.current;
      await baseCtrl.start({ x, y, transition: LAND_SPRING });
      if (!stale()) setIsHopping(false);
    })();
  }, [hopSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: non-hop position updates ─────────────────────────────────────
  useEffect(() => {
    if (hopSteps !== null) return;
    baseCtrl.start({ x: finalX, y: finalY,
      transition: { type: 'spring', ...springCfgRef.current } });
  }, [finalX, finalY, hopSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visual geometry (unchanged) ──────────────────────────────────────────────
  const neon     = E.PLAYER_NEONS[player];
  const HR       = 0.325;
  const h3       = HR * 0.866;
  const hexPts   = `0,${-HR} ${h3},${-HR*0.5} ${h3},${HR*0.5} 0,${HR} ${-h3},${HR*0.5} ${-h3},${-HR*0.5}`;
  const hr2      = HR * 0.62;
  const h32      = hr2 * 0.866;
  const innerPts = `0,${-hr2} ${h32},${-hr2*0.5} ${h32},${hr2*0.5} 0,${hr2} ${-h32},${hr2*0.5} ${-h32},${-hr2*0.5}`;
  const pR       = HR + 0.148;
  const ph3      = pR * 0.866;
  const pulsePts = `0,${-pR} ${ph3},${-pR*0.5} ${ph3},${pR*0.5} 0,${pR} ${-ph3},${pR*0.5} ${-ph3},${-pR*0.5}`;

  // ── 3D dome-token geometry (shared by Classic's ball dome and DZ's onion dome) ──
  const clSolid   = CL_SOLID[player as 0|1|2|3];
  const clBorder  = CL_BORDER[player as 0|1|2|3];
  const dzColor   = DZ.HOME_COLORS[player as 0|1|2|3];
  const domeR     = 0.275;
  const domeCY    = -0.06;
  const baseRX    = 0.30;
  const baseRY    = 0.10;
  const baseCY    = 0.19;

  return (
    // Outer group: tile-to-tile x/y movement — GPU-composited layer
    <motion.g
      animate={baseCtrl}
      initial={{ x: finalX, y: finalY }}
      onClick={() => !isHopping && onPieceClick()}
      style={{ cursor: isMovable && !isHopping ? 'pointer' : 'default', willChange: 'transform' }}>

      {/* Ground shadow — anchored to base elevation, NOT lifted by arc */}
      <ellipse cx={0.04} cy={HR*0.90} rx={HR*0.70} ry={HR*0.18}
        fill={isClassic ? 'rgba(30,20,8,0.38)' : isDz ? 'rgba(20,14,4,0.40)' : 'rgba(0,0,0,0.62)'}
        filter={isClassic ? 'url(#cl-pawn-shadow)' : isDz ? 'url(#dz-pawn-shadow)' : undefined}/>

      {/* Inner group: parabolic Y-arc overlay — GPU-composited for buttery arcs */}
      <motion.g animate={arcCtrl} initial={{ y: 0 }} style={{ willChange: 'transform' }}>

        {isClassic ? (
          <>
            {/* Ambient warm halo — mirrors the neon bloom's radius so tap/click
                hit-area stays identical between themes (pointer-events follow
                painted geometry on the shared outer <motion.g> onClick). */}
            <circle cx={0} cy={0} r={HR*1.55} fill={clSolid} fillOpacity="0.05"/>

            {/* Movable piece — soft gold halo, premium & quiet vs. the neon pulse */}
            {isMovable && (
              <motion.circle cx={0} cy={domeCY} r={domeR + 0.08}
                fill="none" stroke="#D9A400" strokeWidth="0.034"
                animate={{ opacity: [0.28, 0.88, 0.28] }}
                transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Base disc — flattened pedestal foot, top-lit gradient for real dimension */}
            <ellipse cx={0} cy={baseCY} rx={baseRX} ry={baseRY}
              fill={`url(#clbase${player})`}
              stroke={clBorder} strokeWidth="0.018" strokeOpacity="0.60"/>
            {/* Base underside shadow — grounds the pedestal against the board */}
            <path d={`M ${baseRX},${baseCY} A ${baseRX} ${baseRY} 0 0 1 ${-baseRX},${baseCY}`}
              fill="none" stroke="#000000" strokeOpacity="0.22" strokeWidth="0.026"/>
            {/* Base rim catch-light */}
            <ellipse cx={0} cy={baseCY - baseRY*0.55} rx={baseRX*0.70} ry={baseRY*0.32}
              fill="white" fillOpacity="0.26"/>

            {/* Dome / helmet body — glossy 3D ball, rich per-colour radial gradient for deep saturation */}
            <circle cx={0} cy={domeCY} r={domeR}
              fill={`url(#clpawn${player})`}
              stroke={clBorder} strokeWidth="0.020" strokeOpacity="0.80"/>

            {/* Core shadow — asymmetric inner shading opposite the highlight, real 3D depth */}
            <ellipse cx={domeR*0.30} cy={domeCY + domeR*0.46} rx={domeR*0.74} ry={domeR*0.34}
              fill="#000000" fillOpacity="0.22"/>

            {/* Subtle bottom-edge rim light — light bouncing up off the board, premium plastic cue */}
            <path
              d={`M ${domeR*0.966},${domeCY + domeR*0.259} A ${domeR} ${domeR} 0 0 1 ${-domeR*0.174},${domeCY + domeR*0.985}`}
              fill="none" stroke="#FFF3D6" strokeOpacity="0.55" strokeWidth="0.018" strokeLinecap="round"/>

            {/* Crisp dome rim */}
            <circle cx={0} cy={domeCY} r={domeR}
              fill="none" stroke="white" strokeWidth="0.010" strokeOpacity="0.24"/>

            {/* Top specular highlight — bright glossy hotspot, luxury lacquered-plastic sheen */}
            <ellipse cx={-0.09} cy={domeCY - 0.10} rx={0.105} ry={0.072}
              fill="white" fillOpacity="0.62"/>
            <circle cx={-0.118} cy={domeCY - 0.132} r="0.032" fill="white" fillOpacity="0.96"/>
            {/* Secondary sheen streak along the upper rim, glass-like curvature cue */}
            <path d={`M ${-domeR*0.55},${domeCY - domeR*0.72} A ${domeR} ${domeR} 0 0 1 ${domeR*0.15},${domeCY - domeR*0.985}`}
              fill="none" stroke="white" strokeOpacity="0.30" strokeWidth="0.012" strokeLinecap="round"/>
          </>
        ) : isDz ? (
          <>
            {/* Ambient warm halo — mirrors the neon bloom's radius so tap/click hit-area
                stays identical between themes. */}
            <circle cx={0} cy={0} r={HR*1.55} fill={dzColor} fillOpacity="0.06"/>

            {/* Movable piece — soft gold halo pulse, premium & quiet vs. the neon pulse */}
            {isMovable && (
              <motion.circle cx={0} cy={domeCY} r={domeR + 0.09}
                fill="none" stroke={DZ.BORDER_GOLD} strokeWidth="0.032"
                animate={{ opacity: [0.30, 0.92, 0.30] }}
                transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Base pedestal — shared brass/gold foot across all four players */}
            <ellipse cx={0} cy={baseCY} rx={baseRX} ry={baseRY}
              fill="url(#dzbase)" stroke={DZ.BORDER_DEEP} strokeWidth="0.018" strokeOpacity="0.70"/>
            <ellipse cx={0} cy={baseCY - baseRY*0.55} rx={baseRX*0.68} ry={baseRY*0.30}
              fill="white" fillOpacity="0.30"/>

            {/* Onion-dome / lantern body — the player's Algerian home colour */}
            <path d={dzDomePath(0, domeCY, domeR)}
              fill={`url(#dzpawn${player})`} stroke={DZ.BORDER_GOLD} strokeWidth="0.022" strokeOpacity="0.95"/>

            {/* Gold belt at the dome neck */}
            <path d={`M ${-0.66*domeR},${domeCY-0.56*domeR} A ${0.66*domeR} ${0.14*domeR} 0 0 0 ${0.66*domeR},${domeCY-0.56*domeR}`}
              fill="none" stroke={DZ.BORDER_GOLD} strokeWidth="0.030" strokeOpacity="0.92"/>

            {/* Facet hairline lattice on the dome face — echoes the board's star-lattice motif */}
            <path d={`M 0,${domeCY-0.95*domeR} L ${0.28*domeR},${domeCY-0.30*domeR} L 0,${domeCY+0.30*domeR} L ${-0.28*domeR},${domeCY-0.30*domeR} Z`}
              fill="none" stroke={DZ.BORDER_DEEP} strokeWidth="0.012" strokeOpacity="0.40"/>

            {/* Specular highlight */}
            <ellipse cx={-0.16*domeR} cy={domeCY-0.55*domeR} rx={0.13*domeR} ry={0.20*domeR}
              fill="white" fillOpacity="0.42"/>

            {/* Eight-point star finial */}
            <polygon points={starPoints(0, domeCY - 1.15*domeR - 0.075, 0.075, 0.030, 8)} fill={DZ.BORDER_GOLD}/>
            <circle cx={0} cy={domeCY - 1.15*domeR - 0.075} r="0.022" fill="#fff" fillOpacity="0.7"/>
          </>
        ) : (
          <>
        {/* Ambient neon bloom */}
        <circle cx={0} cy={0} r={HR*1.55} fill={neon} fillOpacity="0.042"/>

        {/* Movable hex pulse ring */}
        {isMovable && (
          <motion.polygon points={pulsePts}
            fill="none" stroke={neon} strokeWidth="0.076"
            animate={{ opacity: [0.15, 0.88, 0.15] }}
            transition={{ duration: 0.88, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Hex body */}
        <polygon points={hexPts}
          fill={`url(#pgcp${player})`}
          filter={isMovable ? `url(#pglow${player})` : undefined}
        />

        {/* Neon hex rim */}
        <polygon points={hexPts} fill="none"
          stroke={isMovable ? neon : `url(#pgrim${player})`}
          strokeWidth={isMovable ? 0.056 : 0.028}
        />

        {/* Inner hex frame */}
        <polygon points={innerPts}
          fill="none" stroke={neon} strokeWidth="0.012" strokeOpacity="0.26"
        />

        {/* 3 internal circuit trace lines */}
        <line x1={0} y1={-HR*0.86} x2={0} y2={HR*0.86}
          stroke={neon} strokeWidth="0.010" strokeOpacity="0.22"/>
        <line x1={-h3*0.86} y1={-HR*0.5*0.86} x2={h3*0.86} y2={HR*0.5*0.86}
          stroke={neon} strokeWidth="0.010" strokeOpacity="0.17"/>
        <line x1={h3*0.86} y1={-HR*0.5*0.86} x2={-h3*0.86} y2={HR*0.5*0.86}
          stroke={neon} strokeWidth="0.010" strokeOpacity="0.17"/>

        {/* Vertex tick marks (5 — skip top, reserved for antenna) */}
        {([[h3,-HR*0.5],[h3,HR*0.5],[0,HR],[-h3,HR*0.5],[-h3,-HR*0.5]] as [number,number][])
          .map(([vx,vy], vi) => (
            <line key={vi}
              x1={vx} y1={vy}
              x2={vx*(1+0.068/HR)} y2={vy*(1+0.068/HR)}
              stroke={neon} strokeWidth="0.018" strokeOpacity="0.66"
            />
          ))}

        {/* Top antenna spike + signal dot */}
        <line x1={0} y1={-HR} x2={0} y2={-HR-0.172}
          stroke={neon} strokeWidth="0.015" strokeOpacity="0.84" strokeLinecap="round"/>
        <circle cx={0} cy={-HR-0.172} r="0.026" fill={neon} opacity="0.92"/>

        {/* Central targeting crosshair */}
        <line x1={-0.118} y1={0} x2={0.118} y2={0}
          stroke="white" strokeWidth="0.013" strokeOpacity="0.60"/>
        <line x1={0} y1={-0.118} x2={0} y2={0.118}
          stroke="white" strokeWidth="0.013" strokeOpacity="0.60"/>
        <circle cx={0} cy={0} r="0.054"
          fill="none" stroke="white" strokeWidth="0.011" strokeOpacity="0.44"/>

        {/* Specular highlight along upper-left edge */}
        <line
          x1={-h3*0.48} y1={-HR*0.5*0.48}
          x2={-h3*0.04} y2={-HR*0.88}
          stroke="white" strokeWidth="0.028" strokeOpacity="0.56" strokeLinecap="round"
        />
        <circle cx={-h3*0.27} cy={-HR*0.68} r="0.019" fill="white" opacity="0.46"/>
          </>
        )}
      </motion.g>
    </motion.g>
  );
}

// ─── Shockwave burst — neon ripple rings that emanate from the capture tile ────
function ShockwaveEffect({
  x, y, neon, onDone,
}: { x: number; y: number; neon: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 750);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <g pointerEvents="none">
      {/* Three expanding neon rings, staggered */}
      {[0, 1, 2].map(i => (
        <motion.circle
          key={i}
          cx={x} cy={y} r={0.10}
          fill="none"
          stroke={neon}
          strokeWidth={0.09 - i * 0.022}
          style={{ transformOrigin: `${x}px ${y}px` }}
          initial={{ scale: 1, opacity: 0.88 - i * 0.08 }}
          animate={{ scale: 12 + i * 3, opacity: 0 }}
          transition={{ duration: 0.46 + i * 0.11, delay: i * 0.07, ease: 'easeOut' }}
        />
      ))}
      {/* Hot core — bright filled disc that implodes inward */}
      <motion.circle
        cx={x} cy={y} r={0.42}
        fill={neon}
        style={{ transformOrigin: `${x}px ${y}px` }}
        initial={{ scale: 1, fillOpacity: 0.72 }}
        animate={{ scale: 0.08, fillOpacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      />
    </g>
  );
}

// ─── Home Finish VFX — cyberpunk neon burst when a pawn reaches center ────────
function HomeFinishVFX({
  x, y, neon, onDone,
}: { x: number; y: number; neon: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 950);
    return () => clearTimeout(t);
  }, [onDone]);

  const SPOKES = 8;
  const SPOKE_LEN = 2.8;

  return (
    <g pointerEvents="none">
      {/* White-hot core flash */}
      <motion.circle cx={x} cy={y} r={0.16}
        fill="white"
        style={{ transformOrigin: `${x}px ${y}px` }}
        initial={{ scale: 1, opacity: 0.95 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
      {/* Neon core burst */}
      <motion.circle cx={x} cy={y} r={0.22}
        fill={neon}
        style={{ transformOrigin: `${x}px ${y}px` }}
        initial={{ scale: 1, opacity: 0.88 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.40, ease: 'easeOut' }}
      />
      {/* Three expanding neon rings, staggered */}
      {[0, 1, 2].map(i => (
        <motion.circle
          key={i}
          cx={x} cy={y} r={0.12}
          fill="none"
          stroke={neon}
          strokeWidth={0.11 - i * 0.026}
          style={{ transformOrigin: `${x}px ${y}px` }}
          initial={{ scale: 1, opacity: 0.90 - i * 0.14 }}
          animate={{ scale: 11 + i * 6, opacity: 0 }}
          transition={{ duration: 0.54 + i * 0.14, delay: i * 0.09, ease: 'easeOut' }}
        />
      ))}
      {/* Outer white sparkle ring */}
      <motion.circle cx={x} cy={y} r={0.09}
        fill="none" stroke="white" strokeWidth={0.065}
        style={{ transformOrigin: `${x}px ${y}px` }}
        initial={{ scale: 1, opacity: 0.88 }}
        animate={{ scale: 16, opacity: 0 }}
        transition={{ duration: 0.78, delay: 0.06, ease: 'easeOut' }}
      />
      {/* 8 radial particle sparks flying outward */}
      {Array.from({ length: SPOKES }, (_, i) => {
        const angle  = (i / SPOKES) * Math.PI * 2;
        const tx     = Math.cos(angle) * SPOKE_LEN;
        const ty     = Math.sin(angle) * SPOKE_LEN;
        return (
          <motion.g
            key={i}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: tx, y: ty, opacity: 0 }}
            transition={{ duration: 0.50, delay: 0.04, ease: 'easeOut' }}
          >
            <circle cx={x} cy={y} r={0.10} fill={neon}/>
          </motion.g>
        );
      })}
    </g>
  );
}

// ─── Shared animation types (used by BoardSVG and GameBoardScreen) ────────────
type ShockwaveEvent = { x: number; y: number; neon: string; id: number };
type HomeImpactEvent = { player: number; index: number; id: number };
type PieceAnim = {
  steps: HopStep[] | 'defeat' | null;
  startX?: number;   // piece's visual X before the hop starts (for axis-diff)
  startY?: number;   // piece's visual Y before the hop starts
  onLastHop?: () => void;
  onArrival?: () => void;
};

// ─── BoardSVG — pure game board ───────────────────────────────────────────────
interface BoardSVGProps {
  game: E.GameState;
  onPieceClick: (pid: string) => void;
  springCfg: { stiffness: number; damping: number; mass: number };
  hopMs: number;
  // Animation state — owned by GameBoardScreen, threaded down here for rendering
  pieceAnims: Record<string, PieceAnim>;
  shockwave: ShockwaveEvent | null;
  onShockwaveDone: () => void;
  homeImpact: HomeImpactEvent | null;
  homeFinishVFX: ShockwaveEvent | null;
  onHomeFinishDone: () => void;
  boardStyle?: BoardStyle;
}

function BoardSVG({
  game, onPieceClick, springCfg, hopMs,
  pieceAnims, shockwave, onShockwaveDone,
  homeImpact, homeFinishVFX, onHomeFinishDone,
  boardStyle,
}: BoardSVGProps) {
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const isClassic   = boardStyle === 'classic';
  const isDz        = boardStyle === 'dz';
  // Classic palette: uses module-level CL_SOLID / CL_LIGHT / CL_BORDER / CL_ARROW
  // DZ palette: uses ../lib/board-theme-dz (Phase 1 — base colors only)
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
        {/* ── Exit-square (start cell) premium neon tint ── */}
        {E.PLAYER_NEONS.map((n, i) => (
          <radialGradient key={i} id={`exitcell${i}`} cx="50%" cy="32%" r="80%">
            <stop offset="0%"   stopColor="white"               stopOpacity="0.55"/>
            <stop offset="38%"  stopColor={n}                   stopOpacity="0.85"/>
            <stop offset="100%" stopColor={E.PLAYER_COLORS[i]}  stopOpacity="0.60"/>
          </radialGradient>
        ))}
        {E.PLAYER_NEONS.map((_, i) => (
          <filter key={i} id={`pglow${i}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.18" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
        <filter id="star-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.11" result="b"/>
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
        {/* ── Cyberpunk pawn body gradient: dark core → player colour → neon rim ── */}
        {E.PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`pgcp${i}`} cx="28%" cy="20%" r="90%">
            <stop offset="0%"   stopColor="#0b1220"/>
            <stop offset="38%"  stopColor={c} stopOpacity="0.78"/>
            <stop offset="78%"  stopColor={c}/>
            <stop offset="100%" stopColor={E.PLAYER_NEONS[i]} stopOpacity="0.90"/>
          </radialGradient>
        ))}
        {/* ── Scanline CRT texture pattern ── */}
        <pattern id="cpscan" x="0" y="0" width="15" height="0.22" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="15" y2="0" stroke="white" strokeWidth="0.017" strokeOpacity="0.024"/>
        </pattern>
        {/* ── Classic-only defs (Classic Board theme). Gated so nothing new is
              emitted at all when the Neon theme is active. ── */}
        {isClassic && (
          <>
            {/* Classic luxury dome-token gradients */}
            {CL_SOLID.map((c, i) => (
              <radialGradient key={i} id={`clpawn${i}`} cx="31%" cy="19%" r="95%">
                <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1"/>
                <stop offset="8%"   stopColor="#FFFFFF" stopOpacity="0.62"/>
                <stop offset="23%"  stopColor={shadeColor(c, 22)} stopOpacity="1"/>
                <stop offset="48%"  stopColor={c}/>
                <stop offset="76%"  stopColor={shadeColor(c, -20)}/>
                <stop offset="92%"  stopColor={shadeColor(c, -42)}/>
                <stop offset="100%" stopColor={shadeColor(c, -58)}/>
              </radialGradient>
            ))}
            {CL_SOLID.map((c, i) => (
              <linearGradient key={i} id={`clbase${i}`} x1="26%" y1="0%" x2="70%" y2="100%">
                <stop offset="0%"   stopColor={shadeColor(c, 24)}/>
                <stop offset="42%"  stopColor={c}/>
                <stop offset="78%"  stopColor={shadeColor(c, -28)}/>
                <stop offset="100%" stopColor={shadeColor(c, -52)}/>
              </linearGradient>
            ))}
            {/* Soft, realistic ground-shadow blur for the Classic pawn cast shadow */}
            <filter id="cl-pawn-shadow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="0.05"/>
            </filter>

            {/* Classic home-base warmth & inlay gradients */}
            {/* Warm ivory/parchment panel — replaces flat white for a printed-cardstock feel */}
            <radialGradient id="clivory" cx="40%" cy="28%" r="90%">
              <stop offset="0%"   stopColor="#FFFDF6"/>
              <stop offset="45%"  stopColor="#FAF0D6"/>
              <stop offset="78%"  stopColor="#F0DDA8"/>
              <stop offset="100%" stopColor="#E2C283"/>
            </radialGradient>
            {/* Beveled gilt inlay edge — bright catch-light to deep brass shadow */}
            <linearGradient id="clbevel" x1="12%" y1="8%" x2="88%" y2="92%">
              <stop offset="0%"   stopColor="#FFFAEA"/>
              <stop offset="45%"  stopColor="#E9C878"/>
              <stop offset="75%"  stopColor="#B8863B"/>
              <stop offset="100%" stopColor="#7A5423"/>
            </linearGradient>
            {/* Polished brass ring used for the pawn-socket collars and medallion rim */}
            <linearGradient id="clbrass" x1="20%" y1="10%" x2="80%" y2="95%">
              <stop offset="0%"   stopColor="#FCEBB6"/>
              <stop offset="50%"  stopColor="#C9A24B"/>
              <stop offset="100%" stopColor="#8C6423"/>
            </linearGradient>
            {/* Recessed pawn-socket gradients — jewel-like depth: bright hotspot → rich body → deep shadow */}
            {CL_SOLID.map((c, i) => (
              <radialGradient key={i} id={`clsocket${i}`} cx="40%" cy="34%" r="68%">
                <stop offset="0%"   stopColor={shadeColor(c, 42)}/>
                <stop offset="18%"  stopColor={shadeColor(c, 22)}/>
                <stop offset="52%"  stopColor={c}/>
                <stop offset="82%"  stopColor={shadeColor(c, -28)}/>
                <stop offset="100%" stopColor={shadeColor(c, -52)}/>
              </radialGradient>
            ))}

            {/* ── Safe-square star: cream-gold highlight → pure gold → amber shadow ── */}
            <radialGradient id="cl-safe-star" cx="35%" cy="28%" r="80%">
              <stop offset="0%"   stopColor="#FFFAC0"/>
              <stop offset="22%"  stopColor="#FFD700"/>
              <stop offset="62%"  stopColor="#E8A800"/>
              <stop offset="100%" stopColor="#B07818"/>
            </radialGradient>
            {/* ── Jewel dome: white highlight → cream gold → warm brass ── */}
            <radialGradient id="cl-star-jewel" cx="32%" cy="24%" r="72%">
              <stop offset="0%"   stopColor="#FFFFFF"/>
              <stop offset="30%"  stopColor="#FFF3A0"/>
              <stop offset="70%"  stopColor="#FFCC40"/>
              <stop offset="100%" stopColor="#B07818"/>
            </radialGradient>
            {/* ── Center star: ivory flash → bright gold → deep amber → rich brass ── */}
            <radialGradient id="cl-center-star" cx="36%" cy="26%" r="82%">
              <stop offset="0%"   stopColor="#FFFFE8"/>
              <stop offset="18%"  stopColor="#FFE066"/>
              <stop offset="48%"  stopColor="#FFB700"/>
              <stop offset="76%"  stopColor="#D47C00"/>
              <stop offset="100%" stopColor="#8C5200"/>
            </radialGradient>
            {/* ── Linen cross-hatch: classic board-game paper grain ── */}
            <pattern id="cl-linen" x="0" y="0" width="0.55" height="0.55" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0.55" y2="0.55" stroke="rgba(130,90,30,0.046)" strokeWidth="0.062"/>
              <line x1="0.55" y1="0" x2="0" y2="0.55" stroke="rgba(130,90,30,0.046)" strokeWidth="0.062"/>
            </pattern>
            {/* ── Soft golden glow for safe-square stars ── */}
            <filter id="cl-safe-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="0.13" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* ── Richer two-pass glow for the center focal star ── */}
            <filter id="cl-center-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="0.22" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

            {/* ── Board frame gilt gradient — diagonal sweep for outer border accent ── */}
            <linearGradient id="cl-frame-gilt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FFF5B0"/>
              <stop offset="28%"  stopColor="#D4A840"/>
              <stop offset="68%"  stopColor="#9A6C20"/>
              <stop offset="100%" stopColor="#E8C860"/>
            </linearGradient>

            {/* ── Safe-star outer ring gradient — brighter than the star fill itself ── */}
            <radialGradient id="cl-star-ring" cx="35%" cy="28%" r="78%">
              <stop offset="0%"   stopColor="#FFFBE8"/>
              <stop offset="40%"  stopColor="#E8A400"/>
              <stop offset="100%" stopColor="#7A5210"/>
            </radialGradient>

            {/* ── Center star ambient bloom — wide warm haze beneath the focal star ── */}
            <radialGradient id="cl-center-bloom" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FFE566" stopOpacity="0.70"/>
              <stop offset="55%"  stopColor="#FFB800" stopOpacity="0.28"/>
              <stop offset="100%" stopColor="#B07818" stopOpacity="0.00"/>
            </radialGradient>

            {/* ── Center star deepened fill — extra stop for richer mid-tone ── */}
            <radialGradient id="cl-center-star2" cx="30%" cy="22%" r="88%">
              <stop offset="0%"   stopColor="#FFFFE0"/>
              <stop offset="12%"  stopColor="#FFE566"/>
              <stop offset="34%"  stopColor="#FFB700"/>
              <stop offset="58%"  stopColor="#D07C00"/>
              <stop offset="80%"  stopColor="#A05000"/>
              <stop offset="100%" stopColor="#6C3800"/>
            </radialGradient>

            {/* ── Homecol cell depth overlay — subtle top-lit sheen per lane cell ── */}
            <linearGradient id="cl-lane-sheen" x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%"   stopColor="white"   stopOpacity="0.28"/>
              <stop offset="40%"  stopColor="white"   stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#000000"  stopOpacity="0.10"/>
            </linearGradient>

            {/* ── Home base inner vignette — darkens panel corners for depth ── */}
            <radialGradient id="cl-panel-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%"   stopColor="white"    stopOpacity="0.00"/>
              <stop offset="72%"  stopColor="white"    stopOpacity="0.00"/>
              <stop offset="100%" stopColor="#6B4010"  stopOpacity="0.16"/>
            </radialGradient>

            {/* ── Per-corner inner colour glow — warm coloured light rising through the ivory ── */}
            {CL_SOLID.map((c, i) => (
              <radialGradient key={i} id={`cl-corner-glow${i}`} cx="50%" cy="50%" r="68%">
                <stop offset="0%"   stopColor={c} stopOpacity="0.26"/>
                <stop offset="44%"  stopColor={c} stopOpacity="0.10"/>
                <stop offset="100%" stopColor={c} stopOpacity="0.00"/>
              </radialGradient>
            ))}

            {/* ── Warm board spotlight — very soft golden centre wash on the ivory surface ── */}
            <radialGradient id="cl-board-warm" cx="50%" cy="50%" r="52%">
              <stop offset="0%"   stopColor="#FFD878" stopOpacity="0.10"/>
              <stop offset="55%"  stopColor="#FFB800" stopOpacity="0.04"/>
              <stop offset="100%" stopColor="#FFB800" stopOpacity="0.00"/>
            </radialGradient>
          </>
        )}
        {/* ── DZ-only defs (Algerian decorative pass). Gated so nothing new is
              emitted when Classic/Neon are active. ── */}
        {isDz && (
          <>
            {/* Soft warm glow for the crescent-and-star emblems (safe squares + center) */}
            <filter id="dz-safe-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="0.14" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Warm radial glow for the safe-square emblem — a gradient reads crisply
                  at small cell scale, where a Gaussian blur would smear the fine
                  crescent/star linework into a blob. */}
            <radialGradient id="dz-safe-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={DZ.BORDER_GOLD} stopOpacity="0.55"/>
              <stop offset="55%"  stopColor={DZ.BORDER_GOLD} stopOpacity="0.20"/>
              <stop offset="100%" stopColor={DZ.BORDER_GOLD} stopOpacity="0"/>
            </radialGradient>
            {/* Islamic star-lattice (najma) — 8-point stars centered on each tile reach exactly
                  to the tile edges, so neighbouring tiles' points touch and chain into a
                  continuous woven lattice; a smaller companion star at each tile corner
                  (shared by 4 tiles) fills the diamond gap left between them. Stroke-only
                  hairlines read as fine engraving rather than a filled stamp. */}
            <pattern id="dz-corner-motif" x="0" y="0" width="1" height="1" patternUnits="userSpaceOnUse">
              <polygon points={starPoints(0.5, 0.5, 0.5, 0.21, 8)}
                fill="none" stroke={DZ.BORDER_DEEP} strokeWidth="0.026"/>
              <polygon points={starPoints(0, 0, 0.185, 0.078, 8)}
                fill="none" stroke={DZ.BORDER_DEEP} strokeWidth="0.026"/>
            </pattern>
            {/* Zellige compass-star tracery — the same najma lattice as the corner motif, doubled
                  in scale and drawn in gold hairlines for a faint engraved-floor overlay across
                  the whole board. */}
            <pattern id="dz-zellige" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
              <polygon points={starPoints(1, 1, 1.0, 0.42, 8)}
                fill="none" stroke={DZ.BORDER_GOLD} strokeWidth="0.028"/>
              <polygon points={starPoints(0, 0, 0.37, 0.155, 8)}
                fill="none" stroke={DZ.BORDER_GOLD} strokeWidth="0.028"/>
            </pattern>
            {/* Soft ground-shadow blur for the DZ pawn — a dedicated filter (rather
                  than reusing cl-pawn-shadow) so DZ never depends on a filter id that
                  only exists when Classic is active. */}
            <filter id="dz-pawn-shadow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="0.05"/>
            </filter>
            {/* DZ pawn body — onion-dome lantern gradient, one per player's home colour */}
            {DZ.HOME_COLORS.map((c, i) => (
              <radialGradient key={i} id={`dzpawn${i}`} cx="32%" cy="20%" r="92%">
                <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.75"/>
                <stop offset="26%"  stopColor={shadeColor(c, 18)}/>
                <stop offset="55%"  stopColor={c}/>
                <stop offset="100%" stopColor={shadeColor(c, -30)}/>
              </radialGradient>
            ))}
            {/* DZ pawn base — shared brass/gold pedestal foot across all four players */}
            <linearGradient id="dzbase" x1="20%" y1="0%" x2="75%" y2="100%">
              <stop offset="0%"   stopColor="#F6E3A8"/>
              <stop offset="48%"  stopColor={DZ.BORDER_GOLD}/>
              <stop offset="100%" stopColor={shadeColor(DZ.BORDER_GOLD, -38)}/>
            </linearGradient>
          </>
        )}
      </defs>

      {/* ── Background ── */}
      <rect width="15" height="15" fill={isClassic ? '#EEE9DF' : isDz ? DZ.BOARD_BG : '#030b16'}/>
      {/* Classic: linen cross-hatch paper grain — the feel of a premium printed board */}
      {isClassic && <rect width="15" height="15" fill="url(#cl-linen)"/>}
      {/* Classic: very soft warm golden spotlight — light from above hitting the centre */}
      {isClassic && <rect width="15" height="15" fill="url(#cl-board-warm)" pointerEvents="none"/>}
      {/* DZ: the zellige overlay is drawn after every cell (see Board border section below) so
            the pattern actually reads as a texture on the felt, instead of being hidden under
            the opaque home-zone and path-cell fills painted on top of this background rect. */}

      {/* ── Home zones ── */}
      {[0,1,2,3].map(player => {
        const [zr, zc] = [[0,0],[0,9],[9,9],[9,0]][player] as [number,number];
        const neon      = E.PLAYER_NEONS[player];
        const exists    = game.playerSlots.includes(player);
        const isCurrent = player === game.activePlayer && game.phase !== 'done';
        const cx = zc + 3, cy = zr + 3;

        // Opacity helper
        const ao = (base: number) =>
          exists ? (isCurrent ? Math.min(base * 1.55, 1) : base) : base * 0.15;

        // Hex polygon points string: pointy-top, centered at (x,y), radius R
        const hexStr = (x: number, y: number, R: number): string => {
          const s = R * 0.866;
          return `${x},${y-R} ${x+s},${y-R*0.5} ${x+s},${y+R*0.5} ${x},${y+R} ${x-s},${y+R*0.5} ${x-s},${y-R*0.5}`;
        };

        if (isDz) {
          // Structural home base (Phase 1) + a very subtle star-lattice texture (Phase 2).
          const solid = DZ.HOME_COLORS[player as 0|1|2|3];
          return (
            <g key={`hz-${player}`}>
              <rect x={zc} y={zr} width="6" height="6" fill={solid}
                fillOpacity={exists ? (isCurrent ? 1 : 0.94) : 0.30}/>
              {/* Islamic star-lattice — felt, not seen: a quiet engraved texture */}
              <rect x={zc} y={zr} width="6" height="6" fill="url(#dz-corner-motif)"
                fillOpacity="0.08" pointerEvents="none"/>
              <rect x={zc} y={zr} width="6" height="6" fill="none"
                stroke={DZ.BORDER_DEEP}
                strokeWidth={isCurrent ? 0.10 : 0.05}
                strokeOpacity={isCurrent ? 0.95 : exists ? 0.68 : 0.20}/>
            </g>
          );
        }

        if (isClassic) {
          const solid  = CL_SOLID[player as 0|1|2|3];
          const border = CL_BORDER[player as 0|1|2|3];
          const mainOp = exists ? (isCurrent ? 0.98 : 0.92) : 0.26;
          const fade   = exists ? 1 : 0.30;
          const beads  = beadRect(zc+0.20, zr+0.20, zc+5.80, zr+5.80, 0.62);
          return (
            <g key={`hz-${player}`}>
              {/* Solid coloured background — the bold outer "frame" of the tray */}
              <rect x={zc} y={zr} width="6" height="6" fill={solid} fillOpacity={mainOp}/>
              {/* Beaded gilt trim — a row of brass studs set into the colour band,
                  the first clearly-legible "premium hardware" cue at board scale */}
              {beads.map(([bx,by], i) => (
                <circle key={`bd-${i}`} cx={bx} cy={by} r="0.052"
                  fill="url(#clbrass)" stroke="#5C3D14" strokeWidth="0.010"
                  fillOpacity={0.85*fade} strokeOpacity={0.55*fade}/>
              ))}

              {/* Inner ivory/parchment panel — warm, rich, not flat white */}
              <rect x={zc+0.40} y={zr+0.40} width="5.20" height="5.20" rx="0.22"
                fill="url(#clivory)" fillOpacity={exists ? 0.99 : 0.68}/>
              {/* Soft drop shadow under the panel's top edge, reads as a raised tray */}
              <rect x={zc+0.40} y={zr+0.40} width="5.20" height="0.16" rx="0.06"
                fill="#000000" fillOpacity={0.10*fade}/>
              {/* Glossy sheen across the upper third */}
              <rect x={zc+0.40} y={zr+0.40} width="5.20" height="1.35" rx="0.22"
                fill="white" fillOpacity={exists ? 0.24 : 0.08}/>
              {/* Inner colour glow — player colour washing up through the ivory like candlelight */}
              <rect x={zc+0.40} y={zr+0.40} width="5.20" height="5.20" rx="0.22"
                fill={`url(#cl-corner-glow${player})`}
                fillOpacity={exists ? 1.0 : 0.18}
                pointerEvents="none"/>
              {/* Corner vignette — darkens the panel edges for enclosure and depth */}
              <rect x={zc+0.40} y={zr+0.40} width="5.20" height="5.20" rx="0.22"
                fill="url(#cl-panel-vignette)" fillOpacity={0.92*fade}
                pointerEvents="none"/>

              {/* Gilt double-line inset frame — a real bordered-cardstock/inlaid-wood edge */}
              <rect x={zc+0.68} y={zr+0.68} width="4.64" height="4.64" rx="0.14"
                fill="none" stroke="url(#clbevel)" strokeWidth="0.070"
                strokeOpacity={0.85*fade}/>
              <rect x={zc+0.68} y={zr+0.68} width="4.64" height="4.64" rx="0.14"
                fill="none" stroke={solid} strokeWidth="0.020"
                strokeOpacity={0.55*fade}/>
              <rect x={zc+0.86} y={zr+0.86} width="4.28" height="4.28" rx="0.10"
                fill="none" stroke={border} strokeWidth="0.014"
                strokeOpacity={0.30*fade}/>

              {/* Corner flourishes — fan of brass ticks + diamond tip, quietly ornate */}
              {([[zc+0.68,zr+0.68],[zc+5.32,zr+0.68],[zc+5.32,zr+5.32],[zc+0.68,zr+5.32]] as [number,number][])
                .map(([bx,by], i) => {
                  const sx2 = bx < cx ? 1 : -1;
                  const sy2 = by < cy ? 1 : -1;
                  return (
                    <g key={`ca-${i}`}>
                      <polyline
                        points={`${bx+sx2*0.34},${by} ${bx},${by} ${bx},${by+sy2*0.34}`}
                        fill="none" stroke="url(#clbrass)" strokeWidth="0.055"
                        strokeOpacity={0.80*fade} strokeLinecap="round"/>
                      <path d={`M ${bx+sx2*0.20},${by} A 0.20 0.20 0 0 ${sx2*sy2>0?1:0} ${bx},${by+sy2*0.20}`}
                        fill="none" stroke={border} strokeWidth="0.022" strokeOpacity={0.34*fade}/>
                      <rect x={bx+sx2*0.10-0.032} y={by+sy2*0.10-0.032} width="0.064" height="0.064"
                        fill={solid} fillOpacity={0.65*fade}
                        transform={`rotate(45 ${bx+sx2*0.10} ${by+sy2*0.10})`}/>
                    </g>
                  );
                })}

              {/* Lattice lines linking each pawn bay to the centre medallion —
                  bolder brass pinstripes give the panel real structure */}
              {E.HOME_BASES[player].map(([br, bc], si) => {
                const dx = bc+0.5 - cx, dy = br+0.5 - cy;
                const d = Math.sqrt(dx*dx + dy*dy);
                const ex2 = bc+0.5 - (dx/d)*0.50, ey2 = br+0.5 - (dy/d)*0.50;
                return (
                  <line key={`gl-${si}`}
                    x1={cx} y1={cy} x2={ex2} y2={ey2}
                    stroke="url(#clbrass)" strokeWidth="0.034" strokeOpacity={0.42*fade}/>
                );
              })}
              {E.HOME_BASES[player].map(([br, bc], si) => {
                const dx = bc+0.5 - cx, dy = br+0.5 - cy;
                const d = Math.sqrt(dx*dx + dy*dy);
                const ex2 = bc+0.5 - (dx/d)*0.50, ey2 = br+0.5 - (dy/d)*0.50;
                return (
                  <line key={`gl2-${si}`}
                    x1={cx} y1={cy} x2={ex2} y2={ey2}
                    stroke={border} strokeWidth="0.012" strokeOpacity={0.30*fade}/>
                );
              })}

              {/* Pawn bays — brass-collared wells with a true recessed inset-shadow read */}
              {E.HOME_BASES[player].map(([br, bc], si) => {
                // slotOccupied: true only when the pawn is logically home (relPos === -1)
                // AND not mid-animation. pieceAnims steps being non-null means the pawn is
                // either hopping away from home (steps=[...]) or flying back via defeat arc
                // (steps='defeat'). In both cases the slot must read as empty immediately —
                // no faded-placeholder flash on departure, no premature fill on arrival.
                const slotPid      = E.pieceId(player, si);
                const slotInHome   = game.pieces.some(
                  p => p.player === player && p.index === si && p.relPos === -1
                );
                const slotAnimating = pieceAnims[slotPid]?.steps != null;
                const slotOccupied  = slotInHome && !slotAnimating;
                return (
                <g key={si}>
                  {/* Soft two-layer recess shadow — grounds the bay like a real carved well */}
                  <circle cx={bc+0.56} cy={br+0.58} r={0.50}
                    fill="#000000" fillOpacity={slotOccupied ? 0.10 : 0.03}/>
                  <circle cx={bc+0.53} cy={br+0.54} r={0.47}
                    fill="#000000" fillOpacity={slotOccupied ? 0.15 : 0.04}/>
                  {/* Polished brass collar ring — the coin-slot "hardware" edge */}
                  <circle cx={bc+0.5} cy={br+0.5} r={0.47}
                    fill="none" stroke="url(#clbrass)" strokeWidth="0.055" strokeOpacity={0.90*fade}/>
                  {/* Dark inset rim — the recess wall, catches shadow all around */}
                  <circle cx={bc+0.5} cy={br+0.5} r={0.42}
                    fill="none" stroke="#000000" strokeWidth="0.032" strokeOpacity={slotOccupied ? 0.26 : 0.06}/>
                  <circle cx={bc+0.5} cy={br+0.5} r={0.41}
                    fill={`url(#clsocket${player})`} fillOpacity={slotOccupied ? 0.96 : 0.18}
                    stroke={border} strokeWidth="0.030" strokeOpacity={slotOccupied ? 0.85 : 0.18}/>
                  {/* Glossy highlight on pawn bay */}
                  <circle cx={bc+0.42} cy={br+0.40} r={0.15}
                    fill="white" fillOpacity={slotOccupied ? 0.44 : 0.08}/>
                  <circle cx={bc+0.36} cy={br+0.34} r={0.075}
                    fill="white" fillOpacity={slotOccupied ? 0.74 : 0.12}/>
                  {/* Lit lip along the upper-left rim — the recess "catching" light */}
                  <path d={`M ${bc+0.5-0.42*0.71},${br+0.5-0.42*0.71} A 0.42 0.42 0 0 1 ${bc+0.92},${br+0.5}`}
                    fill="none" stroke="white" strokeWidth="0.022" strokeOpacity={slotOccupied ? 0.32 : 0.06}/>
                  {homeImpact?.player === player && homeImpact?.index === si && (
                    <motion.circle
                      key={homeImpact.id}
                      cx={bc+0.5} cy={br+0.5} r={0.52}
                      fill={solid}
                      initial={{ scale: 1.5, fillOpacity: 0.80 }}
                      animate={{ scale: 1, fillOpacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  )}
                </g>
                );
              })}

              {/* Centre ornament — premium jeweled compass rosette */}
              {/* Outermost halo ring — very soft ambient gold warmth */}
              <circle cx={cx} cy={cy} r="0.90" fill={solid} fillOpacity={0.06*fade}/>
              {/* Outer engraved band — double-ring compass perimeter */}
              <circle cx={cx} cy={cy} r="0.82" fill="none" stroke="url(#clbrass)"
                strokeWidth="0.018" strokeOpacity={0.35*fade}/>
              <circle cx={cx} cy={cy} r="0.78" fill="none" stroke={border}
                strokeWidth="0.008" strokeOpacity={0.22*fade}/>
              {/* Eight outer spokes — compass needles touching the outer band */}
              {Array.from({length:8},(_,i)=>{
                const ang = (i/8)*Math.PI*2;
                return <line key={`sp-${i}`}
                  x1={cx+Math.cos(ang)*0.62} y1={cy+Math.sin(ang)*0.62}
                  x2={cx+Math.cos(ang)*0.78} y2={cy+Math.sin(ang)*0.78}
                  stroke={i%2===0 ? 'url(#clbrass)' : border}
                  strokeWidth={i%2===0 ? 0.022 : 0.012}
                  strokeOpacity={(i%2===0 ? 0.58 : 0.34)*fade}/>;
              })}
              {/* Sixteen small crown dots at the compass band — engraved beadwork */}
              {Array.from({length:16},(_,i)=>{
                const ang = (i/16)*Math.PI*2 + Math.PI/16;
                return <circle key={`cr-${i}`}
                  cx={cx+Math.cos(ang)*0.73} cy={cy+Math.sin(ang)*0.73}
                  r="0.020" fill="url(#clbrass)" fillOpacity={0.60*fade}/>;
              })}
              {/* Inner ring — the compass rose circle */}
              <circle cx={cx} cy={cy} r="0.62" fill="none" stroke="url(#clbrass)"
                strokeWidth="0.024" strokeOpacity={0.45*fade}/>
              {/* 8-point star polygon — richer fill, prominent gilt stroke */}
              <polygon points={starPoints(cx, cy, 0.52, 0.230, 8)}
                fill={solid} fillOpacity={0.38*fade}
                stroke="url(#clbevel)" strokeWidth="0.032" strokeOpacity={0.85*fade}/>
              {/* Star secondary rim — separates the fill from the ivory disc */}
              <polygon points={starPoints(cx, cy, 0.52, 0.230, 8)}
                fill="none"
                stroke={border} strokeWidth="0.012" strokeOpacity={0.30*fade}/>
              {/* Ivory disc — warm parchment inset that grounds the petals */}
              <circle cx={cx} cy={cy} r="0.33" fill="url(#clivory)" fillOpacity={0.98*fade}
                stroke="url(#clbrass)" strokeWidth="0.028" strokeOpacity={0.88*fade}/>
              {/* Ivory disc inner shadow — subtle recess read */}
              <circle cx={cx+0.04} cy={cy+0.05} r="0.29"
                fill="#6B4010" fillOpacity={0.06*fade}/>
              {/* Four petals (N/E/S/W) sitting on the ivory disc */}
              <ellipse cx={cx} cy={cy-0.164} rx={0.076} ry={0.152} fill={solid} fillOpacity={0.72*fade}/>
              <ellipse cx={cx} cy={cy+0.164} rx={0.076} ry={0.152} fill={solid} fillOpacity={0.72*fade}/>
              <ellipse cx={cx-0.164} cy={cy} rx={0.152} ry={0.076} fill={solid} fillOpacity={0.72*fade}/>
              <ellipse cx={cx+0.164} cy={cy} rx={0.152} ry={0.076} fill={solid} fillOpacity={0.72*fade}/>
              {/* Petal gilt edge catch-lights */}
              <ellipse cx={cx-0.010} cy={cy-0.166} rx={0.030} ry={0.060} fill="white" fillOpacity={0.30*fade}/>
              <ellipse cx={cx-0.010} cy={cy+0.162} rx={0.030} ry={0.060} fill="white" fillOpacity={0.22*fade}/>
              <ellipse cx={cx-0.166} cy={cy-0.010} rx={0.060} ry={0.030} fill="white" fillOpacity={0.30*fade}/>
              <ellipse cx={cx+0.162} cy={cy-0.010} rx={0.060} ry={0.030} fill="white" fillOpacity={0.22*fade}/>
              {/* Four diagonal accent studs — brass rivets completing the eight-point motif */}
              {[[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx3,sy3], i) => (
                <g key={`dd-${i}`}>
                  <circle cx={cx+sx3*0.172} cy={cy+sy3*0.172} r="0.038"
                    fill="url(#clbrass)" fillOpacity={0.70*fade}
                    stroke={border} strokeWidth="0.008" strokeOpacity={0.40*fade}/>
                  <circle cx={cx+sx3*0.162} cy={cy+sy3*0.162} r="0.014"
                    fill="white" fillOpacity={0.55*fade}/>
                </g>
              ))}
              {/* Centre jewel — deeper socket, larger dome, premium presence */}
              <circle cx={cx} cy={cy} r="0.134" fill={`url(#clsocket${player})`} fillOpacity={0.99*fade}
                stroke="url(#clbrass)" strokeWidth="0.026" strokeOpacity={0.92*fade}/>
              {/* Jewel facet ring — inner engraved cut */}
              <circle cx={cx} cy={cy} r="0.088"
                fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="0.009" strokeOpacity={fade}/>
              {/* Jewel primary specular */}
              <circle cx={cx-0.038} cy={cy-0.038} r="0.038" fill="white" fillOpacity={0.72*fade}/>
              {/* Hot-spot — the jewel dome peak catching direct light */}
              <circle cx={cx-0.022} cy={cy-0.022} r="0.018" fill="white" fillOpacity={0.94*fade}/>

              {/* Border */}
              <rect x={zc} y={zr} width="6" height="6" fill="none"
                stroke={border}
                strokeWidth={isCurrent ? 0.10 : 0.05}
                strokeOpacity={isCurrent ? 0.95 : exists ? 0.68 : 0.20}/>
            </g>
          );
        }

        return (
          <g key={`hz-${player}`}>

            {/* 0 · void base + atmospheric colour tint */}
            <rect x={zc} y={zr} width="6" height="6" fill="#03070e"/>
            <rect x={zc} y={zr} width="6" height="6"
              fill={`url(#hbg${player})`}
              fillOpacity={isCurrent ? 0.88 : exists ? 0.42 : 0.09}
            />

            {/* 1 · CRT scanline texture */}
            <rect x={zc} y={zr} width="6" height="6" fill="url(#cpscan)"/>

            {/* 2 · Neon floor grid */}
            {[1,2,3,4,5].map(n => (
              <g key={n}>
                <line x1={zc} y1={zr+n} x2={zc+6} y2={zr+n}
                  stroke={neon} strokeWidth="0.014" strokeOpacity={ao(0.16)}/>
                <line x1={zc+n} y1={zr} x2={zc+n} y2={zr+6}
                  stroke={neon} strokeWidth="0.014" strokeOpacity={ao(0.16)}/>
              </g>
            ))}

            {/* 3 · LED edge strips — top/bottom/sides */}
            <rect x={zc}      y={zr}      width="6"     height="0.062"
              fill={neon} fillOpacity={isCurrent ? 0.85 : exists ? 0.46 : 0.08}/>
            <rect x={zc}      y={zr+5.938} width="6"    height="0.062"
              fill={neon} fillOpacity={isCurrent ? 0.85 : exists ? 0.46 : 0.08}/>
            <rect x={zc}      y={zr}      width="0.062" height="6"
              fill={neon} fillOpacity={isCurrent ? 0.62 : exists ? 0.32 : 0.06}/>
            <rect x={zc+5.938} y={zr}     width="0.062" height="6"
              fill={neon} fillOpacity={isCurrent ? 0.62 : exists ? 0.32 : 0.06}/>

            {/* 4 · HUD corner brackets */}
            {([[zc,zr],[zc+6,zr],[zc+6,zr+6],[zc,zr+6]] as [number,number][]).map(([bx,by], i) => {
              const arm = 0.84;
              const sx2 = bx === zc ? 1 : -1;
              const sy2 = by === zr ? 1 : -1;
              return (
                <polyline key={i}
                  points={`${bx+sx2*arm},${by} ${bx},${by} ${bx},${by+sy2*arm}`}
                  fill="none" stroke={neon}
                  strokeWidth={isCurrent ? 0.092 : 0.058}
                  strokeOpacity={isCurrent ? 0.96 : exists ? 0.58 : 0.12}
                  strokeLinecap="square" strokeLinejoin="miter"
                />
              );
            })}

            {/* 5 · Diagonal dashed conduits: center reticle → each hex bay */}
            {E.HOME_BASES[player].map(([br, bc], si) => {
              const sx = bc+0.5, sy = br+0.5;
              const dx = cx-sx, dy = cy-sy;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const nx = dx/dist, ny = dy/dist;
              return (
                <line key={si}
                  x1={cx - nx*0.24} y1={cy - ny*0.24}
                  x2={sx + nx*0.44} y2={sy + ny*0.44}
                  stroke={neon} strokeWidth="0.020"
                  strokeOpacity={ao(0.52)}
                  strokeDasharray="0.088 0.058"
                />
              );
            })}

            {/* 6 · Scan sweep (active player) */}
            {isCurrent && (
              <motion.rect
                x={zc} width="6" height="0.18"
                fill={neon} fillOpacity="0.10"
                animate={{ y: [zr+0.07, zr+5.75] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.0 }}
              />
            )}

            {/* 7 · Hexagonal pawn bays */}
            {E.HOME_BASES[player].map(([br, bc], si) => {
              const sx = bc+0.5, sy = br+0.5;
              const HR = 0.385, HR2 = HR*0.60;
              const verts = [[0,-HR],[HR*0.866,-HR*0.5],[HR*0.866,HR*0.5],
                             [0,HR],[-HR*0.866,HR*0.5],[-HR*0.866,-HR*0.5]] as [number,number][];
              return (
                <g key={si}>
                  {/* Outer neon glow */}
                  <polygon points={hexStr(sx, sy, HR+0.065)}
                    fill={neon} fillOpacity={exists ? 0.065 : 0.010}
                  />
                  {/* Main hex frame */}
                  <polygon points={hexStr(sx, sy, HR)}
                    fill="#03070e" fillOpacity="0.94"
                    stroke={neon} strokeWidth="0.050"
                    strokeOpacity={isCurrent ? 0.97 : exists ? 0.60 : 0.12}
                  />
                  {/* Inner hex ring */}
                  <polygon points={hexStr(sx, sy, HR2)}
                    fill="none" stroke={neon} strokeWidth="0.016"
                    strokeOpacity={ao(0.28)}
                  />
                  {/* Vertex tick marks */}
                  {verts.map(([vx,vy], vi) => (
                    <line key={vi}
                      x1={sx+vx} y1={sy+vy}
                      x2={sx+vx*(1+0.075/HR)} y2={sy+vy*(1+0.075/HR)}
                      stroke={neon} strokeWidth="0.022"
                      strokeOpacity={exists ? 0.65 : 0.08}
                    />
                  ))}
                  {/* Crosshair */}
                  <line x1={sx-0.17} y1={sy} x2={sx+0.17} y2={sy}
                    stroke={neon} strokeWidth="0.018" strokeOpacity={ao(0.72)}/>
                  <line x1={sx} y1={sy-0.17} x2={sx} y2={sy+0.17}
                    stroke={neon} strokeWidth="0.018" strokeOpacity={ao(0.72)}/>
                  {/* Targeting circle */}
                  <circle cx={sx} cy={sy} r="0.10"
                    fill="none" stroke={neon} strokeWidth="0.014"
                    strokeOpacity={ao(0.55)}
                  />
                  {/* Home-impact neon flash — fires when a defeated piece arrives */}
                  {homeImpact?.player === player && homeImpact?.index === si && (
                    <motion.circle
                      key={homeImpact.id}
                      cx={sx} cy={sy}
                      r={HR + 0.09}
                      fill={neon}
                      style={{ transformOrigin: `${sx}px ${sy}px` }}
                      initial={{ scale: 1.55, fillOpacity: 0.80 }}
                      animate={{ scale: 1,    fillOpacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  )}
                </g>
              );
            })}

            {/* 8 · Center targeting reticle (4 L-bracket corners) */}
            {(() => {
              const arm = 0.36, gap = 0.13;
              const brackets: [number,number,number,number,number,number][] = [
                [cx-arm, cy-gap,  cx-arm, cy-arm,  cx-gap, cy-arm],
                [cx+arm, cy-gap,  cx+arm, cy-arm,  cx+gap, cy-arm],
                [cx-arm, cy+gap,  cx-arm, cy+arm,  cx-gap, cy+arm],
                [cx+arm, cy+gap,  cx+arm, cy+arm,  cx+gap, cy+arm],
              ];
              return brackets.map(([x1,y1,x2,y2,x3,y3], i) =>
                isCurrent ? (
                  <motion.polyline key={i}
                    points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                    fill="none" stroke={neon}
                    strokeWidth="0.056" strokeLinecap="square" strokeLinejoin="miter"
                    animate={{ strokeOpacity: [0.70, 1.0, 0.70] }}
                    transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : (
                  <polyline key={i}
                    points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
                    fill="none" stroke={neon}
                    strokeWidth="0.040" strokeLinecap="square" strokeLinejoin="miter"
                    strokeOpacity={exists ? 0.58 : 0.12}
                  />
                )
              );
            })()}

            {/* 9 · Outer neon border */}
            <rect x={zc} y={zr} width="6" height="6" fill="none"
              stroke={neon} strokeWidth={isCurrent ? 0.070 : 0.038}
              strokeOpacity={isCurrent ? 0.90 : exists ? 0.38 : 0.08}
            />

            {/* 10 · Player ID chip label */}
            {exists && (
              <text
                x={zc+0.20} y={zr + (player >= 2 ? 5.72 : 0.58)}
                fontSize="0.24" fontFamily="'Courier New', Courier, monospace"
                fill={neon} fillOpacity={isCurrent ? 0.90 : 0.44}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {['PLR-1','PLR-2','PLR-3','PLR-4'][player]}
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
        let fill    = isClassic ? '#FDF8E6' : isDz ? DZ.PATH_CREAM : '#0d1f38';
        let fillOp  = 1;
        let stroke  = isClassic ? 'rgba(110,68,10,0.34)' : isDz ? DZ.PATH_HAIRLINE : 'rgba(255,255,255,0.06)';
        let useGlow = false;

        if (cell.kind === 'homecol') {
          // Depth gradient: brighter toward center
          const depth = r === 7
            ? (player === 0 ? c - 1 : 13 - c)   // horizontal arms
            : (player === 1 ? r - 1 : 13 - r);   // vertical arms
          const t = Math.max(0, Math.min(1, depth / 5));
          fill    = isClassic ? CL_SOLID[player as 0|1|2|3] : isDz ? DZ.STRIP_COLORS[player as 0|1|2|3] : E.PLAYER_COLORS[player];
          fillOp  = game.playerSlots.includes(player)
            ? (isClassic || isDz ? 0.88 + t * 0.10 : 0.18 + t * 0.52)
            : (isClassic || isDz ? 0.18 : 0.04);
          stroke  = game.playerSlots.includes(player)
            ? (isClassic ? CL_BORDER[player as 0|1|2|3] : isDz ? DZ.BORDER_DEEP : E.PLAYER_NEONS[player])
            : 'transparent';
          useGlow = !isClassic && !isDz && game.playerSlots.includes(player) && t > 0.5;
        }
        // strip + path → remain the neutral dark fill defined above,
        // EXCEPT the 4 exit squares (below), which get their house tint.

        // Exit square (where pieces land leaving home) — premium neon tint
        // in the owning player's colour, layered on top of the base cell.
        const exitActive = isStart && player >= 0 && game.playerSlots.includes(player);

        const exitPlayerIdx = isStart ? (E.PLAYER_STARTS as readonly number[]).indexOf(pathPos as number) : -1;
        const starNeon = exitPlayerIdx >= 0
          ? E.PLAYER_NEONS[exitPlayerIdx]
          : 'rgba(255,255,255,0.82)';
        // Rotation so chevrons point in the exit direction: Red→right, Blue→down, Yellow→left, Green→up
        const exitRotDeg = [0, 90, 180, 270][exitPlayerIdx] ?? 0;

        return (
          <g key={`${r}-${c}`}>
            <rect x={c} y={r} width="1" height="1"
              fill={fill} fillOpacity={fillOp}
              stroke={stroke} strokeWidth="0.028"
              filter={useGlow ? 'url(#lane-glow)' : undefined}
            />
            {/* Classic: inner bevel — bright top/left catch-light, warm shadow bottom/right */}
            {isClassic && (
              <>
                <line x1={c+0.03} y1={r+0.03} x2={c+0.97} y2={r+0.03}
                  stroke="white" strokeWidth="0.022"
                  strokeOpacity={cell.kind === 'homecol' ? 0.28 : 0.50}/>
                <line x1={c+0.03} y1={r+0.04} x2={c+0.03} y2={r+0.97}
                  stroke="white" strokeWidth="0.022"
                  strokeOpacity={cell.kind === 'homecol' ? 0.20 : 0.36}/>
                <line x1={c+0.04} y1={r+0.97} x2={c+0.97} y2={r+0.97}
                  stroke="rgba(100,58,8,0.18)" strokeWidth="0.018"/>
                <line x1={c+0.97} y1={r+0.04} x2={c+0.97} y2={r+0.97}
                  stroke="rgba(100,58,8,0.18)" strokeWidth="0.018"/>
              </>
            )}
            {/* Classic homecol: diagonal top-light sheen — tonal depth per lane cell */}
            {isClassic && cell.kind === 'homecol' && (
              <rect x={c} y={r} width="1" height="1"
                fill="url(#cl-lane-sheen)" fillOpacity="0.85"
                pointerEvents="none"/>
            )}
            {/* Classic path cell: subtle warm vignette at bottom-right corner */}
            {isClassic && cell.kind === 'path' && (
              <rect x={c+0.50} y={r+0.50} width="0.50" height="0.50"
                fill="rgba(140,90,20,0.045)" pointerEvents="none"/>
            )}
            {/* Subtle glass sheen — neon mode only */}
            {!isClassic && !isDz && (
              <rect x={c+0.04} y={r+0.04} width="0.28" height="0.13" rx="0.05"
                fill="rgba(255,255,255,0.07)"/>
            )}

            {isStart && (
              <>
                {isClassic ? (
                  <>
                    {/* Classic: player-coloured tint + solid direction arrow */}
                    <rect x={c} y={r} width="1" height="1"
                      fill={player >= 0 ? CL_SOLID[player as 0|1|2|3] : 'transparent'}
                      fillOpacity={0.92}/>
                    <g transform={`rotate(${exitRotDeg}, ${c+0.5}, ${r+0.5})`}>
                      <path
                        d={`M ${c+0.30},${r+0.26} L ${c+0.54},${r+0.50} L ${c+0.30},${r+0.74}`}
                        fill="none"
                        stroke={player >= 0 ? CL_ARROW[player as 0|1|2|3] : 'rgba(80,50,10,0.70)'}
                        strokeWidth="0.078" strokeLinecap="round" strokeLinejoin="round"
                        strokeOpacity={0.90}
                      />
                    </g>
                  </>
                ) : isDz ? (
                  <>
                    {/* DZ: flat player-coloured tint, no arrow (Phase 1 — no decoration) */}
                    <rect x={c} y={r} width="1" height="1"
                      fill={player >= 0 ? DZ.HOME_COLORS[player as 0|1|2|3] : 'transparent'}
                      fillOpacity={0.88}/>
                  </>
                ) : (
                  <>
                    {/* House-coloured neon fill for the exit square */}
                    <rect x={c} y={r} width="1" height="1"
                      fill={`url(#exitcell${player})`}
                      fillOpacity={exitActive ? 0.62 : 0.14}
                      filter={exitActive ? `url(#pglow${player})` : undefined}
                    />
                    {/* Pulsing house-colour frame — reads instantly as "start here" */}
                    {exitActive && (
                      <motion.rect x={c+0.035} y={r+0.035} width="0.93" height="0.93" rx="0.06"
                        fill="none" stroke={E.PLAYER_NEONS[player]} strokeWidth="0.055"
                        animate={{ strokeOpacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    {/* Neon direction portal — double-chevron pointing in the exit direction */}
                    <g transform={`rotate(${exitRotDeg}, ${c+0.5}, ${r+0.5})`}>
                      <motion.path
                        d={`M ${c+0.28},${r+0.26} L ${c+0.48},${r+0.50} L ${c+0.28},${r+0.74}`}
                        fill="none" stroke={starNeon} strokeWidth="0.060" strokeLinecap="round" strokeLinejoin="round"
                        animate={{ strokeOpacity: [0.28, 0.55, 0.28] }}
                        transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                        filter="url(#star-glow)"
                      />
                      <motion.path
                        d={`M ${c+0.46},${r+0.26} L ${c+0.66},${r+0.50} L ${c+0.46},${r+0.74}`}
                        fill="none" stroke={starNeon} strokeWidth="0.060" strokeLinecap="round" strokeLinejoin="round"
                        animate={{ strokeOpacity: [0.65, 1.0, 0.65] }}
                        transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                        filter="url(#star-glow)"
                      />
                    </g>
                  </>
                )}
              </>
            )}

            {isStar && !isStart && (() => {
              if (isClassic) {
                return (
                  <g transform={`translate(${c},${r})`} filter="url(#cl-safe-glow)">
                    {/* Wide warm amber haze — warms the ivory cell before the star */}
                    <circle cx="0.5" cy="0.5" r="0.46"
                      fill="#FFB800" fillOpacity="0.14"/>
                    {/* Outer gilt ring — engraved compass band around the star */}
                    <circle cx="0.5" cy="0.5" r="0.435"
                      fill="none" stroke="url(#cl-star-ring)" strokeWidth="0.026" strokeOpacity="0.70"/>
                    {/* Stamped impression ring — the star is pressed into the ivory like a seal */}
                    <circle cx="0.5" cy="0.5" r="0.412"
                      fill="none" stroke="#8C6420" strokeWidth="0.014" strokeOpacity="0.32"/>
                    <circle cx="0.5" cy="0.5" r="0.388"
                      fill="none" stroke="rgba(184,134,59,0.22)" strokeWidth="0.008"/>
                    {/* Deep emboss — two-layer offset shadow for real pressed-metal depth */}
                    <polygon
                      points="0.500,0.185 0.574,0.395 0.800,0.400 0.624,0.535 0.690,0.750 0.500,0.618 0.310,0.750 0.376,0.535 0.200,0.400 0.426,0.395"
                      fill="#3A1E04" fillOpacity="0.20"
                      transform="translate(0.022,0.022)"/>
                    <polygon
                      points="0.500,0.185 0.574,0.395 0.800,0.400 0.624,0.535 0.690,0.750 0.500,0.618 0.310,0.750 0.376,0.535 0.200,0.400 0.426,0.395"
                      fill="#7A4C08" fillOpacity="0.28"
                      transform="translate(0.012,0.012)"/>
                    {/* Main star — rich gradient gold from cream highlight to deep amber */}
                    <polygon
                      points="0.500,0.185 0.574,0.395 0.800,0.400 0.624,0.535 0.690,0.750 0.500,0.618 0.310,0.750 0.376,0.535 0.200,0.400 0.426,0.395"
                      fill="url(#cl-safe-star)" fillOpacity="1.0"
                      stroke="#8C6010" strokeWidth="0.022" strokeOpacity="0.80"/>
                    {/* Gilt rim highlight — bright catch-light on top of the star stroke */}
                    <polygon
                      points="0.500,0.185 0.574,0.395 0.800,0.400 0.624,0.535 0.690,0.750 0.500,0.618 0.310,0.750 0.376,0.535 0.200,0.400 0.426,0.395"
                      fill="none"
                      stroke="url(#clbevel)" strokeWidth="0.010" strokeOpacity="0.60"/>
                    {/* Five tip accent dots — tiny brass studs at each outer star point */}
                    {([
                      [0.500,0.185],[0.800,0.400],[0.690,0.750],[0.310,0.750],[0.200,0.400]
                    ] as [number,number][]).map(([tx,ty],ti)=>(
                      <circle key={ti} cx={tx} cy={ty} r="0.024"
                        fill="url(#clbrass)" fillOpacity="0.92"
                        stroke="#5C3D14" strokeWidth="0.006" strokeOpacity="0.55"/>
                    ))}
                    {/* Faceted jewel dome at centre — slightly larger for presence */}
                    <circle cx="0.5" cy="0.5" r="0.092"
                      fill="url(#cl-star-jewel)"
                      stroke="#C8960C" strokeWidth="0.016" strokeOpacity="0.92"/>
                    {/* Jewel facet engraving — inner ring reads as a cut gem edge */}
                    <circle cx="0.5" cy="0.5" r="0.060"
                      fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="0.008"/>
                    {/* Jewel primary specular */}
                    <circle cx="0.468" cy="0.464" r="0.032" fill="white" fillOpacity="0.86"/>
                    {/* Jewel hot-spot — pin-point light at the dome peak */}
                    <circle cx="0.478" cy="0.474" r="0.014" fill="white" fillOpacity="0.98"/>
                  </g>
                );
              }
              if (isDz) {
                // Crescent-and-star safe-square marker — bold gold linework sized to
                // hold up at 1-cell scale, sitting on a soft warm radial glow. Star is
                // pushed clear of the crescent's horn tips so the two read as distinct
                // shapes instead of fusing into one gold blob at this small scale.
                const T = `translate(${c},${r})`;
                return (
                  <g transform={T}>
                    <circle cx="0.475" cy="0.5" r="0.42" fill="url(#dz-safe-glow-grad)"/>
                    <path fillRule="evenodd" fill={DZ.BORDER_GOLD}
                      d={crescentPath(0.36, 0.5, 0.28, 0.465, 0.5, 0.225)}/>
                    <polygon points={starPoints(0.80, 0.5, 0.135, 0.054, 5)} fill={DZ.BORDER_GOLD}/>
                  </g>
                );
              }
              const T = `translate(${c},${r})`;
              const seed = (r * 15 + c) * 0.06;
              return (
                // NOTE: static translate must live on a plain <g> ancestor — see
                // the comment above about Framer Motion overriding SVG transform attributes.
                <g transform={T} filter="url(#star-glow)">
                  {/* soft ambient halo */}
                  <motion.circle cx="0.5" cy="0.5" r="0.28"
                    fill="white" fillOpacity="0.10"
                    animate={{ opacity: [0.08, 0.22, 0.08] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: seed }}
                  />
                  {/* 5-pointed star — R=0.30, r=0.12, tip pointing up */}
                  <motion.polygon
                    points="0.500,0.200 0.571,0.403 0.785,0.407 0.614,0.537 0.676,0.743 0.500,0.620 0.324,0.743 0.386,0.537 0.215,0.407 0.429,0.403"
                    fill="white" fillOpacity="0.92"
                    animate={{ opacity: [0.78, 1, 0.78], scale: [0.93, 1.02, 0.93] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: seed }}
                    style={{ transformOrigin: '0.5px 0.5px' }}
                  />
                  {/* white-hot core */}
                  <circle cx="0.5" cy="0.5" r="0.055" fill="white" fillOpacity="0.95"/>
                </g>
              );
            })()}
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
      {/* DZ (Phase 1): flat gold field instead of 4 player-colored triangles. */}
      {!isDz && (
        <>
          <polygon points="6,6 9,6 7.5,7.5"
            fill={isClassic ? CL_SOLID[1] : E.PLAYER_COLORS[1]} opacity={game.playerSlots.includes(1) ? (isClassic ? 0.96 : 0.58) : (isClassic ? 0.28 : 0.14)}/>
          <polygon points="9,6 9,9 7.5,7.5"
            fill={isClassic ? CL_SOLID[2] : E.PLAYER_COLORS[2]} opacity={game.playerSlots.includes(2) ? (isClassic ? 0.96 : 0.58) : (isClassic ? 0.28 : 0.14)}/>
          <polygon points="9,9 6,9 7.5,7.5"
            fill={isClassic ? CL_SOLID[3] : E.PLAYER_COLORS[3]} opacity={game.playerSlots.includes(3) ? (isClassic ? 0.96 : 0.58) : (isClassic ? 0.28 : 0.14)}/>
          <polygon points="6,9 6,6 7.5,7.5"
            fill={isClassic ? CL_SOLID[0] : E.PLAYER_COLORS[0]} opacity={isClassic ? 0.96 : 0.58}/>
        </>
      )}
      {isDz && (
        <rect x="6" y="6" width="3" height="3" fill={DZ.CENTER_GOLD} fillOpacity="1"/>
      )}
      {/* Classic: glossy top-light sheens on all four center triangles */}
      {isClassic && (
        <>
          {/* Blue — top triangle: sheen along the top edge */}
          <polygon points="6,6 9,6 7.5,7.5" fill="white" opacity="0.16"/>
          {/* Yellow — right triangle: sheen along the right edge */}
          <polygon points="9,6 9,9 7.5,7.5" fill="white" opacity="0.10"/>
          {/* Green — bottom triangle: subtle floor reflection */}
          <polygon points="9,9 6,9 7.5,7.5" fill="white" opacity="0.08"/>
          {/* Red — left triangle: left-edge catch-light */}
          <polygon points="6,9 6,6 7.5,7.5" fill="white" opacity="0.12"/>
          {/* Inner shadow lines along each seam — pressed-edge depth between triangles */}
          <line x1="6" y1="6" x2="7.5" y2="7.5" stroke="rgba(0,0,0,0.18)" strokeWidth="0.040"/>
          <line x1="9" y1="6" x2="7.5" y2="7.5" stroke="rgba(0,0,0,0.18)" strokeWidth="0.040"/>
          <line x1="9" y1="9" x2="7.5" y2="7.5" stroke="rgba(0,0,0,0.18)" strokeWidth="0.040"/>
          <line x1="6" y1="9" x2="7.5" y2="7.5" stroke="rgba(0,0,0,0.18)" strokeWidth="0.040"/>
        </>
      )}
      {/* Center area border — gilt for Classic, subtle white for Neon, deep green for DZ */}
      <rect x="6" y="6" width="3" height="3" fill="none"
        stroke={isClassic ? 'url(#clbevel)' : isDz ? DZ.BORDER_DEEP : 'rgba(255,255,255,0.12)'}
        strokeWidth={isClassic ? 0.042 : isDz ? 0.050 : 0.055}
        strokeOpacity={isClassic ? 0.72 : isDz ? 0.85 : 1}/>
      {isDz ? (
        <>
          {/* Warm ambient bloom beneath the medallion — soft vignette on the gold field */}
          <circle cx="7.5" cy="7.5" r="1.00" fill={DZ.BORDER_DEEP} fillOpacity="0.12" filter="url(#dz-safe-glow)"/>
          {/* Outer rosette — two nested 12-point star-lattice rings, engraved deep green on gold.
                Hairline strokes and shallower points read as fine filigree, not a bold stamp. */}
          <polygon points={starPoints(7.5, 7.5, 1.12, 0.90, 12)}
            fill="none" stroke={DZ.BORDER_DEEP} strokeWidth="0.018" strokeOpacity="0.50"/>
          <polygon points={starPoints(7.5, 7.5, 0.86, 0.70, 12)}
            fill="none" stroke={DZ.BORDER_DEEP} strokeWidth="0.013" strokeOpacity="0.36"/>
          {/* Eight filigree spokes with star finials — compass points radiating outward */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const x1 = 7.5 + Math.cos(a) * 0.62, y1 = 7.5 + Math.sin(a) * 0.62;
            const x2 = 7.5 + Math.cos(a) * 0.95, y2 = 7.5 + Math.sin(a) * 0.95;
            return <line key={`dz-sp-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={DZ.BORDER_DEEP} strokeWidth="0.016" strokeOpacity="0.42"/>;
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const sx = 7.5 + Math.cos(a) * 0.95, sy = 7.5 + Math.sin(a) * 0.95;
            return <polygon key={`dz-fn-${i}`} points={starPoints(sx, sy, 0.058, 0.023, 4)}
              fill={DZ.BORDER_DEEP} fillOpacity="0.55"/>;
          })}
          {/* Medallion disc — deep green roundel framed in gold, the seat for the crown emblem */}
          <circle cx="7.5" cy="7.5" r="0.60" fill={DZ.BOARD_BG} stroke={DZ.BORDER_GOLD} strokeWidth="0.045" strokeOpacity="0.95"/>
          <circle cx="7.5" cy="7.5" r="0.52" fill="none" stroke={DZ.BORDER_GOLD} strokeWidth="0.016" strokeOpacity="0.55"/>
          {/* Prominent crescent-and-star — the crown of the board, gold on the green roundel.
                Star sits just clear of the crescent's horn tips (numerically verified gap) so
                the two read as distinct forms instead of fusing into one gold blob. */}
          <g filter="url(#dz-safe-glow)">
            <path fillRule="evenodd" fill={DZ.BORDER_GOLD}
              d={crescentPath(7.42, 7.5, 0.30, 7.555, 7.5, 0.235)}/>
            <polygon points={starPoints(7.80, 7.5, 0.095, 0.038, 5)} fill={DZ.BORDER_GOLD}/>
          </g>
        </>
      ) : isClassic ? (
        /* Classic: premium multi-layer focal star — the heart of the board */
        <>
          {/* Wide ambient warmth — two-layer gold corona: broad soft haze + tight bright bloom */}
          <circle cx="7.5" cy="7.5" r="2.10" fill="url(#cl-center-bloom)" fillOpacity="0.38"/>
          <circle cx="7.5" cy="7.5" r="1.30" fill="url(#cl-center-bloom)" fillOpacity="0.90"/>
          {/* Outer compass ring — engraved gilt band circling the star */}
          <circle cx="7.5" cy="7.5" r="0.84"
            fill="none" stroke="url(#clbevel)" strokeWidth="0.028" strokeOpacity="0.68"/>
          <circle cx="7.5" cy="7.5" r="0.80"
            fill="none" stroke="rgba(184,134,59,0.30)" strokeWidth="0.010"/>
          {/* Eight filigree spokes — radiate from inner ring to outer band */}
          {Array.from({length:8},(_,i)=>{
            const a = (i/8)*Math.PI*2 - Math.PI/2;
            return <line key={i}
              x1={7.5+Math.cos(a)*0.52} y1={7.5+Math.sin(a)*0.52}
              x2={7.5+Math.cos(a)*0.78} y2={7.5+Math.sin(a)*0.78}
              stroke="url(#clbrass)" strokeWidth="0.016" strokeOpacity="0.55"/>;
          })}
          {/* Eight tiny diamond finials at spoke tips */}
          {Array.from({length:8},(_,i)=>{
            const a = (i/8)*Math.PI*2 - Math.PI/2;
            const sx=7.5+Math.cos(a)*0.80, sy=7.5+Math.sin(a)*0.80;
            return <rect key={i} x={sx-0.034} y={sy-0.034} width="0.068" height="0.068"
              fill="url(#clbrass)" fillOpacity="0.80"
              transform={`rotate(45 ${sx} ${sy})`}/>;
          })}
          {/* Inner glory ring */}
          <circle cx="7.5" cy="7.5" r="0.52"
            fill="none" stroke="url(#clbrass)" strokeWidth="0.022" strokeOpacity="0.50"/>
          {/* Deep emboss — two offset shadow layers for genuine pressed-metal depth */}
          <polygon
            points="7.500,6.840 7.653,7.290 8.128,7.296 7.747,7.580 7.888,8.034 7.500,7.760 7.112,8.034 7.253,7.580 6.872,7.296 7.347,7.290"
            fill="#2E1400" fillOpacity="0.22"
            transform="translate(0.040,0.040)"/>
          <polygon
            points="7.500,6.840 7.653,7.290 8.128,7.296 7.747,7.580 7.888,8.034 7.500,7.760 7.112,8.034 7.253,7.580 6.872,7.296 7.347,7.290"
            fill="#6C3800" fillOpacity="0.30"
            transform="translate(0.022,0.022)"/>
          {/* Main star — deepened multi-stop gradient, full filter glow */}
          <polygon
            points="7.500,6.840 7.653,7.290 8.128,7.296 7.747,7.580 7.888,8.034 7.500,7.760 7.112,8.034 7.253,7.580 6.872,7.296 7.347,7.290"
            fill="url(#cl-center-star2)"
            filter="url(#cl-center-glow)"
            stroke="#8C5E10" strokeWidth="0.030" strokeOpacity="0.90"/>
          {/* Gilt rim highlight — bright top stroke over the dark edge */}
          <polygon
            points="7.500,6.840 7.653,7.290 8.128,7.296 7.747,7.580 7.888,8.034 7.500,7.760 7.112,8.034 7.253,7.580 6.872,7.296 7.347,7.290"
            fill="none"
            stroke="url(#clbevel)" strokeWidth="0.014" strokeOpacity="0.80"/>
          {/* Five outer tip accent studs — brass rivets at each star point */}
          {([
            [7.500,6.840],[8.128,7.296],[7.888,8.034],[7.112,8.034],[6.872,7.296]
          ] as [number,number][]).map(([tx,ty],ti)=>(
            <circle key={ti} cx={tx} cy={ty} r="0.034"
              fill="url(#clbrass)" fillOpacity="0.94"
              stroke="#4E2A08" strokeWidth="0.008" strokeOpacity="0.60"/>
          ))}
          {/* Center ivory mounting disc */}
          <circle cx="7.5" cy="7.5" r="0.182"
            fill="url(#clivory)" fillOpacity="0.99"
            stroke="url(#clbrass)" strokeWidth="0.030" strokeOpacity="0.95"/>
          {/* Jewel dome — faceted gem, largest and richest on the board */}
          <circle cx="7.5" cy="7.5" r="0.128"
            fill="url(#cl-star-jewel)"
            stroke="#C09020" strokeWidth="0.020" strokeOpacity="0.96"/>
          {/* Jewel facet ring — engraved inner edge, reads as a cut gem */}
          <circle cx="7.5" cy="7.5" r="0.084"
            fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="0.011"/>
          {/* Jewel primary specular */}
          <circle cx="7.458" cy="7.455" r="0.046" fill="white" fillOpacity="0.90"/>
          {/* Jewel micro hotspot — pin-point peak brilliance */}
          <circle cx="7.470" cy="7.466" r="0.020" fill="white" fillOpacity="0.99"/>
        </>
      ) : (
        /* Neon: white glow dot */
        <circle cx="7.5" cy="7.5" r="0.52" fill="white" opacity="0.16"/>
      )}

      {/* ── DZ: zellige-tile overlay — drawn after every cell so the faint engraved-floor
            texture actually reads across path, home and center tiles, not just bare felt ── */}
      {isDz && (
        <rect width="15" height="15" fill="url(#dz-zellige)" fillOpacity="0.05" pointerEvents="none"/>
      )}

      {/* ── Board border ── */}
      {isDz ? (
        <>
          {/* Deep green outer frame — flat, no ornaments (Phase 1) */}
          <rect x="0.08" y="0.08" width="14.84" height="14.84"
            fill="none" rx="0.10" stroke={DZ.BORDER_DEEP} strokeWidth="0.14" strokeOpacity="1"/>
          {/* Thin gold accent line just inside the frame */}
          <rect x="0.26" y="0.26" width="14.48" height="14.48"
            fill="none" rx="0.07" stroke={DZ.BORDER_GOLD} strokeWidth="0.030" strokeOpacity="0.85"/>
        </>
      ) : isClassic ? (
        <>
          {/* Inner gilt accent line — warm gleam just inside the dark frame */}
          <rect x="0.26" y="0.26" width="14.48" height="14.48"
            fill="none" rx="0.07" stroke="url(#cl-frame-gilt)" strokeWidth="0.030" strokeOpacity="0.62"/>
          {/* Outer dark frame — heavy border that grounds the entire board */}
          <rect x="0.08" y="0.08" width="14.84" height="14.84"
            fill="none" rx="0.10" stroke="rgba(28,32,72,0.75)" strokeWidth="0.14" strokeOpacity="1"/>
          {/* Four corner diamond ornaments — brass rivets at the frame corners */}
          {([[0.26,0.26],[14.74,0.26],[14.74,14.74],[0.26,14.74]] as [number,number][]).map(([ox,oy],i)=>(
            <g key={i}>
              <rect x={ox-0.072} y={oy-0.072} width="0.144" height="0.144"
                fill="url(#clbrass)" fillOpacity="0.85"
                transform={`rotate(45 ${ox} ${oy})`}/>
              <circle cx={ox} cy={oy} r="0.030"
                fill="white" fillOpacity="0.55"/>
            </g>
          ))}
        </>
      ) : (
        <motion.rect x="0.05" y="0.05" width="14.90" height="14.90"
          fill="none" rx="0.20"
          animate={{
            stroke: activeNeon,
            strokeOpacity: [0.40, 0.78, 0.40],
            strokeWidth:   [0.08, 0.12, 0.08],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* ── Shockwave burst — rendered above board, below pieces ── */}
      {shockwave && (
        <ShockwaveEffect
          key={shockwave.id}
          x={shockwave.x}
          y={shockwave.y}
          neon={shockwave.neon}
          onDone={onShockwaveDone}
        />
      )}

      {/* ── Home finish VFX — neon burst when a pawn reaches center ── */}
      {homeFinishVFX && (
        <HomeFinishVFX
          key={homeFinishVFX.id}
          x={homeFinishVFX.x}
          y={homeFinishVFX.y}
          neon={homeFinishVFX.neon}
          onDone={onHomeFinishDone}
        />
      )}

      {/* ── Pieces ── each PawnToken manages its own dual-control animation ── */}
      {piecePositions.map(({ player, index, xy: [fx, fy] }) => {
        const pid  = E.pieceId(player, index);
        const anim = pieceAnims[pid] ?? { steps: null };
        return (
          <PawnToken
            key={pid}
            pid={pid}
            player={player}
            finalX={fx}
            finalY={fy}
            startX={anim.startX}
            startY={anim.startY}
            hopSteps={anim.steps}
            hopMs={hopMs}
            springCfg={springCfg}
            isMovable={game.movable.includes(pid)}
            onPieceClick={() => onPieceClick(pid)}
            onLastHopLand={anim.onLastHop}
            onDefeatArrived={anim.onArrival}
            isClassic={isClassic}
            isDz={isDz}
          />
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
export function GameBoardScreen({ config, lang, boardStyle, onBack }: Props) {
  const playerSlots = config.players === 2 ? [0, 2] : Array.from({ length: config.players }, (_, i) => i);
  const [game, setGame]             = useState<E.GameState>(() => E.createGame(config.players, config.rule === 'quick' ? 2 : 4, playerSlots));
  const [rolling, setRolling]       = useState(false);
  const [animDice, setAnimDice]     = useState(1);
  const [justLanded, setJustLanded] = useState(false);
  const [lastDice, setLastDice]     = useState<number[]>([0, 0, 0, 0]);
  const [animSpeed, setAnimSpeed]   = useState<AnimSpeed>('normal');
  const [showSettings, setShowSettings] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const rollTimers = useRef<NodeJS.Timeout[]>([]);

  // ── Animation queue state (owned here, threaded down to BoardSVG) ─────────
  const [isAnimating,   setIsAnimating]   = useState(false);
  const [pieceAnims,    setPieceAnims]    = useState<Record<string, PieceAnim>>({});
  const [shockwave,     setShockwave]     = useState<ShockwaveEvent | null>(null);
  const [homeImpact,    setHomeImpact]    = useState<HomeImpactEvent | null>(null);
  const [homeFinishVFX, setHomeFinishVFX] = useState<ShockwaveEvent | null>(null);

  // Stable refs so triggerMove closures always see the latest values
  // without needing to be recreated on every render.
  const gameRef        = useRef(game);
  const isAnimatingRef = useRef(isAnimating);
  gameRef.current        = game;
  isAnimatingRef.current = isAnimating;

  const isComputer  = config.modeId === 'computer';
  const isClassic   = boardStyle === 'classic';
  const isDz        = boardStyle === 'dz';
  const activeNeon  = E.PLAYER_NEONS[game.activePlayer];
  const activeColor = E.PLAYER_COLORS[game.activePlayer];
  const isHumanTurn = !isComputer || game.activePlayer === 0;
  const canRoll     = isHumanTurn && game.phase === 'rolling' && !rolling && !game.winner;
  const cfg         = ANIM[animSpeed];
  const springCfg   = { stiffness: cfg.stiffness, damping: cfg.damping, mass: cfg.mass };

  // ── Panel layout — proportionally scaled to actual board width ──────────────
  // Board width ≈ 100vw − 2×BOARD_MARGIN. Reference point: 362 px board (390 px
  // phone). Clamped to ±15 % so panels never look oversized or tiny.
  const panelLayout = useMemo<PanelLayout>(() => {
    const vw    = typeof window !== 'undefined' ? window.innerWidth : 390;
    const boardW = Math.max(300, vw - 2 * BOARD_MARGIN);
    const scale  = Math.min(1.15, Math.max(0.88, boardW / 362));
    return {
      panelW:     Math.round(PANEL_W     * scale),
      panelH:     Math.round(PANEL_H     * scale),
      panelGap:   Math.round(PANEL_GAP   * scale),
      panelInset: Math.round(PANEL_INSET * scale),
      tailW:      Math.round(TAIL_W      * scale),
      tailH:      Math.round(TAIL_H      * scale),
      tailGap:    Math.round(TAIL_GAP    * scale),
    };
  }, []); // computed once at mount — viewport is stable during a game session

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

  // ── triggerMove — async-safe, decoupled animation from state resolution ──
  // Uses refs for game/isAnimating so it is stable (no deps) and never stale.
  const triggerMove = useCallback((pid: string) => {
    // Fix: set the ref synchronously FIRST (atomic lock) to prevent a second
    // rapid click from entering before the React state update has rendered.
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const currentGame = gameRef.current;
    if (!currentGame.movable.includes(pid)) {
      isAnimatingRef.current = false;
      return;
    }

    // Pre-compute the logical outcome WITHOUT applying it to React state yet.
    // Game state is only committed once the captor's last animation step lands.
    const nextState = E.doMove(currentGame, pid);

    const [ps, is] = pid.split(':').map(Number);
    const piece    = currentGame.pieces.find(p => p.player === ps && p.index === is)!;
    const pFrom    = piece.relPos;
    const pTo      = nextState.pieces.find(p => p.player === ps && p.index === is)!.relPos;

    // Build the corner-smoothed hop path
    const steps = buildHopPath(ps, is, pFrom, pTo);

    // Seed startX/startY from the actual rendered position (getPieceXY) so that
    // stacking offsets are reflected — avoids off-lane axis-diff on first step.
    const [startX, startY] = getPieceXY(piece, currentGame.pieces);

    // Find which piece (if any) is captured in this move
    const capturedP = currentGame.pieces.find(p => {
      if (p.player === ps || p.relPos < 1 || p.relPos >= E.TRACK_SIZE) return false;
      const np = nextState.pieces.find(q => q.player === p.player && q.index === p.index);
      return np?.relPos === -1;
    }) ?? null;
    const capturedPid = capturedP ? E.pieceId(capturedP.player, capturedP.index) : null;

    const captorNeon   = E.PLAYER_NEONS[ps];
    const lastStep     = steps.length > 0 ? steps[steps.length - 1] : null;
    const isHomeFinish = pTo === E.FINISHED_POS;

    // Fix: handle zero-step edge case (piece already at destination, e.g. relPos=0
    // on a 6-roll from base). Apply state immediately and unlock — no animation needed.
    if (steps.length === 0) {
      if (capturedPid && lastStep) {
        setShockwave({ x: lastStep.x, y: lastStep.y, neon: captorNeon, id: Date.now() });
      }
      if (isHomeFinish) {
        setHomeFinishVFX({ x: 7.5, y: 7.5, neon: captorNeon, id: Date.now() });
      }
      setGame(nextState);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      return;
    }

    setIsAnimating(true);

    // onLastHop fires when the captor's FINAL step physically lands on the tile.
    // This is the earliest safe moment to resolve captures and pass the turn.
    const onLastHop = () => {
      // Trigger shockwave / home-finish VFX at the landing tile
      if (capturedPid && lastStep) {
        setShockwave({ x: lastStep.x, y: lastStep.y, neon: captorNeon, id: Date.now() });
      }
      if (isHomeFinish) {
        setHomeFinishVFX({ x: 7.5, y: 7.5, neon: captorNeon, id: Date.now() });
      }

      // NOW commit logical game state: captured piece's relPos → -1,
      // finalXY resolves to its home base, turn advances, etc.
      setGame(nextState);

      if (capturedPid && capturedP) {
        const cp = capturedP;
        // Start defeat arc — captured piece now knows finalXY = home base
        // because game state was just updated with relPos = -1.
        setPieceAnims(prev => ({
          ...prev,
          [capturedPid]: {
            steps: 'defeat',
            onArrival: () => {
              setHomeImpact({ player: cp.player, index: cp.index, id: Date.now() });
              setTimeout(() => setHomeImpact(null), 750);
              setIsAnimating(false);
              isAnimatingRef.current = false;
              setPieceAnims({});
            },
          },
        }));
      } else {
        // No capture — animation sequence is complete
        setIsAnimating(false);
        isAnimatingRef.current = false;
        setPieceAnims({});
      }
    };

    // Set initial animation state:
    // • Moving piece: hop sequence with actual rendered start position for axis-diff
    // • Captured piece (if any): null steps → holds at current visual tile
    //   (game state hasn't changed yet so getPieceXY returns its track position)
    // • Everyone else: null (spring-to-current, effectively a no-op)
    const initAnims: Record<string, PieceAnim> = {};
    currentGame.pieces.forEach(p => {
      initAnims[E.pieceId(p.player, p.index)] = { steps: null };
    });
    initAnims[pid] = { steps, startX, startY, onLastHop };
    // Do NOT set capturedPid to 'defeat' here — it waits for onLastHop
    setPieceAnims(initAnims);
  }, []); // stable — reads game/isAnimating via refs

  // ── Piece click ───────────────────────────────────────────────────────────
  // Non-movable pawns no longer swallow the tap — their onClick now calls here
  // too. When the tapped piece isn't movable, we look up its grid cell and
  // redirect to the first movable pawn on that same cell (current player's
  // piece stacked with opponents). If none, the tap is a no-op.
  const handlePieceClick = useCallback((pid: string) => {
    if (!isHumanTurn || isAnimatingRef.current) return;
    const currentGame = gameRef.current;

    // Fast path: piece is already movable — move it directly.
    if (currentGame.movable.includes(pid)) {
      triggerMove(pid);
      return;
    }

    // Redirect: find a movable pawn that shares the same board cell.
    if (currentGame.phase !== 'selecting' || !currentGame.movable.length) return;
    const [ps, is] = pid.split(':').map(Number);
    const tapped = currentGame.pieces.find(p => p.player === ps && p.index === is);
    if (!tapped || tapped.relPos < 0 || tapped.relPos === E.FINISHED_POS) return;
    const tappedGp = E.getGridPos(tapped.player, tapped.relPos);
    if (!tappedGp) return;

    const redirect = currentGame.movable.find(mpid => {
      const [mp, mi] = mpid.split(':').map(Number);
      const mpiece = currentGame.pieces.find(p => p.player === mp && p.index === mi);
      if (!mpiece || mpiece.relPos < 0) return false;
      const mgp = E.getGridPos(mpiece.player, mpiece.relPos);
      return mgp && mgp[0] === tappedGp[0] && mgp[1] === tappedGp[1];
    });
    if (redirect) triggerMove(redirect);
  }, [isHumanTurn, triggerMove]);

  // ── Auto-pass when no valid moves — blocked while animation is in flight ─
  useEffect(() => {
    if (game.phase !== 'selecting' || game.movable.length > 0 || game.winner || isAnimating) return;
    const t = setTimeout(() => setGame(E.autoPassTurn), 1080);
    return () => clearTimeout(t);
  }, [game.phase, game.movable.length, game.winner, isAnimating]);

  // ── AI roll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'rolling' || rolling || game.winner) return;
    const t = setTimeout(handleRoll, 620 + Math.random() * 320);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, rolling, game.winner, handleRoll]);

  // ── AI move — blocked while animation is in flight ────────────────────────
  useEffect(() => {
    if (!isComputer || game.activePlayer === 0) return;
    if (game.phase !== 'selecting' || !game.movable.length || game.winner || isAnimating) return;
    const pid = E.aiPickMove(game);
    if (!pid) return;
    const t = setTimeout(() => triggerMove(pid), 480);
    return () => clearTimeout(t);
  }, [isComputer, game.activePlayer, game.phase, game.movable.length, game.winner, isAnimating, triggerMove]);

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
    setIsAnimating(false);
    setPieceAnims({});
    setShockwave(null);
    setHomeImpact(null);
    setHomeFinishVFX(null);
    setGame(E.createGame(config.players, config.rule === 'quick' ? 2 : 4, playerSlots));
    setRestartKey(k => k + 1);
  }, [config.players, config.rule]);

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
      style={{ background: isClassic
        ? [
            // Cinematic vignette — edges fall to deep purple, centre stays warm
            'radial-gradient(ellipse 105% 105% at 50% 50%, transparent 42%, rgba(8,3,18,0.72) 100%)',
            // Gold stardust — sparse tiny glints at very low opacity
            'radial-gradient(circle at 12% 22%, rgba(255,220,100,0.10) 0px, transparent 1.5px)',
            'radial-gradient(circle at 80% 15%, rgba(255,220,100,0.08) 0px, transparent 1px)',
            'radial-gradient(circle at 44% 75%, rgba(255,220,100,0.09) 0px, transparent 1.5px)',
            'radial-gradient(circle at 90% 68%, rgba(255,220,100,0.07) 0px, transparent 1px)',
            'radial-gradient(circle at 28% 90%, rgba(255,220,100,0.08) 0px, transparent 1.5px)',
            'radial-gradient(circle at 67% 38%, rgba(255,220,100,0.06) 0px, transparent 1px)',
            'radial-gradient(circle at 55% 8%,  rgba(255,220,100,0.07) 0px, transparent 1.5px)',
            // Warm golden spotlight — soft ellipse behind the board like a light from above
            'radial-gradient(ellipse 56% 50% at 50% 52%, rgba(255,200,60,0.065) 0%, transparent 72%)',
            // Diamond grid — slightly more visible for premium texture
            'repeating-linear-gradient(45deg,  rgba(201,162,39,0.10) 0px, rgba(201,162,39,0.10) 1px, transparent 1px, transparent 32px)',
            'repeating-linear-gradient(-45deg, rgba(201,162,39,0.10) 0px, rgba(201,162,39,0.10) 1px, transparent 1px, transparent 32px)',
            // Purple base
            'radial-gradient(ellipse 90% 70% at 50% 42%, #3d2566 0%, #2d1b4e 45%, #1a0f30 100%)',
          ].join(', ')
        : isDz
        ? [
            // Warm gold spotlight — soft focus glow centred behind the board
            'radial-gradient(ellipse 58% 50% at 50% 50%, rgba(201,162,39,0.14) 0%, rgba(201,162,39,0.06) 42%, transparent 74%)',
            // Corner colour blooms — echo each player's home colour where their dice
            // card floats, so the card doesn't land on a flat, unrelated backdrop
            'radial-gradient(ellipse 34% 26% at 13% 15%, rgba(212,160,23,0.10) 0%, transparent 75%)',  // TL — saffron gold
            'radial-gradient(ellipse 34% 26% at 87% 15%, rgba(0,105,148,0.12) 0%, transparent 75%)',   // TR — Mediterranean blue
            'radial-gradient(ellipse 34% 26% at 87% 87%, rgba(194,112,58,0.12) 0%, transparent 75%)',  // BR — Saharan terracotta
            'radial-gradient(ellipse 34% 26% at 13% 87%, rgba(245,230,200,0.08) 0%, transparent 75%)', // BL — ivory cream
            // Najma star-lattice echo — same diamond-trellis technique as the Classic
            // texture below, re-themed in gold and kept whisper-faint so it reads as
            // the zellige floor pattern bleeding softly into the shadows
            'repeating-linear-gradient(45deg,  rgba(201,162,39,0.045) 0px, rgba(201,162,39,0.045) 1px, transparent 1px, transparent 38px)',
            'repeating-linear-gradient(-45deg, rgba(201,162,39,0.045) 0px, rgba(201,162,39,0.045) 1px, transparent 1px, transparent 38px)',
            // Deep vignette — edges recede so focus stays on the board
            'radial-gradient(ellipse 100% 100% at 50% 48%, transparent 38%, rgba(0,8,5,0.55) 100%)',
            // Deep emerald-black base — a darker, richer relative of the board's own green
            'radial-gradient(ellipse 95% 80% at 50% 40%, #0c3120 0%, #06210f 48%, #02100a 100%)',
          ].join(', ')
        : 'linear-gradient(175deg, #060f1d 0%, #09152a 55%, #050d18 100%)' }}
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

      {/* ── Header — back far-left, settings far-right, 44 px touch targets ── */}
      <div className="relative z-10 flex-shrink-0 flex items-center gap-2 px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
          paddingBottom: 8,
        }}>
        {/* Back — far left */}
        <motion.button onClick={onBack}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ArrowLeft className="w-4 h-4 text-white"
            style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}/>
        </motion.button>

        {/* Spacer — turn communicated via card elevation at the corners */}
        <div style={{ flex: 1 }}/>

        {/* Settings — far right */}
        <motion.button onClick={() => setShowSettings(true)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.91 }}
          className="flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Settings className="w-4 h-4 text-white/50"/>
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
          paddingTop:    panelLayout.panelH + panelLayout.panelGap + 4,
          paddingBottom: panelLayout.panelH + panelLayout.panelGap + 4,
          paddingLeft:   BOARD_MARGIN,
          paddingRight:  BOARD_MARGIN,
        }}>
        <motion.div
          style={{
            position: 'relative',
            // min() ensures the board is always square and never overflows:
            // width-constrained on portrait phones, height-constrained on short screens.
            width: `min(calc(100vw - ${2 * BOARD_MARGIN}px), calc(100dvh - 270px))`,
            aspectRatio: '1',
            boxSizing: 'border-box',
            borderRadius: 22,
            overflow: 'visible',
            padding: '6px',
            background: (isClassic || isDz)
              ? 'transparent'
              : 'radial-gradient(ellipse 120% 100% at 50% 50%, #0e2647 0%, #030b16 70%)',
            border: (isClassic || isDz) ? 'none' : '1px solid rgba(255,255,255,0.07)',
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
            boxShadow: (isClassic || isDz)
              ? 'inset 0 6px 32px rgba(0,0,0,0.78), inset 0 0 80px rgba(0,0,0,0.48)'
              : 'inset 0 4px 20px rgba(0,0,0,0.60), inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}>
            <BoardSVG
              game={game}
              onPieceClick={handlePieceClick}
              springCfg={springCfg}
              hopMs={cfg.hopMs}
              pieceAnims={pieceAnims}
              shockwave={shockwave}
              onShockwaveDone={() => setShockwave(null)}
              homeImpact={homeImpact}
              homeFinishVFX={homeFinishVFX}
              onHomeFinishDone={() => setHomeFinishVFX(null)}
              boardStyle={boardStyle}
            />
          </div>

          {/* ── Corner dice panels — outside the board, adjacent to each corner ── */}
          {/* Red   → top-left    (player 0) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={0} anchor="tl" isAI={false} boardStyle={boardStyle} panelLayout={panelLayout}/>
          {/* Blue  → top-right   (player 1) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={1} anchor="tr" isAI={isComputer} boardStyle={boardStyle} panelLayout={panelLayout}/>
          {/* Yellow → bottom-right (player 2) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={2} anchor="br" isAI={isComputer} boardStyle={boardStyle} panelLayout={panelLayout}/>
          {/* Green  → bottom-left  (player 3) */}
          <CornerDice {...{ game, lang, rolling, animDice, justLanded, lastDice, onRoll: handleRoll, canRoll }}
            player={3} anchor="bl" isAI={isComputer} boardStyle={boardStyle} panelLayout={panelLayout}/>
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
