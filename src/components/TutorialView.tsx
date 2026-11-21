import React, { useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import {
  applyMove,
  createInitialGameState,
  type Coord,
  type GameState,
  type ReservePiece,
} from '../shared/gameEngine';
import { GameBoard, type SelectionState } from './GameBoard';
import { ChessPieceGlyph } from './ChessPieceGlyph';
import { soundEngine } from '../lib/soundEngine';
import { useAuth } from '../context/AuthContext';

interface TutorialStep {
  id: number;
  title: string;
  summary: string;
  instruction: string;
  targetCoord: Coord;
  buildState: () => GameState;
  validateSuccess: (next: GameState) => boolean;
}

function buildStep1(): GameState {
  return createInitialGameState();
}

function buildStep2(): GameState {
  const s = createInitialGameState();
  s.trays.white = s.trays.white.filter((p) => p.id !== 'w-rook');
  s.trays.black = s.trays.black.filter(
    (p) => p.id !== 'b-bishop' && p.id !== 'b-knight' && p.id !== 'b-pawn'
  );
  s.board[1][0] = { id: 'w-rook', color: 'white', type: 'rook' };
  s.board[1][3] = { id: 'b-bishop', color: 'black', type: 'bishop' };
  s.board[0][3] = { id: 'b-knight', color: 'black', type: 'knight' };
  s.board[2][3] = { id: 'b-pawn', color: 'black', type: 'pawn' };
  return s;
}

function buildStep3(): GameState {
  const s = createInitialGameState();
  s.trays.white = s.trays.white.filter((p) => p.id !== 'w-pawn');
  s.board[1][2] = { id: 'w-pawn', color: 'white', type: 'pawn' };
  s.board[2][1] = { id: 'b-knight', color: 'black', type: 'knight' };
  s.trays.black = s.trays.black.filter((p) => p.id !== 'b-knight');
  return s;
}

function buildStep4(): GameState {
  const s = createInitialGameState();
  s.trays.white = s.trays.white.filter(
    (p) => p.id !== 'w-rook' && p.id !== 'w-bishop' && p.id !== 'w-knight'
  );
  s.board[3][0] = { id: 'w-rook', color: 'white', type: 'rook' };
  s.board[2][1] = { id: 'w-bishop', color: 'white', type: 'bishop' };
  s.board[1][2] = { id: 'w-knight', color: 'white', type: 'knight' };
  s.board[0][0] = { id: 'b-rook', color: 'black', type: 'rook' };
  s.board[3][3] = { id: 'b-knight', color: 'black', type: 'knight' };
  s.trays.black = s.trays.black.filter(
    (p) => p.id !== 'b-rook' && p.id !== 'b-knight'
  );
  return s;
}

const STEPS: TutorialStep[] = [
  {
    id: 1,
    title: '01. Deploying From Reserve',
    summary:
      'Every player begins with four Chess pieces in their tray: Rook, Bishop, Knight, and Pawn. On your turn, you may deploy a piece onto an empty square or move one already on the board.',
    instruction:
      'Select your White Knight from the bottom tray and deploy it onto square b2.',
    targetCoord: { row: 2, col: 1 },
    buildState: buildStep1,
    validateSuccess: (next) =>
      next.board[2][1]?.type === 'knight' && next.board[2][1]?.color === 'white',
  },
  {
    id: 2,
    title: '02. Chess Captures & Return to Tray',
    summary:
      'Pieces move and capture using classical Chess rules. Capturing an opponent removes their piece from the board and returns it to their reserve tray—breaking their line.',
    instruction:
      'Black threatens 4-in-a-row on the d-file. Select your White Rook on a3 and capture the Black Bishop on d3.',
    targetCoord: { row: 1, col: 3 },
    buildState: buildStep2,
    validateSuccess: (next) =>
      next.board[1][3]?.type === 'rook' && next.board[1][3]?.color === 'white',
  },
  {
    id: 3,
    title: '03. Pawn Advance & Queen Promotion',
    summary:
      'Pawns step one square forward and capture diagonally forward. They cannot be dropped directly on the opponent back rank—but marching them there promotes them into a Queen.',
    instruction:
      'Select your White Pawn on c3 and advance it to c4 to promote it into a Queen.',
    targetCoord: { row: 0, col: 2 },
    buildState: buildStep3,
    validateSuccess: (next) =>
      next.board[0][2]?.type === 'queen' && next.board[0][2]?.color === 'white',
  },
  {
    id: 4,
    title: '04. Forming the Checkline',
    summary:
      'Align all four of your pieces horizontally, vertically, or diagonally to win immediately. Watch both the board and your opponent’s reserve tray for instant drop threats.',
    instruction:
      'Deploy your White Pawn onto d4? Wait: Pawns cannot drop on rank 4. Instead, move your White Knight or deploy a piece—look at the diagonal a1–d4: deploy your Pawn? No, move your Knight to d4? Actually, deploy your Pawn onto d4 is illegal, so look closely: move Knight from c3? Wait—White Pawn is in tray; let’s move the White Knight or use Queen!',
    targetCoord: { row: 0, col: 3 },
    buildState: () => {
      const s = createInitialGameState();
      s.trays.white = s.trays.white.filter(
        (p) =>
          p.id !== 'w-rook' &&
          p.id !== 'w-bishop' &&
          p.id !== 'w-knight' &&
          p.id !== 'w-pawn'
      );
      s.board[3][0] = { id: 'w-rook', color: 'white', type: 'rook' };
      s.board[2][1] = { id: 'w-bishop', color: 'white', type: 'bishop' };
      s.board[1][2] = {
        id: 'w-pawn',
        color: 'white',
        type: 'queen',
        promotedFromPawn: true,
      };
      s.board[2][2] = { id: 'w-knight', color: 'white', type: 'knight' };
      s.board[0][0] = { id: 'b-rook', color: 'black', type: 'rook' };
      s.board[3][3] = { id: 'b-knight', color: 'black', type: 'knight' };
      s.trays.black = s.trays.black.filter(
        (p) => p.id !== 'b-rook' && p.id !== 'b-knight'
      );
      return s;
    },
    validateSuccess: (next) => next.status === 'won' && next.winner === 'white',
  },
];

STEPS[3].instruction =
  'Select your White Knight on c2 and leap to d4 to complete the a1–d4 diagonal Checkline.';

interface TutorialViewProps {
  onFinishToArena: () => void;
}

export function TutorialView({ onFinishToArena }: TutorialViewProps) {
  const { markTutorialCompleted } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [boardState, setBoardState] = useState<GameState>(() =>
    STEPS[0].buildState()
  );
  const [selection, setSelection] = useState<SelectionState>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const step = STEPS[stepIdx];
  const isStepDone = Boolean(completedSteps[step.id]);

  const loadStep = (idx: number) => {
    setStepIdx(idx);
    setBoardState(STEPS[idx].buildState());
    setSelection(null);
    setFeedback(null);
  };

  const handleSelectTray = (piece: ReservePiece) => {
    if (isStepDone) return;
    soundEngine.playSelect();
    setSelection({ kind: 'tray', piece });
    setFeedback(null);
  };

  const handleSquareClick = (coord: Coord) => {
    if (isStepDone) return;
    const cell = boardState.board[coord.row][coord.col];

    if (selection?.kind === 'tray') {
      if (cell && cell.color === 'white') {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const res = applyMove(boardState, {
        kind: 'drop',
        color: 'white',
        pieceId: selection.piece.id,
        pieceType: selection.piece.type,
        to: coord,
      });
      if (!res) {
        soundEngine.playInvalid();
        setFeedback('That piece cannot be placed there. Check the highlighted target square.');
        return;
      }
      if (step.validateSuccess(res.nextState)) {
        soundEngine.playPromote();
        setBoardState(res.nextState);
        setSelection(null);
        setCompletedSteps((prev) => ({ ...prev, [step.id]: true }));
        setFeedback('Objective complete.');
        if (stepIdx === STEPS.length - 1) {
          void markTutorialCompleted();
        }
      } else {
        soundEngine.playInvalid();
        setFeedback('Try the highlighted target square to complete this exercise.');
      }
      return;
    }

    if (selection?.kind === 'board') {
      if (
        selection.from.row === coord.row &&
        selection.from.col === coord.col
      ) {
        setSelection(null);
        return;
      }
      if (cell && cell.color === 'white') {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const movingPiece = boardState.board[selection.from.row][selection.from.col];
      if (!movingPiece) return;

      const res = applyMove(boardState, {
        kind: 'move',
        color: 'white',
        pieceId: movingPiece.id,
        pieceType: movingPiece.type,
        from: selection.from,
        to: coord,
      });
      if (!res) {
        soundEngine.playInvalid();
        setFeedback('Illegal move for this piece. Follow the legal move dots.');
        return;
      }
      if (step.validateSuccess(res.nextState)) {
        if (res.record.isWinning) soundEngine.playVictory();
        else if (res.record.promoted) soundEngine.playPromote();
        else if (res.record.captured) soundEngine.playCapture();
        else soundEngine.playMove();
        setBoardState(res.nextState);
        setSelection(null);
        setCompletedSteps((prev) => ({ ...prev, [step.id]: true }));
        setFeedback('Objective complete.');
        if (stepIdx === STEPS.length - 1) {
          void markTutorialCompleted();
        }
      } else {
        soundEngine.playInvalid();
        setFeedback('Good legal move, but aim for the dashed target square.');
      }
      return;
    }

    if (cell && cell.color === 'white') {
      soundEngine.playSelect();
      setSelection({ kind: 'board', from: coord });
      setFeedback(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-12">
      {/* Header Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-neutral-800 pb-10">
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <p className="text-xs text-neutral-500 mb-2">
              Interactive Field Manual · 4 Lessons
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white text-balance mb-4">
              Master the Hybrid Board
            </h1>
            <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
              Checkline fuses the classical geometry of Chess with the relentless
              line-making pressure of Tic-Tac-Toe. Practice all four core tactics
              below before entering rated play.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-6">
            {STEPS.map((s, idx) => {
              const active = idx === stepIdx;
              const done = Boolean(completedSteps[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadStep(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-black border-white'
                      : done
                        ? 'bg-neutral-900 text-white border-neutral-600'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {done && <Check className="w-3.5 h-3.5" />}
                  <span>Step 0{s.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 relative overflow-hidden border border-neutral-800 bg-neutral-950 min-h-[200px]">
          <img
            src="/src/assets/images/tutorial_tactics_diagram_1795260033592.jpg"
            alt="Four sculptural monochrome chess pieces aligned diagonally on slate"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-xs text-neutral-300">
            Four aligned pieces of the same color claim victory immediately.
          </div>
        </div>
      </div>

      {/* Interactive Drill */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6">
          <GameBoard
            state={boardState}
            playerSide="white"
            selection={selection}
            onSelectTrayPiece={handleSelectTray}
            onSquareClick={handleSquareClick}
            highlightSquare={isStepDone ? null : step.targetCoord}
            topLabel="Tutorial Bot"
            bottomLabel="Your Pieces (White)"
          />
        </div>

        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-7 space-y-6">
          <div>
            <p className="text-xs font-mono-tabular text-neutral-500 mb-1.5">
              Lesson {step.id} of {STEPS.length}
            </p>
            <h2 className="font-display text-3xl font-semibold text-white mb-3">
              {step.title}
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {step.summary}
            </p>
          </div>

          <div className="border border-neutral-800 bg-black p-4">
            <div className="text-xs font-semibold text-white mb-1">
              Exercise Objective
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {step.instruction}
            </p>
          </div>

          {feedback && (
            <div
              className={`border px-4 py-3 text-sm ${
                isStepDone
                  ? 'border-white bg-white text-black font-medium'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-200'
              }`}
            >
              {feedback}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => loadStep(stepIdx)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-neutral-700 text-neutral-300 hover:border-white hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Board</span>
            </button>

            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => loadStep(stepIdx + 1)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold transition-colors ${
                  isStepDone
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:border-white hover:text-white'
                }`}
              >
                <span>Next Lesson</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void markTutorialCompleted();
                  onFinishToArena();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
              >
                <span>Enter the Arena</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Piece Codex */}
      <div className="border-t border-neutral-800 pt-10">
        <h2 className="font-display text-2xl font-semibold text-white mb-6">
          Piece Movement &amp; Rules Reference
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              type: 'rook' as const,
              title: 'Rook',
              desc: 'Slides any unobstructed distance horizontally or vertically.',
            },
            {
              type: 'bishop' as const,
              title: 'Bishop',
              desc: 'Slides any unobstructed distance along diagonals.',
            },
            {
              type: 'knight' as const,
              title: 'Knight',
              desc: 'Leaps in an L-shape (2×1) and jumps over blocking pieces.',
            },
            {
              type: 'pawn' as const,
              title: 'Pawn',
              desc: 'Moves 1 forward, captures 1 diagonally forward. Cannot drop on rank 4.',
            },
            {
              type: 'queen' as const,
              title: 'Promoted Queen',
              desc: 'Reaching the opponent back rank promotes a Pawn into an omnidirectional Queen.',
            },
          ].map((item) => (
            <div
              key={item.type}
              className="border border-neutral-800 bg-neutral-950 p-5 flex flex-col gap-3"
            >
              <ChessPieceGlyph
                type={item.type}
                color="white"
                className="w-10 h-10"
              />
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
