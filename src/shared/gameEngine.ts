export type PlayerColor = 'white' | 'black';
export type PieceType = 'rook' | 'bishop' | 'knight' | 'pawn' | 'queen';
export type DifficultyLevel = 'easy' | 'intermediate' | 'hard' | 'legendary';
export type GameMode = 'ai' | 'multiplayer' | 'local';

export interface BoardPiece {
  id: string;
  color: PlayerColor;
  type: PieceType;
  promotedFromPawn?: boolean;
}

export type Cell = BoardPiece | null;

export interface ReservePiece {
  id: string;
  color: PlayerColor;
  type: Exclude<PieceType, 'queen'>;
}

export interface Coord {
  row: number;
  col: number;
}

export type GameMove =
  | {
      kind: 'drop';
      color: PlayerColor;
      pieceId: string;
      pieceType: Exclude<PieceType, 'queen'>;
      to: Coord;
    }
  | {
      kind: 'move';
      color: PlayerColor;
      pieceId: string;
      pieceType: PieceType;
      from: Coord;
      to: Coord;
    };

export interface MoveRecord {
  ply: number;
  color: PlayerColor;
  notation: string;
  kind: 'drop' | 'move';
  pieceType: PieceType;
  from?: Coord;
  to: Coord;
  captured?: PieceType;
  promoted?: boolean;
  isWinning?: boolean;
}

export interface GameState {
  board: Cell[][];
  trays: {
    white: ReservePiece[];
    black: ReservePiece[];
  };
  turn: PlayerColor;
  status: 'active' | 'won' | 'draw';
  winner: PlayerColor | null;
  winningLine: Coord[] | null;
  drawReason: 'threefold' | 'stalemate' | 'move_limit' | null;
  moves: MoveRecord[];
  ply: number;
  pliesSinceProgress: number;
  positionCounts: Record<string, number>;
  lastMove: { from?: Coord; to: Coord } | null;
}

export const WINNING_LINES: Coord[][] = [
  // Rows
  [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }],
  [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }],
  [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }],
  [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }],
  // Columns
  [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }],
  [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 1 }],
  [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }, { row: 3, col: 2 }],
  [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }],
  // Diagonals
  [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }],
  [{ row: 0, col: 3 }, { row: 1, col: 2 }, { row: 2, col: 1 }, { row: 3, col: 0 }],
];

const FILES = ['a', 'b', 'c', 'd'];
const RANKS = ['4', '3', '2', '1'];

export function coordToAlgebraic(coord: Coord): string {
  return `${FILES[coord.col]}${RANKS[coord.row]}`;
}

export function pieceSymbol(type: PieceType): string {
  switch (type) {
    case 'rook':
      return 'R';
    case 'bishop':
      return 'B';
    case 'knight':
      return 'N';
    case 'pawn':
      return 'P';
    case 'queen':
      return 'Q';
  }
}

export function opponentColor(color: PlayerColor): PlayerColor {
  return color === 'white' ? 'black' : 'white';
}

export function createInitialTray(color: PlayerColor): ReservePiece[] {
  const prefix = color === 'white' ? 'w' : 'b';
  return [
    { id: `${prefix}-rook`, color, type: 'rook' },
    { id: `${prefix}-bishop`, color, type: 'bishop' },
    { id: `${prefix}-knight`, color, type: 'knight' },
    { id: `${prefix}-pawn`, color, type: 'pawn' },
  ];
}

export function computePositionHash(
  board: Cell[][],
  trays: { white: ReservePiece[]; black: ReservePiece[] },
  turn: PlayerColor
): string {
  const rows = board
    .map((row) =>
      row
        .map((cell) =>
          cell ? `${cell.color[0]}${pieceSymbol(cell.type)}` : '..'
        )
        .join('')
    )
    .join('/');
  const wt = trays.white
    .map((p) => pieceSymbol(p.type))
    .sort()
    .join('');
  const bt = trays.black
    .map((p) => pieceSymbol(p.type))
    .sort()
    .join('');
  return `${turn[0]}|${rows}|${wt}|${bt}`;
}

export function createInitialGameState(): GameState {
  const board: Cell[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => null)
  );
  const trays = {
    white: createInitialTray('white'),
    black: createInitialTray('black'),
  };
  const hash = computePositionHash(board, trays, 'white');
  return {
    board,
    trays,
    turn: 'white',
    status: 'active',
    winner: null,
    winningLine: null,
    drawReason: null,
    moves: [],
    ply: 0,
    pliesSinceProgress: 0,
    positionCounts: { [hash]: 1 },
    lastMove: null,
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    board: state.board.map((row) =>
      row.map((cell) => (cell ? { ...cell } : null))
    ),
    trays: {
      white: state.trays.white.map((p) => ({ ...p })),
      black: state.trays.black.map((p) => ({ ...p })),
    },
    turn: state.turn,
    status: state.status,
    winner: state.winner,
    winningLine: state.winningLine ? state.winningLine.map((c) => ({ ...c })) : null,
    drawReason: state.drawReason,
    moves: [...state.moves],
    ply: state.ply,
    pliesSinceProgress: state.pliesSinceProgress,
    positionCounts: { ...state.positionCounts },
    lastMove: state.lastMove
      ? {
          from: state.lastMove.from ? { ...state.lastMove.from } : undefined,
          to: { ...state.lastMove.to },
        }
      : null,
  };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 4 && c >= 0 && c < 4;
}

export function getLegalDropsForPiece(
  state: GameState,
  piece: ReservePiece
): Coord[] {
  if (state.status !== 'active' || piece.color !== state.turn) return [];
  const targets: Coord[] = [];
  const forbiddenPawnRow = piece.color === 'white' ? 0 : 3;

  for (let r = 0; r < 4; r++) {
    if (piece.type === 'pawn' && r === forbiddenPawnRow) continue;
    for (let c = 0; c < 4; c++) {
      if (!state.board[r][c]) {
        targets.push({ row: r, col: c });
      }
    }
  }
  return targets;
}

export function getLegalMovesForSquare(
  state: GameState,
  from: Coord
): Coord[] {
  if (state.status !== 'active') return [];
  const piece = state.board[from.row]?.[from.col];
  if (!piece || piece.color !== state.turn) return [];

  const targets: Coord[] = [];
  const enemy = opponentColor(piece.color);

  const addSlideMoves = (dirs: Array<[number, number]>) => {
    for (const [dr, dc] of dirs) {
      let r = from.row + dr;
      let c = from.col + dc;
      while (inBounds(r, c)) {
        const target = state.board[r][c];
        if (!target) {
          targets.push({ row: r, col: c });
        } else {
          if (target.color === enemy) {
            targets.push({ row: r, col: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
  };

  switch (piece.type) {
    case 'rook':
      addSlideMoves([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    case 'bishop':
      addSlideMoves([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    case 'queen':
      addSlideMoves([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    case 'knight': {
      const jumps: Array<[number, number]> = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const r = from.row + dr;
        const c = from.col + dc;
        if (inBounds(r, c)) {
          const target = state.board[r][c];
          if (!target || target.color === enemy) {
            targets.push({ row: r, col: c });
          }
        }
      }
      break;
    }
    case 'pawn': {
      const dr = piece.color === 'white' ? -1 : 1;
      const forwardRow = from.row + dr;
      if (inBounds(forwardRow, from.col) && !state.board[forwardRow][from.col]) {
        targets.push({ row: forwardRow, col: from.col });
      }
      for (const dc of [-1, 1]) {
        const capCol = from.col + dc;
        if (inBounds(forwardRow, capCol)) {
          const target = state.board[forwardRow][capCol];
          if (target && target.color === enemy) {
            targets.push({ row: forwardRow, col: capCol });
          }
        }
      }
      break;
    }
  }

  return targets;
}

export function getAllLegalMoves(state: GameState): GameMove[] {
  if (state.status !== 'active') return [];
  const moves: GameMove[] = [];
  const tray = state.trays[state.turn];

  for (const rp of tray) {
    const drops = getLegalDropsForPiece(state, rp);
    for (const to of drops) {
      moves.push({
        kind: 'drop',
        color: state.turn,
        pieceId: rp.id,
        pieceType: rp.type,
        to,
      });
    }
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = state.board[r][c];
      if (cell && cell.color === state.turn) {
        const from = { row: r, col: c };
        const targets = getLegalMovesForSquare(state, from);
        for (const to of targets) {
          moves.push({
            kind: 'move',
            color: state.turn,
            pieceId: cell.id,
            pieceType: cell.type,
            from,
            to,
          });
        }
      }
    }
  }

  return moves;
}

export function findWinningLine(
  board: Cell[][],
  color: PlayerColor
): Coord[] | null {
  for (const line of WINNING_LINES) {
    if (line.every((c) => board[c.row][c.col]?.color === color)) {
      return line;
    }
  }
  return null;
}

export function countThreats(board: Cell[][], color: PlayerColor): number {
  let threats = 0;
  for (const line of WINNING_LINES) {
    let own = 0;
    let enemy = 0;
    for (const c of line) {
      const cell = board[c.row][c.col];
      if (cell?.color === color) own++;
      else if (cell) enemy++;
    }
    if (own === 3 && enemy === 0) threats++;
  }
  return threats;
}

export function applyMove(
  state: GameState,
  move: GameMove
): { nextState: GameState; record: MoveRecord } | null {
  if (state.status !== 'active' || move.color !== state.turn) return null;

  const next = cloneGameState(state);
  let capturedType: PieceType | undefined;
  let promoted = false;

  if (move.kind === 'drop') {
    const tray = next.trays[move.color];
    const idx = tray.findIndex((p) => p.id === move.pieceId);
    if (idx === -1) return null;
    const legalDrops = getLegalDropsForPiece(next, tray[idx]);
    if (!legalDrops.some((c) => c.row === move.to.row && c.col === move.to.col)) {
      return null;
    }
    const [removed] = tray.splice(idx, 1);
    next.board[move.to.row][move.to.col] = {
      id: removed.id,
      color: removed.color,
      type: removed.type,
      promotedFromPawn: false,
    };
    next.pliesSinceProgress = 0;
  } else {
    const piece = next.board[move.from.row]?.[move.from.col];
    if (!piece || piece.id !== move.pieceId || piece.color !== move.color) {
      return null;
    }
    const legalTargets = getLegalMovesForSquare(next, move.from);
    if (!legalTargets.some((c) => c.row === move.to.row && c.col === move.to.col)) {
      return null;
    }

    const targetCell = next.board[move.to.row][move.to.col];
    if (targetCell) {
      capturedType = targetCell.type;
      const returnType: Exclude<PieceType, 'queen'> =
        targetCell.type === 'queen' || targetCell.promotedFromPawn
          ? 'pawn'
          : targetCell.type;
      next.trays[targetCell.color].push({
        id: targetCell.id,
        color: targetCell.color,
        type: returnType,
      });
    }

    next.board[move.from.row][move.from.col] = null;

    const promotionRow = piece.color === 'white' ? 0 : 3;
    let nextType = piece.type;
    let promotedFromPawn = piece.promotedFromPawn;
    if (piece.type === 'pawn' && move.to.row === promotionRow) {
      nextType = 'queen';
      promotedFromPawn = true;
      promoted = true;
    }

    next.board[move.to.row][move.to.col] = {
      id: piece.id,
      color: piece.color,
      type: nextType,
      promotedFromPawn,
    };

    if (capturedType || promoted || piece.type === 'pawn') {
      next.pliesSinceProgress = 0;
    } else {
      next.pliesSinceProgress += 1;
    }
  }

  next.ply += 1;
  next.lastMove = {
    from: move.kind === 'move' ? { ...move.from } : undefined,
    to: { ...move.to },
  };

  const winLine = findWinningLine(next.board, move.color);
  let notation = '';
  if (move.kind === 'drop') {
    notation = `${pieceSymbol(move.pieceType)}@${coordToAlgebraic(move.to)}`;
  } else {
    const sep = capturedType ? 'x' : '-';
    notation = `${pieceSymbol(move.pieceType)}${coordToAlgebraic(move.from)}${sep}${coordToAlgebraic(move.to)}${promoted ? '=Q' : ''}`;
  }
  if (winLine) {
    notation += '#';
  }

  const record: MoveRecord = {
    ply: next.ply,
    color: move.color,
    notation,
    kind: move.kind,
    pieceType: move.pieceType,
    from: move.kind === 'move' ? { ...move.from } : undefined,
    to: { ...move.to },
    captured: capturedType,
    promoted,
    isWinning: Boolean(winLine),
  };

  next.moves.push(record);

  if (winLine) {
    next.status = 'won';
    next.winner = move.color;
    next.winningLine = winLine;
    return { nextState: next, record };
  }

  next.turn = opponentColor(move.color);
  const hash = computePositionHash(next.board, next.trays, next.turn);
  next.positionCounts[hash] = (next.positionCounts[hash] ?? 0) + 1;

  if (next.positionCounts[hash] >= 3) {
    next.status = 'draw';
    next.drawReason = 'threefold';
  } else if (next.pliesSinceProgress >= 120) {
    next.status = 'draw';
    next.drawReason = 'move_limit';
  } else if (getAllLegalMoves(next).length === 0) {
    next.status = 'draw';
    next.drawReason = 'stalemate';
  }

  return { nextState: next, record };
}
