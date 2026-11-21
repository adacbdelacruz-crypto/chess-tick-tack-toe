import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  coordToAlgebraic,
  getLegalDropsForPiece,
  getLegalMovesForSquare,
  type Coord,
  type GameState,
  type PlayerColor,
  type ReservePiece,
} from '../shared/gameEngine';
import { ChessPieceGlyph, PIECE_LABELS } from './ChessPieceGlyph';

export type SelectionState =
  | { kind: 'tray'; piece: ReservePiece }
  | { kind: 'board'; from: Coord }
  | null;

interface GameBoardProps {
  state: GameState;
  playerSide?: PlayerColor | 'both';
  flipped?: boolean;
  selection: SelectionState;
  onSelectTrayPiece: (piece: ReservePiece) => void;
  onSquareClick: (coord: Coord) => void;
  disabled?: boolean;
  topLabel?: string;
  bottomLabel?: string;
  highlightSquare?: Coord | null;
}

const FILES = ['a', 'b', 'c', 'd'];
const RANKS = ['4', '3', '2', '1'];

export function GameBoard({
  state,
  playerSide = 'both',
  flipped = false,
  selection,
  onSelectTrayPiece,
  onSquareClick,
  disabled = false,
  topLabel,
  bottomLabel,
  highlightSquare = null,
}: GameBoardProps) {
  const legalTargets = useMemo(() => {
    if (disabled || state.status !== 'active') return [];
    if (selection?.kind === 'tray') {
      return getLegalDropsForPiece(state, selection.piece);
    }
    if (selection?.kind === 'board') {
      return getLegalMovesForSquare(state, selection.from);
    }
    return [];
  }, [disabled, selection, state]);

  const isTarget = (r: number, c: number) =>
    legalTargets.some((t) => t.row === r && t.col === c);

  const isWinningCell = (r: number, c: number) =>
    state.winningLine?.some((w) => w.row === r && w.col === c) ?? false;

  const isLastMoveCell = (r: number, c: number) =>
    (state.lastMove?.from?.row === r && state.lastMove?.from?.col === c) ||
    (state.lastMove?.to.row === r && state.lastMove?.to.col === c);

  const canInteractWithColor = (color: PlayerColor) =>
    !disabled &&
    state.status === 'active' &&
    state.turn === color &&
    (playerSide === 'both' || playerSide === color);

  const rowOrder = flipped ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const colOrder = flipped ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const topColor: PlayerColor = flipped ? 'white' : 'black';
  const bottomColor: PlayerColor = flipped ? 'black' : 'white';

  const renderTray = (color: PlayerColor, label?: string) => {
    const pieces = state.trays[color];
    const isTurn = state.status === 'active' && state.turn === color;
    const interactive = canInteractWithColor(color);

    return (
      <div className="w-full flex items-center justify-between gap-4 px-3 py-2.5 border border-neutral-800 bg-neutral-950/90">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-3.5 h-3.5 border ${
              color === 'white'
                ? 'bg-white border-white'
                : 'bg-neutral-950 border-neutral-400'
            } shrink-0`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-xs font-medium text-neutral-200 truncate">
              {label || (color === 'white' ? 'White' : 'Black')}
            </div>
            <div className="text-[11px] text-neutral-500 whitespace-nowrap">
              {isTurn ? 'Active turn' : 'Waiting'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pieces.length === 0 ? (
            <span className="text-xs text-neutral-600 font-mono-tabular px-2">
              All deployed
            </span>
          ) : (
            pieces.map((p) => {
              const selected =
                selection?.kind === 'tray' && selection.piece.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onSelectTrayPiece(p)}
                  title={`Deploy ${PIECE_LABELS[p.type]}`}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    selected
                      ? 'border-white bg-neutral-800 scale-105'
                      : interactive
                        ? 'border-neutral-700 bg-neutral-900 hover:border-neutral-400 cursor-pointer'
                        : 'border-neutral-800/80 bg-neutral-950 opacity-65 cursor-default'
                  }`}
                >
                  <ChessPieceGlyph
                    type={p.type}
                    color={p.color}
                    className="w-8 h-8"
                  />
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[460px] mx-auto flex flex-col gap-3 select-none">
      {renderTray(topColor, topLabel)}

      <div className="relative border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
        <div className="grid grid-cols-[20px_1fr] gap-2">
          {/* Rank numbers */}
          <div className="grid grid-rows-4 items-center text-center text-[11px] font-mono-tabular text-neutral-500">
            {rowOrder.map((r) => (
              <span key={r}>{RANKS[r]}</span>
            ))}
          </div>

          {/* 4x4 Grid */}
          <div className="relative aspect-square w-full border border-neutral-700 grid grid-cols-4 grid-rows-4 overflow-hidden">
            {rowOrder.map((r) =>
              colOrder.map((c) => {
                const isLight = (r + c) % 2 === 0;
                const cell = state.board[r][c];
                const target = isTarget(r, c);
                const selected =
                  selection?.kind === 'board' &&
                  selection.from.row === r &&
                  selection.from.col === c;
                const winCell = isWinningCell(r, c);
                const lastCell = isLastMoveCell(r, c);
                const guideHighlight =
                  highlightSquare?.row === r && highlightSquare?.col === c;
                const isCapture = target && cell !== null;
                const sqName = coordToAlgebraic({ row: r, col: c });

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    aria-label={`Square ${sqName}${cell ? ` ${cell.color} ${cell.type}` : ' empty'}`}
                    onClick={() => onSquareClick({ row: r, col: c })}
                    className={`relative flex items-center justify-center w-full h-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
                      winCell
                        ? 'bg-white text-black'
                        : isLight
                          ? 'bg-[#e8e8ea] text-black'
                          : 'bg-[#1a1a1d] text-white'
                    } ${
                      selected
                        ? 'ring-2 ring-inset ring-black/80 dark:ring-white'
                        : ''
                    }`}
                  >
                    {/* Last move subtle border */}
                    {lastCell && !winCell && (
                      <span
                        className={`pointer-events-none absolute inset-1 border ${
                          isLight ? 'border-black/35' : 'border-white/35'
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    {/* Selected highlight */}
                    {selected && (
                      <span
                        className={`pointer-events-none absolute inset-0.5 border-2 ${
                          isLight ? 'border-black' : 'border-white'
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    {/* Tutorial guidance pulse ring */}
                    {guideHighlight && (
                      <span
                        className={`pointer-events-none absolute inset-1.5 border-2 border-dashed ${
                          isLight ? 'border-black' : 'border-white'
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    {/* Piece Glyph */}
                    {cell && (
                      <motion.div
                        key={cell.id + cell.type}
                        initial={{ scale: 0.86, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 flex items-center justify-center"
                      >
                        <ChessPieceGlyph
                          type={cell.type}
                          color={cell.color}
                          className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-sm"
                        />
                        {cell.promotedFromPawn && cell.type === 'queen' && (
                          <span
                            className={`absolute -top-0.5 -right-1 text-[9px] font-mono-tabular font-semibold px-1 border ${
                              cell.color === 'white'
                                ? 'bg-black text-white border-white'
                                : 'bg-white text-black border-black'
                            }`}
                          >
                            Q
                          </span>
                        )}
                      </motion.div>
                    )}

                    {/* Legal Empty Destination Dot */}
                    {target && !isCapture && (
                      <span
                        className={`pointer-events-none z-20 w-3.5 h-3.5 rounded-full border ${
                          isLight
                            ? 'bg-black/80 border-white/60'
                            : 'bg-white/90 border-black/60'
                        }`}
                        aria-hidden="true"
                      />
                    )}

                    {/* Legal Capture Crosshair Reticle */}
                    {isCapture && (
                      <span
                        className="pointer-events-none absolute inset-1.5 z-20"
                        aria-hidden="true"
                      >
                        <span
                          className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${
                            isLight ? 'border-black' : 'border-white'
                          }`}
                        />
                        <span
                          className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${
                            isLight ? 'border-black' : 'border-white'
                          }`}
                        />
                        <span
                          className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${
                            isLight ? 'border-black' : 'border-white'
                          }`}
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${
                            isLight ? 'border-black' : 'border-white'
                          }`}
                        />
                      </span>
                    )}

                    {/* Winning cell subtle index marker */}
                    {winCell && (
                      <span
                        className="pointer-events-none absolute inset-1 border-2 border-black z-20"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* File letters */}
        <div className="grid grid-cols-[20px_1fr] gap-2 mt-1.5">
          <span />
          <div className="grid grid-cols-4 text-center text-[11px] font-mono-tabular text-neutral-500">
            {colOrder.map((c) => (
              <span key={c}>{FILES[c]}</span>
            ))}
          </div>
        </div>
      </div>

      {renderTray(bottomColor, bottomLabel)}
    </div>
  );
}
