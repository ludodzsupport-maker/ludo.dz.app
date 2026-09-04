// ─── Ludo Engine ─────────────────────────────────────────────────────────────
// Pure game logic: state, moves, AI. No React/DOM dependencies.

export const MAIN_PATH_SIZE = 52; // physical length of MAIN_PATH (used for abs modulo)
export const TRACK_SIZE    = 51; // home-entry threshold: relPos 51+ → HOME_COLS
// A home lane is FIVE walkable squares (relPos 51-55). The sixth entry of each
// HOME_COLS row ([7,6] / [6,7] / [7,8] / [8,7]) is NOT a lane square — it is a
// cell of the central 3×3 finish area (classifyCell resolves rows/cols 6-8 as
// 'center' before the homecol test, so it is never rendered as a lane cell in
// any theme). Counting it as walkable made the journey one square too long:
// the pawn reached its finish slot at relPos 55 and then took one extra
// phantom hop into the centre. The lane geometry in HOME_COLS is untouched —
// only how many of its entries count as steps changed.
export const HOME_COL_SIZE = 5;
export const FINISHED_POS  = TRACK_SIZE + HOME_COL_SIZE; // 56

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

// Canonical clockwise seat order. Turn sequencing must always follow this
// order and must never depend on which colour the human picked at match start.
export const CLOCKWISE_PLAYER_ORDER = [0, 1, 2, 3] as const;

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
  relPos: number; // -1=home base, 0-50=track, 51-55=home col, 56=finished
}

export interface GameState {
  pieces:          Piece[];
  activePlayer:    number;
  numPlayers:      number;
  playerSlots:     readonly number[]; // turn-order list of active colour indices in canonical clockwise order
  dice:            number;
  diceRolled:      boolean;
  winner:          number | null;
  /**
   * Colours that have completed every one of their pieces this session, in
   * the order they finished — the session's placement ladder (index 0 = 1st).
   * `winner` only ever names the *latest* finisher (the pause point the
   * victory screen resumes from via `continueAfterFinish`); the full
   * 1st/2nd/3rd/4th order across the whole match lives here. Optional at
   * runtime only so saves from before this field existed still load — every
   * write path defaults it to [].
   */
  finishOrder?:    readonly number[];
  phase:           'rolling' | 'selecting' | 'done';
  movable:         string[];
  consecutiveSixes: number;
  lastCapture:     boolean;
  message:         string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isPlayerIndex(value: number): value is typeof CLOCKWISE_PLAYER_ORDER[number] {
  return Number.isInteger(value) && value >= 0 && value < CLOCKWISE_PLAYER_ORDER.length;
}

export function normalizePlayerSlots(playerSlots: readonly number[] | undefined, numPlayers?: number): number[] {
  const requestedCount = Math.max(
    0,
    Math.min(CLOCKWISE_PLAYER_ORDER.length, numPlayers ?? playerSlots?.length ?? CLOCKWISE_PLAYER_ORDER.length),
  );
  const active = new Set((playerSlots ?? CLOCKWISE_PLAYER_ORDER).filter(isPlayerIndex));
  return CLOCKWISE_PLAYER_ORDER.filter(player => active.has(player)).slice(0, requestedCount);
}

export function resolvePlayerSlots(numPlayers: number, humanColor?: number, excludedColor?: number): number[] {
  // Existing 2-player local mode intentionally uses the diagonal Red/Yellow
  // pairing. Keep that participant set, but every other configuration is still
  // normalized to the fixed clockwise turn order below.
  if (numPlayers === 2 && humanColor === undefined && excludedColor === undefined) return [0, 2];

  const prioritized = humanColor === undefined
    ? [...CLOCKWISE_PLAYER_ORDER]
    : [humanColor, ...CLOCKWISE_PLAYER_ORDER];

  const picked: number[] = [];
  for (const player of prioritized) {
    if (!isPlayerIndex(player) || player === excludedColor || picked.includes(player)) continue;
    picked.push(player);
    if (picked.length >= numPlayers) break;
  }

  return normalizePlayerSlots(picked, numPlayers);
}

export function normalizeGameState(state: GameState, playerSlots?: readonly number[]): GameState {
  const slots = normalizePlayerSlots(playerSlots ?? state.playerSlots, state.numPlayers);
  const fallbackActivePlayer = slots.includes(0) ? 0 : (slots[0] ?? 0);
  const activePlayer = slots.includes(state.activePlayer) ? state.activePlayer : fallbackActivePlayer;
  const hasSameSlots = slots.length === state.playerSlots.length
    && slots.every((slot, index) => slot === state.playerSlots[index]);
  const movable = activePlayer === state.activePlayer
    ? state.movable
    : (state.phase === 'selecting' && state.diceRolled ? calcMovable(state.pieces, activePlayer, state.dice) : []);

  return activePlayer === state.activePlayer && hasSameSlots
    ? state
    : {
        ...state,
        activePlayer,
        playerSlots: slots,
        movable,
      };
}
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

// ─── Threat detection (التهديد) ──────────────────────────────────────────────
// Pure board-state analysis: which pieces are *threatened* right now?
//
// A piece B is threatened when an opponent piece A sits exactly 1 or 2 squares
// behind B along B's forward path (the shared main loop), i.e. A could land on
// B's square with a roll of 1 or 2. The safe-square exception mirrors the
// capture rules in `doMove` exactly: a piece standing on a protected square
// (SAFE_SET — the engine's protected-square set, the same one the capture
// check consults) cannot be captured there, and pieces in a home column,
// finished, or still in base are never capturable, so no threat is reported
// for any of those.
//
// This is deliberately turn/dice-free — the caller decides *when* to scan
// (the UI re-scans after every move resolves, the same point where the
// إخراج_بيدق / الأكل events fire) and what to do with the result (voice,
// board markers, AI). Multiple attackers can threaten the same target (each
// gets its own pair), and a piece can simultaneously be a target and an
// attacker (a chain of pieces 2 apart) — callers can pick whichever role
// matters for their use case.
export interface PieceRef {
  player: number;
  index: number;
}

export interface ThreatPair {
  /** The piece that could land on the target with a roll of 1 or 2. */
  attacker: PieceRef;
  /** The piece under threat. */
  target: PieceRef;
}

export function detectThreats(pieces: readonly Piece[]): ThreatPair[] {
  // Index main-track pieces by their absolute path square so attacker
  // lookups are O(1). Stacked pieces share one entry (each occupant is a
  // distinct potential attacker / target).
  const bySquare = new Map<number, Piece[]>();
  for (const piece of pieces) {
    if (piece.relPos < 0 || piece.relPos >= TRACK_SIZE) continue;
    const abs = (PLAYER_STARTS[piece.player] + piece.relPos) % MAIN_PATH_SIZE;
    const occupants = bySquare.get(abs);
    if (occupants) occupants.push(piece);
    else bySquare.set(abs, [piece]);
  }

  const threats: ThreatPair[] = [];
  for (const target of pieces) {
    if (target.relPos < 0 || target.relPos >= TRACK_SIZE) continue;
    const abs = (PLAYER_STARTS[target.player] + target.relPos) % MAIN_PATH_SIZE;
    // Safe/protected square (player start, star) → a landing opponent cannot
    // capture here, so this piece is never under threat. Home-column / base /
    // finished targets are already excluded by the track-range check above.
    if (SAFE_SET.has(abs)) continue;

    // The two squares directly behind the target along its forward path.
    const behind = [
      (abs - 1 + MAIN_PATH_SIZE) % MAIN_PATH_SIZE,
      (abs - 2 + MAIN_PATH_SIZE) % MAIN_PATH_SIZE,
    ];
    for (const behindAbs of behind) {
      const occupants = bySquare.get(behindAbs);
      if (!occupants) continue;
      for (const attacker of occupants) {
        if (attacker.player === target.player) continue; // own piece never captures
        threats.push({
          attacker: { player: attacker.player, index: attacker.index },
          target: { player: target.player, index: target.index },
        });
      }
    }
  }
  return threats;
}

/**
 * Stable identity of one threat pair, used to diff the threat set before and
 * after a move: only pairs that did not exist before count as *new* threats
 * (a threat that simply persists across a move never re-fires its event).
 */
export function threatSignature(pair: ThreatPair): string {
  return `${pair.attacker.player}:${pair.attacker.index}>${pair.target.player}:${pair.target.index}`;
}

export interface ThreatDiff {
  /**
   * Pairs that did not exist before this move — freshly created threats
   * (التهديد). Returned in `next` scan order, so the caller can speak for a
   * deterministic piece when several appear at once.
   */
  created: ThreatPair[];
  /**
   * Pairs that existed before this move and no longer exist — *resolved*
   * threats (الهروب): the target is out of its attacker's 1-2 square range,
   * whether it moved away, the attacker moved away, or the target reached a
   * square that cannot be captured on. Returned in `previous` scan order.
   *
   * This is only the geometric half of an escape. A threatened piece that was
   * *captured* by the move also disappears from the threat set, and that is
   * الأكل, not an escape — the caller filters those out (the target is back in
   * base, `relPos === -1`).
   */
  resolved: ThreatPair[];
}

/**
 * Diff two threat sets by pair signature. Pure, turn/dice-free — exactly like
 * `detectThreats`, the caller decides when to scan and what each half means.
 * Both halves come from one pass so the two events that share a threat
 * relationship (التهديد / الهروب) are always derived from the same snapshot.
 */
export function diffThreats(
  previous: readonly ThreatPair[],
  next: readonly ThreatPair[],
): ThreatDiff {
  const before = new Map(previous.map(pair => [threatSignature(pair), pair]));
  const after = new Set(next.map(pair => threatSignature(pair)));

  const created: ThreatPair[] = [];
  for (const pair of next) {
    if (!before.has(threatSignature(pair))) created.push(pair);
  }

  const resolved: ThreatPair[] = [];
  for (const pair of previous) {
    if (!after.has(threatSignature(pair))) resolved.push(pair);
  }

  return { created, resolved };
}

// ── Game lifecycle ─────────────────────────────────────────────────────────
export function createGame(numPlayers: number, pawnsPerPlayer = 4, playerSlots?: readonly number[]): GameState {
  const rawSlots = playerSlots ?? Array.from({ length: numPlayers }, (_, i) => i);
  const slots = normalizePlayerSlots(rawSlots, numPlayers);
  const startingPlayer = slots.includes(0) ? 0 : (slots[0] ?? 0);
  const pieces: Piece[] = [];
  for (let p = 0; p < slots.length; p++) {
    for (let i = 0; i < pawnsPerPlayer; i++) pieces.push({ player: slots[p], index: i, relPos: -1 });
  }
  return {
    pieces, activePlayer: startingPlayer, numPlayers,
    playerSlots: slots,
    dice: 0, diceRolled: false, winner: null,
    finishOrder: [],
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

// Would landing this player's piece at newRel capture an opponent? Mirrors doMove.
function wouldCaptureAt(pieces: Piece[], player: number, newRel: number): boolean {
  if (newRel < 1 || newRel >= TRACK_SIZE) return false;
  const abs = (PLAYER_STARTS[player] + newRel) % MAIN_PATH_SIZE;
  if (SAFE_SET.has(abs)) return false;
  const [pr, pc] = MAIN_PATH[abs];
  return pieces.some(op => {
    if (op.player === player || op.relPos < 0 || op.relPos >= TRACK_SIZE) return false;
    const oAbs = (PLAYER_STARTS[op.player] + op.relPos) % MAIN_PATH_SIZE;
    const [or, oc] = MAIN_PATH[oAbs];
    return or === pr && oc === pc;
  });
}

// Light fun-weighting on top of uniform randomness. Each face starts at 1;
// exciting outcomes get a small bonus so the die still looks fair over time.
function funWeightedRoll(state: GameState): number {
  const weights = [0, 1, 1, 1, 1, 1, 1]; // index 1..6
  const { pieces, activePlayer: ap, consecutiveSixes } = state;
  const mine = pieces.filter(p => p.player === ap && p.relPos !== FINISHED_POS);

  const captureRels = new Set<number>();
  for (const p of mine) {
    if (p.relPos < 0) continue;
    for (let d = 1; d <= 6; d++) {
      const newRel = p.relPos + d;
      if (wouldCaptureAt(pieces, ap, newRel)) captureRels.add(newRel);
    }
  }

  for (let d = 1; d <= 6; d++) {
    let bonus = 0;
    for (const p of mine) {
      if (p.relPos === -1) {
        if (d === 6) bonus = Math.max(bonus, 0.16);
        continue;
      }
      const newRel = p.relPos + d;
      if (newRel > FINISHED_POS) continue;
      if (newRel === FINISHED_POS) bonus = Math.max(bonus, 0.26);
      else if (p.relPos < TRACK_SIZE && newRel >= TRACK_SIZE) bonus = Math.max(bonus, 0.10);
      if (wouldCaptureAt(pieces, ap, newRel)) bonus = Math.max(bonus, 0.30);
      else if (captureRels.has(newRel + 1)) bonus = Math.max(bonus, 0.14);
    }
    if (calcMovable(pieces, ap, d).length === 0) bonus -= 0.10;
    // A second 6 continues a streak; a third forfeits the turn — nudge away.
    if (d === 6) {
      if (consecutiveSixes === 1) bonus = Math.max(bonus, 0.12);
      if (consecutiveSixes >= 2) bonus -= 0.40;
    }
    weights[d] += bonus;
    if (weights[d] < 0.15) weights[d] = 0.15;
  }

  const total = weights[1] + weights[2] + weights[3] + weights[4] + weights[5] + weights[6];
  let r = Math.random() * total;
  for (let d = 1; d <= 6; d++) {
    r -= weights[d];
    if (r < 0) return d;
  }
  return 6;
}

export function doRoll(state: GameState): GameState {
  if (state.diceRolled || state.phase !== 'rolling') return state;
  const allHome = state.pieces
    .filter(p => p.player === state.activePlayer)
    .every(p => p.relPos === -1);
  const dice    = allHome ? weightedSixRoll() : funWeightedRoll(state);
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
    return {
      ...state, pieces,
      // Append the colour to the session's placement ladder. Defensive `?? []`
      // so a save from before this field existed upgrades in place instead of
      // crashing on spread. (`winner` below names only this latest finisher.)
      finishOrder: [...(state.finishOrder ?? []), ps],
      winner: ps, phase: 'done', movable: [], diceRolled: false, lastCapture: false, message: '',
    };
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

// ─── Continue after a finish (placement play) ─────────────────────────────────
// The first colour to finish pauses the match on the victory screen. When the
// players choose to continue (2nd/3rd places are still open), the engine
// resumes the match: the finished colour's turn ends with its finish and it
// leaves the rotation for good (`nextPlayer` skips colours whose every piece
// is finished), the turn passes to the next colour still playing, and
// `winner`/`phase` reset so the ordinary rolling loop takes over. The next
// colour to finish sets `winner`/`phase: 'done'` again — the same pause point,
// where the same choice can be offered — while `finishOrder` keeps growing, so
// the UI can rank the whole session (1st/2nd/3rd/4th) no matter how many
// colours finished.
export function continueAfterFinish(state: GameState): GameState {
  if (state.winner === null) return state;

  const ladder = state.finishOrder ?? [];
  // doMove already appended the winner; the includes() guard only makes a
  // stray double call idempotent.
  const finishOrder = ladder.includes(state.winner) ? ladder : [...ladder, state.winner];

  // Placement play is only defined while a contest remains: with fewer than
  // two colours still on the board there is no "next place" left to play for
  // (a lone remaining colour is last by elimination), so the state is final.
  const stillPlaying = state.playerSlots.filter(slot =>
    !state.pieces.filter(p => p.player === slot).every(p => p.relPos === FINISHED_POS));
  if (stillPlaying.length < 2) return state;

  return {
    ...state,
    finishOrder,
    winner: null,
    phase: 'rolling',
    // The finished colour's turn ended with its finishing move (doMove's win
    // branch does not advance the rotation), so resume at the next colour
    // still playing. nextPlayer skips finished colours, so the winner stays
    // out of the rotation from here on.
    activePlayer: nextPlayer(state.pieces, state.winner, state.playerSlots),
    dice: 0, diceRolled: false, movable: [],
    consecutiveSixes: 0, lastCapture: false, message: '',
  };
}

// ─── Auto-move: single actionable choice ───────────────────────────────────
// Auto-move fires ONLY when the roll's legal moves collapse to one real
// option, so the player never waits for a tap that carries no decision:
//   • exactly one pawn can move (the former lone-released-pawn case is a
//     subset of this), or
//   • every movable pawn is functionally identical: still-home pawns on a
//     6 roll (every exit lands on the same spawn square) or 2+ pawns stacked
//     on the exact same board square (same relPos → same square, same forward
//     path, same capture outcome — moving any one of them is indistinguishable
//     in game terms).
// Two or more genuinely distinct legal moves (different pawns on different
// squares, or a home-base exit vs. a board advance on a 6) still require a
// manual tap: real player choice is never removed. Returns the pawn id to
// auto-move, or null when a real choice exists / nothing can move.
export function getAutoMovePawn(state: GameState): string | null {
  if (state.movable.length === 0) return null;

  let identity: number | null = null;
  for (const pid of state.movable) {
    const [ps, is] = pid.split(':').map(Number);
    const piece = state.pieces.find(p => p.player === ps && p.index === is);
    if (!piece) return null;
    // relPos is the functional identity of a movable pawn: -1 groups all
    // home-base exits together (only reachable on a 6), and equal relPos
    // values mean pawns stacked on the same square with the same forward
    // path. One distinct value across all movable pawns → one real option.
    if (identity === null) identity = piece.relPos;
    else if (identity !== piece.relPos) return null;
  }
  return state.movable[0];
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
