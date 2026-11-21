import {
  applyMove,
  computePositionHash,
  getAllLegalMoves,
  opponentColor,
  WINNING_LINES,
  type DifficultyLevel,
  type GameMove,
  type GameState,
  type PieceType,
  type PlayerColor,
} from './gameEngine.ts';

const WIN_SCORE = 100000;

const PIECE_VALUES: Record<PieceType, number> = {
  queen: 260,
  rook: 165,
  knight: 135,
  bishop: 130,
  pawn: 75,
};

const CENTER_BONUS = [
  [8, 16, 16, 8],
  [16, 32, 32, 16],
  [16, 32, 32, 16],
  [8, 16, 16, 8],
];

function evaluateState(state: GameState, aiColor: PlayerColor): number {
  if (state.status === 'won') {
    return state.winner === aiColor ? WIN_SCORE - state.ply : -WIN_SCORE + state.ply;
  }
  if (state.status === 'draw') {
    return 0;
  }

  const humanColor = opponentColor(aiColor);
  let score = 0;

  // Material + positional board control
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = state.board[r][c];
      if (!cell) continue;
      let val = PIECE_VALUES[cell.type] + CENTER_BONUS[r][c];
      if (cell.type === 'pawn') {
        const advancement = cell.color === 'white' ? 3 - r : r;
        val += advancement * 28;
      }
      if (cell.color === aiColor) {
        score += val;
      } else {
        score -= val;
      }
    }
  }

  // Reserve pieces retain placement flexibility
  for (const rp of state.trays[aiColor]) {
    score += PIECE_VALUES[rp.type] * 0.55;
  }
  for (const rp of state.trays[humanColor]) {
    score -= PIECE_VALUES[rp.type] * 0.55;
  }

  // Line potential (Tic-Tac-Toe 4-in-a-row threats)
  for (const line of WINNING_LINES) {
    let aiCount = 0;
    let humanCount = 0;
    for (const coord of line) {
      const cell = state.board[coord.row][coord.col];
      if (cell?.color === aiColor) aiCount++;
      else if (cell?.color === humanColor) humanCount++;
    }

    if (humanCount === 0 && aiCount > 0) {
      if (aiCount === 3) score += state.turn === aiColor ? 850 : 320;
      else if (aiCount === 2) score += 95;
      else if (aiCount === 1) score += 18;
    } else if (aiCount === 0 && humanCount > 0) {
      if (humanCount === 3) score -= state.turn === humanColor ? 880 : 340;
      else if (humanCount === 2) score -= 100;
      else if (humanCount === 1) score -= 18;
    }
  }

  return score;
}

function scoreMoveOrdering(state: GameState, move: GameMove): number {
  let s = 0;
  if (move.kind === 'move') {
    const target = state.board[move.to.row][move.to.col];
    if (target) {
      s += 400 + PIECE_VALUES[target.type];
    }
    const promoRow = move.color === 'white' ? 0 : 3;
    if (move.pieceType === 'pawn' && move.to.row === promoRow) {
      s += 300;
    }
  } else {
    s += 60;
  }
  s += CENTER_BONUS[move.to.row][move.to.col];
  return s;
}

function orderedMoves(state: GameState): GameMove[] {
  const moves = getAllLegalMoves(state);
  return moves.sort((a, b) => scoreMoveOrdering(state, b) - scoreMoveOrdering(state, a));
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove?: GameMove;
}

interface SearchContext {
  aiColor: PlayerColor;
  deadline: number;
  aborted: boolean;
  tt: Map<string, TTEntry>;
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ctx: SearchContext
): { score: number; move: GameMove | null } {
  if (Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return { score: evaluateState(state, ctx.aiColor), move: null };
  }

  if (depth === 0 || state.status !== 'active') {
    return { score: evaluateState(state, ctx.aiColor), move: null };
  }

  const hash = computePositionHash(state.board, state.trays, state.turn);
  const ttKey = `${hash}:${maximizing ? 1 : 0}`;
  const cached = ctx.tt.get(ttKey);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') {
      return { score: cached.score, move: cached.bestMove ?? null };
    }
    if (cached.flag === 'lower') {
      alpha = Math.max(alpha, cached.score);
    } else if (cached.flag === 'upper') {
      beta = Math.min(beta, cached.score);
    }
    if (alpha >= beta) {
      return { score: cached.score, move: cached.bestMove ?? null };
    }
  }

  const moves = orderedMoves(state);
  if (moves.length === 0) {
    return { score: 0, move: null };
  }

  // Prioritize cached best move first
  if (cached?.bestMove) {
    const bm = cached.bestMove;
    const idx = moves.findIndex(
      (m) =>
        m.kind === bm.kind &&
        m.pieceId === bm.pieceId &&
        m.to.row === bm.to.row &&
        m.to.col === bm.to.col
    );
    if (idx > 0) {
      const [picked] = moves.splice(idx, 1);
      moves.unshift(picked);
    }
  }

  const origAlpha = alpha;
  const origBeta = beta;
  let bestMove: GameMove = moves[0];

  if (maximizing) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const applied = applyMove(state, move);
      if (!applied) continue;
      const { score } = alphaBeta(
        applied.nextState,
        depth - 1,
        alpha,
        beta,
        false,
        ctx
      );
      if (ctx.aborted) break;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
      if (alpha >= beta) break;
    }

    if (!ctx.aborted) {
      const flag: TTEntry['flag'] =
        bestScore <= origAlpha
          ? 'upper'
          : bestScore >= origBeta
            ? 'lower'
            : 'exact';
      ctx.tt.set(ttKey, { depth, score: bestScore, flag, bestMove });
    }
    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    for (const move of moves) {
      const applied = applyMove(state, move);
      if (!applied) continue;
      const { score } = alphaBeta(
        applied.nextState,
        depth - 1,
        alpha,
        beta,
        true,
        ctx
      );
      if (ctx.aborted) break;
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
      if (alpha >= beta) break;
    }

    if (!ctx.aborted) {
      const flag: TTEntry['flag'] =
        bestScore <= origAlpha
          ? 'upper'
          : bestScore >= origBeta
            ? 'lower'
            : 'exact';
      ctx.tt.set(ttKey, { depth, score: bestScore, flag, bestMove });
    }
    return { score: bestScore, move: bestMove };
  }
}

export function chooseAIMove(
  state: GameState,
  difficulty: DifficultyLevel
): GameMove | null {
  const moves = orderedMoves(state);
  if (moves.length === 0) return null;

  const aiColor = state.turn;

  // Immediate win check across all difficulties (Easy misses 35% of the time)
  for (const move of moves) {
    const res = applyMove(state, move);
    if (res?.nextState.status === 'won' && res.nextState.winner === aiColor) {
      if (difficulty !== 'easy' || Math.random() < 0.65) {
        return move;
      }
    }
  }

  if (difficulty === 'easy') {
    const scored = moves.map((m) => {
      const res = applyMove(state, m);
      return {
        move: m,
        score: res ? evaluateState(res.nextState, aiColor) : -999999,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    const poolSize = Math.min(scored.length, 6);
    const pickIdx = Math.floor(Math.random() * poolSize);
    return scored[pickIdx].move;
  }

  if (difficulty === 'intermediate') {
    const ctx: SearchContext = {
      aiColor,
      deadline: Date.now() + 250,
      aborted: false,
      tt: new Map(),
    };
    const res = alphaBeta(state, 2, -Infinity, Infinity, true, ctx);
    // Slight variety among near-equal moves
    return res.move ?? moves[0];
  }

  if (difficulty === 'hard') {
    const ctx: SearchContext = {
      aiColor,
      deadline: Date.now() + 450,
      aborted: false,
      tt: new Map(),
    };
    let best = moves[0];
    for (let d = 1; d <= 4; d++) {
      const res = alphaBeta(state, d, -Infinity, Infinity, true, ctx);
      if (ctx.aborted) break;
      if (res.move) best = res.move;
    }
    return best;
  }

  // Legendary: iterative deepening up to depth 6 with transposition table
  const ctx: SearchContext = {
    aiColor,
    deadline: Date.now() + 750,
    aborted: false,
    tt: new Map(),
  };
  let best = moves[0];
  for (let d = 1; d <= 6; d++) {
    const res = alphaBeta(state, d, -Infinity, Infinity, true, ctx);
    if (ctx.aborted) break;
    if (res.move) best = res.move;
    if (res.score >= WIN_SCORE - 50) break;
  }
  return best;
}
