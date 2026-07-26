// ─── Ludo Engine ─────────────────────────────────────────────────────────────
// Pure game logic: state, moves, AI. No React/DOM dependencies.

export const MAIN_PATH_SIZE = 52; // physical length of MAIN_PATH (used for abs modulo)
export const TRACK_SIZE    = 51; // home-entry threshold: relPos 51+ → HOME_COLS
export const HOME_COL_SIZE = 6;
export const FINISHED_POS  = TRACK_SIZE + HOME_COL_SIZE; // 57

// ── Board path (52 cells, clockwise from Red's start) ──────────────────────
//    Row = grid row (0-14)   Col = grid column (0-14)
export const MAIN_PATH: readonly [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],             // 0–4   Red strip
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],       // 5–10
  [0,7],                                      // 11  ← star
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],       // 12–17 Blue strip
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],  // 18–23
  [7,14],                                     // 24  ← star
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],  // 25–30 Yellow strip
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],  // 31–36
  [14,7],                                     // 37  ← star
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],  // 38–43 Green strip
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],       // 44–49
  [7,0],                                      // 50  ← star
  [6,0],                                      // 51
];

// ── Home columns (6 cells each, from entry toward center) ──────────────────
export const HOME_COLS: readonly (readonly [number, number][])[] = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],      // Red   → right
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],      // Blue  → down
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],  // Yellow← left
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],  // Green ↑ up
];

// ── Piece spawn positions inside each corner home zone ─────────────────────
// Aligned to path start positions:
//   Red    starts at MAIN_PATH[0]=[6,1]   → TOP-LEFT  zone (rows 0-5, cols 0-5)
//   Blue   starts at MAIN_PATH[13]=[1,8]  → TOP-RIGHT zone (rows 0-5, cols 9-14)
//   Yellow starts at MAIN_PATH[26]=[8,13] → BOT-RIGHT zone (rows 9-14,cols 9-14)
//   Green  starts at MAIN_PATH[39]=[13,6] → BOT-LEFT  zone (rows 9-14,cols 0-5)
// Slots ±1.5 SVG units from zone centre for perfect symmetry.
export const HOME_BASES: readonly (readonly [number, number][])[] = [
  [[1,1],[1,4],[4,1],[4,4]],         // Red    — TOP-LEFT  (rows 0-5,  cols 0-5)
  [[1,10],[1,13],[4,10],[4,13]],     // Blue   — TOP-RIGHT (rows 0-5,  cols 9-14)
  [[10,10],[10,13],[13,10],[13,13]], // Yellow — BOT-RIGHT (rows 9-14, cols 9-14)
  [[10,1],[10,4],[13,1],[13,4]],     // Green  — BOT-LEFT  (rows 9-14, cols 0-5)
];

// ── Player starts (absolute track index) ───────────────────────────────────
// Each start is the absolute MAIN_PATH index a piece enters when a 6 is rolled.
// relPos 0  → colored spawn square (MAIN_PATH[start]).
// relPos 50 → ★ star tile axis-aligned to HOME_COLS[p][0] (clean straight entry).
// relPos 51 → piece turns into the home column (TRACK_SIZE = 51).
export const PLAYER_STARTS = [0, 13, 26, 39] as const;

// ── Safe squares (absolute track index) ───────────────────────────────────
// Safe squares = player-start tiles (0,13,26,39) + 4 mid-path stars (11,24,37,50)
export const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ── Visual constants ───────────────────────────────────────────────────────
export const PLAYER_COLORS  = ['#DC143C','#1E90FF','#FFD700','#00C060'] as const;
export const PLAYER_NEONS   = ['#FF3366','#4DBBFF','#FFE040','#00FF88'] as const;
export const PLAYER_NAMES_FR = ['Rouge','Bleu','Jaune','Vert']          as const;
export const PLAYER_NAMES_AR = ['أحمر','أزرق','أصفر','أخضر']           as const;

// ── Types ──────────────────────────────────────────────────────────────────
export interface Piece {
  player: number;
  index:  number;
  relPos: number; // -1=home base, 0-50=track, 51-56=home col, 57=finished
}

export interface GameState {
  pieces:          Piece[];
  activePlayer:    number;
  numPlayers:      number;
  playerSlots:     readonly number[]; // turn-order list of active color indices (e.g. [0,2] for diagonal 2-player)
  dice:            number;
  diceRolled:      boolean;
  winner:          number | null;
  phase:           'rolling' | 'selecting' | 'done';
  movable:         string[];
  consecutiveSixes: number;
  lastCapture:     boolean;
  message:         string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function pieceId(player: number, index: number): string {
  return `${player}:${index}`;
}

export function getGridPos(player: number, relPos: number): [number, number] | null {
  if (relPos < 0) return null;
  if (relPos < TRACK_SIZE) {
    const abs = (PLAYER_STARTS[player] + relPos) % MAIN_PATH_SIZE;
    return MAIN_PATH[abs] as [number, number];
  }
  if (relPos < FINISHED_POS) {
    return HOME_COLS[player][relPos - TRACK_SIZE] as [number, number];
  }
  return null; // finished → center
}

function calcMovable(pieces: Piece[], player: number, dice: number): string[] {
  return pieces
    .filter(p => p.player === player && p.relPos !== FINISHED_POS)
    .filter(p => p.relPos === -1 ? dice === 6 : p.relPos + dice <= FINISHED_POS)
    .map(p => pieceId(p.player, p.index));
}

function nextPlayer(pieces: Piece[], current: number, slots: readonly number[]): number {
  const idx = slots.indexOf(current);
  for (let i = 1; i < slots.length; i++) {
    const next = slots[(idx + i) % slots.length];
    if (!pieces.filter(p => p.player === next).every(p => p.relPos === FINISHED_POS)) {
      return next;
    }
  }
  return current;
}

// ── Game lifecycle ─────────────────────────────────────────────────────────
export function createGame(numPlayers: number, pawnsPerPlayer = 4, playerSlots?: readonly number[]): GameState {
  const slots = playerSlots ?? Array.from({ length: numPlayers }, (_, i) => i);
  const pieces: Piece[] = [];
  for (let p = 0; p < numPlayers; p++) {
    for (let i = 0; i < pawnsPerPlayer; i++) pieces.push({ player: slots[p], index: i, relPos: -1 });
  }
  return {
    pieces, activePlayer: slots[0], numPlayers,
    playerSlots: slots,
    dice: 0, diceRolled: false, winner: null,
    phase: 'rolling', movable: [],
    consecutiveSixes: 0, lastCapture: false, message: '',
  };
}

// ─── Weighted roll — early-game assist ────────────────────────────────────────
// Used only when ALL of a player's pawns are still at home (relPos === -1),
// meaning the player has not yet released a single pawn. Weights 6 at 3×
// relative to each other face, giving P(6) ≈ 37.5% vs the normal 16.7%.
// Faces 1–5 each land with P ≈ 12.5%. Looks identical to a normal roll.
function weightedSixRoll(): number {
  // Total weight = 3 (six) + 1+1+1+1+1 (faces 1-5) = 8
  const r = Math.random() * 8;
  if (r < 3) return 6;
  return Math.floor(r - 3) + 1; // [3,4)→1, [4,5)→2, [5,6)→3, [6,7)→4, [7,8)→5
}

export function doRoll(state: GameState): GameState {
  if (state.diceRolled || state.phase !== 'rolling') return state;
  const allHome = state.pieces
    .filter(p => p.player === state.activePlayer)
    .every(p => p.relPos === -1);
  const dice    = allHome ? weightedSixRoll() : Math.floor(Math.random() * 6) + 1;
  const movable = calcMovable(state.pieces, state.activePlayer, dice);
  const sixs    = dice === 6 ? state.consecutiveSixes + 1 : 0;
  const message = movable.length === 0 ? 'Aucun mouvement possible' : '';
  return { ...state, dice, diceRolled: true, movable, phase: 'selecting', consecutiveSixes: sixs, message };
}

export function doMove(state: GameState, pid: string): GameState {
  const [ps, is] = pid.split(':').map(Number);
  let pieces = state.pieces.map(p => ({ ...p }));
  const piece  = pieces.find(p => p.player === ps && p.index === is)!;

  // Move piece
  if (piece.relPos === -1) {
    piece.relPos = 0;
  } else {
    piece.relPos = Math.min(piece.relPos + state.dice, FINISHED_POS);
  }

  // Capture check (main track only, non-safe squares)
  let captured = false;
  if (piece.relPos >= 1 && piece.relPos < TRACK_SIZE) {
    const abs = (PLAYER_STARTS[ps] + piece.relPos) % MAIN_PATH_SIZE;
    if (!SAFE_SET.has(abs)) {
      const [pr, pc] = MAIN_PATH[abs];
      pieces = pieces.map(op => {
        if (op.player === ps || op.relPos < 0 || op.relPos >= TRACK_SIZE) return op;
        const oAbs = (PLAYER_STARTS[op.player] + op.relPos) % MAIN_PATH_SIZE;
        const [or, oc] = MAIN_PATH[oAbs];
        if (or === pr && oc === pc) { captured = true; return { ...op, relPos: -1 }; }
        return op;
      });
    }
  }

  // Win check
  const won = pieces.filter(p => p.player === ps).every(p => p.relPos === FINISHED_POS);
  if (won) {
    return { ...state, pieces, winner: ps, phase: 'done', movable: [], diceRolled: false, lastCapture: false, message: '' };
  }

  // Extra-turn logic: roll 6 or capture (but forfeit after 3 consecutive 6s)
  const forfeit    = state.dice === 6 && state.consecutiveSixes >= 3;
  const extraTurn  = (state.dice === 6 || captured) && !forfeit;
  const message    = captured ? '🎯 Capturé !' : forfeit ? '3 fois 6 — tour forfait' : '';

  if (!extraTurn) {
    return {
      ...state, pieces,
      activePlayer: nextPlayer(pieces, state.activePlayer, state.playerSlots),
      dice: 0, diceRolled: false, movable: [], phase: 'rolling',
      consecutiveSixes: 0, lastCapture: captured, message,
    };
  }
  return {
    ...state, pieces,
    dice: 0, diceRolled: false, movable: [], phase: 'rolling',
    lastCapture: captured, message,
  };
}

export function autoPassTurn(state: GameState): GameState {
  return {
    ...state,
    activePlayer: nextPlayer(state.pieces, state.activePlayer, state.playerSlots),
    dice: 0, diceRolled: false, movable: [], phase: 'rolling',
    consecutiveSixes: 0, lastCapture: false, message: '',
  };
}

// ── Simple AI ──────────────────────────────────────────────────────────────
export function aiPickMove(state: GameState): string | null {
  if (!state.movable.length) return null;
  const { pieces, activePlayer: ap, dice } = state;

  const scored = state.movable.map(pid => {
    const [ps, is] = pid.split(':').map(Number);
    const p = pieces.find(q => q.player === ps && q.index === is)!;
    const newRel = p.relPos === -1 ? 0 : p.relPos + dice;
    let score = newRel;

    if (newRel === FINISHED_POS) score += 250;
    if (p.relPos === -1)         score += 45;
    if (newRel >= TRACK_SIZE)    score += 60; // in home col — valuable

    // Bonus for capture
    if (newRel >= 1 && newRel < TRACK_SIZE) {
      const abs = (PLAYER_STARTS[ap] + newRel) % MAIN_PATH_SIZE;
      if (!SAFE_SET.has(abs)) {
        const [r, c] = MAIN_PATH[abs];
        const captures = pieces.some(op => {
          if (op.player === ap || op.relPos < 0 || op.relPos >= TRACK_SIZE) return false;
          const oAbs = (PLAYER_STARTS[op.player] + op.relPos) % MAIN_PATH_SIZE;
          return MAIN_PATH[oAbs][0] === r && MAIN_PATH[oAbs][1] === c;
        });
        if (captures) score += 150;
      }
    }

    // Small random jitter so AI isn't deterministic
    score += Math.random() * 5;
    return { pid, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].pid;
}
