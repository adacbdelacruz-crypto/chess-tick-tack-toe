import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Flag,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  applyMove,
  countThreats,
  createInitialGameState,
  opponentColor,
  type Coord,
  type DifficultyLevel,
  type GameState,
  type PlayerColor,
  type ReservePiece,
} from '../shared/gameEngine';
import { chooseAIMove } from '../shared/aiEngine';
import { GameBoard, type SelectionState } from './GameBoard';
import { soundEngine } from '../lib/soundEngine';
import { useAuth } from '../context/AuthContext';
import { saveFirestoreMatchBookmark } from '../lib/firestoreSync';

const DIFFICULTIES: Array<{
  id: DifficultyLevel;
  label: string;
  elo: number;
  summary: string;
}> = [
  {
    id: 'easy',
    label: 'Easy',
    elo: 900,
    summary: 'Relaxed tactics for learning openings and piece drops.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    elo: 1200,
    summary: 'Blocks 3-in-a-row threats and spots direct captures.',
  },
  {
    id: 'hard',
    label: 'Hard',
    elo: 1500,
    summary: '4-ply tactical search with positional line pressure.',
  },
  {
    id: 'legendary',
    label: 'Legendary',
    elo: 1850,
    summary: 'Deep iterative engine with transposition memory.',
  },
];

interface SoloArenaViewProps {
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  onOpenTutorial: () => void;
}

export function SoloArenaView({
  onOpenAuth,
  onOpenTutorial,
}: SoloArenaViewProps) {
  const {
    firebaseUser,
    profile,
    soundEnabled,
    toggleSound,
    getIdToken,
    refreshProfile,
  } = useAuth();

  const [mode, setMode] = useState<'ai' | 'local'>('ai');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
  const [humanColor, setHumanColor] = useState<PlayerColor>('white');
  const [flipped, setFlipped] = useState(false);

  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState()
  );
  const [selection, setSelection] = useState<SelectionState>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [lastEloDelta, setLastEloDelta] = useState<number | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const savedForMatchRef = useRef<boolean>(false);

  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const startNewGame = useCallback(
    (nextColor: PlayerColor = humanColor) => {
      setGameState(createInitialGameState());
      setSelection(null);
      setAiThinking(false);
      setLastEloDelta(null);
      savedForMatchRef.current = false;
      startTimeRef.current = Date.now();
      setFlipped(mode === 'ai' && nextColor === 'black');
    },
    [humanColor, mode]
  );

  const playSoundForOutcome = useCallback(
    (next: GameState, record: { captured?: string; promoted?: boolean; kind: string }) => {
      if (next.status === 'won') {
        if (mode === 'ai') {
          if (next.winner === humanColor) soundEngine.playVictory();
          else soundEngine.playDefeat();
        } else {
          soundEngine.playVictory();
        }
        return;
      }
      if (next.status === 'draw') {
        soundEngine.playDraw();
        return;
      }
      if (record.promoted) {
        soundEngine.playPromote();
      } else if (record.captured) {
        soundEngine.playCapture();
      } else if (record.kind === 'drop') {
        soundEngine.playPlace();
      } else {
        soundEngine.playMove();
      }

      const activeThreats =
        countThreats(next.board, 'white') + countThreats(next.board, 'black');
      if (activeThreats > 0) {
        soundEngine.playThreat();
      }
    },
    [humanColor, mode]
  );

  const persistCompletedMatch = useCallback(
    async (finalState: GameState) => {
      if (savedForMatchRef.current || !firebaseUser) return;
      savedForMatchRef.current = true;
      setSavingMatch(true);

      const playerCol = mode === 'ai' ? humanColor : 'white';
      const result: 'win' | 'loss' | 'draw' =
        finalState.status === 'draw'
          ? 'draw'
          : finalState.winner === playerCol
            ? 'win'
            : 'loss';

      const oppName =
        mode === 'ai'
          ? `AI · ${DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? difficulty}`
          : 'Local Challenger';

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startTimeRef.current) / 1000)
      );

      try {
        const token = await getIdToken();
        if (!token) return;

        const res = await fetch('/api/matches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            opponentName: oppName,
            mode,
            difficulty: mode === 'ai' ? difficulty : null,
            playerColor: playerCol,
            result,
            moveCount: Math.max(1, finalState.ply),
            moves: finalState.moves,
            durationSeconds,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            eloDelta: number;
            match: { id: number };
          };
          setLastEloDelta(data.eloDelta);
          await refreshProfile();

          if (firebaseUser.emailVerified) {
            try {
              await saveFirestoreMatchBookmark({
                uid: firebaseUser.uid,
                matchId: `sql_${data.match.id}`,
                opponentName: oppName,
                mode,
                difficulty: mode === 'ai' ? difficulty : null,
                playerColor: playerCol,
                result,
                moveCount: Math.max(1, finalState.ply),
                eloDelta: data.eloDelta,
              });
            } catch (fsErr) {
              console.warn('Firestore match bookmark skipped:', fsErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to save match:', err);
      } finally {
        setSavingMatch(false);
      }
    },
    [difficulty, firebaseUser, getIdToken, humanColor, mode, refreshProfile]
  );

  // Trigger AI move when it is AI's turn
  useEffect(() => {
    if (
      mode !== 'ai' ||
      gameState.status !== 'active' ||
      gameState.turn === humanColor
    ) {
      return;
    }

    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const aiMove = chooseAIMove(gameState, difficulty);
      if (aiMove) {
        const res = applyMove(gameState, aiMove);
        if (res) {
          setGameState(res.nextState);
          playSoundForOutcome(res.nextState, res.record);
          if (res.nextState.status !== 'active') {
            void persistCompletedMatch(res.nextState);
          }
        }
      }
      setAiThinking(false);
    }, 480);

    return () => window.clearTimeout(timer);
  }, [
    difficulty,
    gameState,
    humanColor,
    mode,
    persistCompletedMatch,
    playSoundForOutcome,
  ]);

  const handleSelectTrayPiece = (piece: ReservePiece) => {
    if (gameState.status !== 'active' || aiThinking) return;
    if (mode === 'ai' && gameState.turn !== humanColor) return;
    if (piece.color !== gameState.turn) return;

    soundEngine.playSelect();
    setSelection((prev) =>
      prev?.kind === 'tray' && prev.piece.id === piece.id
        ? null
        : { kind: 'tray', piece }
    );
  };

  const handleSquareClick = (coord: Coord) => {
    if (gameState.status !== 'active' || aiThinking) return;
    if (mode === 'ai' && gameState.turn !== humanColor) return;

    const activeColor = gameState.turn;
    const cell = gameState.board[coord.row][coord.col];

    if (selection?.kind === 'tray') {
      if (cell && cell.color === activeColor) {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const res = applyMove(gameState, {
        kind: 'drop',
        color: activeColor,
        pieceId: selection.piece.id,
        pieceType: selection.piece.type,
        to: coord,
      });
      if (!res) {
        soundEngine.playInvalid();
        return;
      }
      setSelection(null);
      setGameState(res.nextState);
      playSoundForOutcome(res.nextState, res.record);
      if (res.nextState.status !== 'active') {
        void persistCompletedMatch(res.nextState);
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
      if (cell && cell.color === activeColor) {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const movingPiece =
        gameState.board[selection.from.row][selection.from.col];
      if (!movingPiece) return;

      const res = applyMove(gameState, {
        kind: 'move',
        color: activeColor,
        pieceId: movingPiece.id,
        pieceType: movingPiece.type,
        from: selection.from,
        to: coord,
      });
      if (!res) {
        soundEngine.playInvalid();
        return;
      }
      setSelection(null);
      setGameState(res.nextState);
      playSoundForOutcome(res.nextState, res.record);
      if (res.nextState.status !== 'active') {
        void persistCompletedMatch(res.nextState);
      }
      return;
    }

    if (cell && cell.color === activeColor) {
      soundEngine.playSelect();
      setSelection({ kind: 'board', from: coord });
    }
  };

  const handleResign = () => {
    if (gameState.status !== 'active' || gameState.ply === 0) return;
    const loser = mode === 'ai' ? humanColor : gameState.turn;
    const winner = opponentColor(loser);
    const resignedState: GameState = {
      ...gameState,
      status: 'won',
      winner,
    };
    setGameState(resignedState);
    setSelection(null);
    soundEngine.playDefeat();
    void persistCompletedMatch(resignedState);
  };

  const whiteThreats = countThreats(gameState.board, 'white');
  const blackThreats = countThreats(gameState.board, 'black');
  const activeDiff = DIFFICULTIES.find((d) => d.id === difficulty)!;

  const topLabel =
    mode === 'ai'
      ? flipped
        ? `${profile?.displayName || 'You'} (White)`
        : `${activeDiff.label} AI (${activeDiff.elo})`
      : flipped
        ? 'Player 1 (White)'
        : 'Player 2 (Black)';

  const bottomLabel =
    mode === 'ai'
      ? flipped
        ? `${activeDiff.label} AI (${activeDiff.elo})`
        : `${profile?.displayName || 'You'} (White)`
      : flipped
        ? 'Player 2 (Black)'
        : 'Player 1 (White)';

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-8 space-y-10">
      {/* Editorial Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-neutral-800 pb-8">
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs text-neutral-500 mb-2">
              4×4 Tactical Arena · Chess Movement × Four-in-a-Row
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white text-balance">
              Every Square Is a Threat. Every Capture Shifts the Line.
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            <span>Deploy Rook, Bishop, Knight &amp; Pawn</span>
            <span aria-hidden="true">·</span>
            <span>Promote Pawns on the Back Rank</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onOpenTutorial}
              className="text-white underline underline-offset-4 hover:text-neutral-300 transition-colors"
            >
              Learn Rules in 2 Minutes
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 relative overflow-hidden border border-neutral-800 bg-neutral-950 min-h-[170px]">
          <img
            src="/src/assets/images/monolith_hero_board_1795260033987.jpg"
            alt="Monochrome architectural chessboard with sculptural black and white pieces"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        </div>
      </section>

      {/* Main Play Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left/Center: Active 4x4 Game Board */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Compact Turn & Threat Status Bar */}
          <div className="w-full max-w-[460px] flex items-center justify-between gap-4 mb-3 pb-2 border-b border-neutral-800">
            <div className="text-sm font-medium text-white">
              {gameState.status === 'active' ? (
                <span>
                  {aiThinking
                    ? `${activeDiff.label} AI calculating...`
                    : `${gameState.turn === 'white' ? 'White' : 'Black'} to act`}
                </span>
              ) : gameState.status === 'won' ? (
                <span>
                  {gameState.winner === 'white' ? 'White' : 'Black'} wins by
                  Checkline
                </span>
              ) : (
                <span>
                  Draw ({gameState.drawReason?.replace('_', ' ')})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs font-mono-tabular text-neutral-400">
              {(whiteThreats > 0 || blackThreats > 0) &&
                gameState.status === 'active' && (
                  <span className="text-white font-semibold">
                    {whiteThreats > 0 ? `W Threat (${whiteThreats})` : ''}
                    {whiteThreats > 0 && blackThreats > 0 ? ' · ' : ''}
                    {blackThreats > 0 ? `B Threat (${blackThreats})` : ''}
                  </span>
                )}
              <span>Ply {gameState.ply}</span>
            </div>
          </div>

          <GameBoard
            state={gameState}
            playerSide={mode === 'ai' ? humanColor : 'both'}
            flipped={flipped}
            selection={selection}
            onSelectTrayPiece={handleSelectTrayPiece}
            onSquareClick={handleSquareClick}
            disabled={aiThinking}
            topLabel={topLabel}
            bottomLabel={bottomLabel}
          />

          {/* Board Controls */}
          <div className="w-full max-w-[460px] flex flex-wrap items-center justify-between gap-2 mt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startNewGame()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white text-black hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {gameState.status === 'active' ? 'Restart' : 'Play Again'}
                </span>
              </button>

              {gameState.status === 'active' && gameState.ply > 0 && (
                <button
                  type="button"
                  onClick={handleResign}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Resign</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                title="Flip board perspective"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Flip</span>
              </button>

              <button
                type="button"
                onClick={() => void toggleSound()}
                title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
              </button>
            </div>
          </div>

          {/* Match Outcome Summary Banner */}
          {gameState.status !== 'active' && (
            <div className="w-full max-w-[460px] mt-5 border border-white bg-neutral-950 p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-2xl font-semibold text-white">
                    {gameState.status === 'won'
                      ? `${gameState.winner === 'white' ? 'White' : 'Black'} Victory`
                      : 'Match Drawn'}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Completed in {gameState.ply} plies
                    {lastEloDelta !== null &&
                      ` · Rating ${lastEloDelta >= 0 ? `+${lastEloDelta}` : lastEloDelta} ELO`}
                    {savingMatch && ' · Saving record...'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startNewGame()}
                  className="px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
                >
                  Play Again
                </button>
              </div>
              {!firebaseUser && (
                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs text-neutral-400">
                  <span>Sign in to save match history and climb the leaderboard.</span>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signup')}
                    className="text-white font-medium underline underline-offset-4 whitespace-nowrap shrink-0"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Configuration & Live Move Log */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mode Switch */}
          <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-white">
                Match Configuration
              </h2>
              <div className="flex items-center gap-1 p-1 bg-black border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('ai');
                    setGameState(createInitialGameState());
                    setSelection(null);
                    savedForMatchRef.current = false;
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'ai'
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Battle AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('local');
                    setFlipped(false);
                    setGameState(createInitialGameState());
                    setSelection(null);
                    savedForMatchRef.current = false;
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'local'
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Pass &amp; Play
                </button>
              </div>
            </div>

            {mode === 'ai' ? (
              <div className="space-y-5">
                {/* Side Selection */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  <span className="text-xs font-medium text-neutral-400">
                    Your Side
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-black border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => {
                        setHumanColor('white');
                        setFlipped(false);
                        startNewGame('white');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        humanColor === 'white'
                          ? 'bg-white text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      White (First)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHumanColor('black');
                        setFlipped(true);
                        startNewGame('black');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        humanColor === 'black'
                          ? 'bg-white text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Black (Second)
                    </button>
                  </div>
                </div>

                {/* AI Difficulty Tiers */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-400">
                      Opponent Intelligence
                    </span>
                    <span className="text-xs font-mono-tabular text-neutral-500">
                      Rating {activeDiff.elo}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DIFFICULTIES.map((tier) => {
                      const active = difficulty === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => {
                            setDifficulty(tier.id);
                            startNewGame();
                          }}
                          className={`text-left p-3.5 border transition-colors ${
                            active
                              ? 'border-white bg-white text-black'
                              : 'border-neutral-800 bg-black text-white hover:border-neutral-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {tier.label}
                            </span>
                            <span
                              className={`text-[11px] font-mono-tabular ${
                                active ? 'text-neutral-700' : 'text-neutral-500'
                              }`}
                            >
                              {tier.elo}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-snug ${
                              active ? 'text-neutral-700' : 'text-neutral-400'
                            }`}
                          >
                            {tier.summary}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Featured Monochrome Art Card */}
                <div className="flex items-center gap-4 pt-3 border-t border-neutral-800">
                  <img
                    src="/src/assets/images/ai_tier_master_1795260033387.jpg"
                    alt="Monochrome engraving of a geometric chess king"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 object-cover border border-neutral-700 shrink-0"
                  />
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    Defeating higher AI tiers awards larger ELO gains on the
                    global leaderboard.
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 leading-relaxed">
                Two players alternate turns on the same screen. White moves
                first; use Flip to orient the board between turns if desired.
              </p>
            )}
          </div>

          {/* Live Notation Log */}
          <div className="border border-neutral-800 bg-neutral-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-white">
                Move Notation
              </h2>
              <span className="text-xs font-mono-tabular text-neutral-500">
                {gameState.moves.length} plies
              </span>
            </div>

            {gameState.moves.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center border border-dashed border-neutral-800">
                Select a piece from the White tray to make the opening drop.
              </p>
            ) : (
              <div className="max-h-[240px] overflow-y-auto border border-neutral-800 bg-black divide-y divide-neutral-900">
                {Array.from({
                  length: Math.ceil(gameState.moves.length / 2),
                }).map((_, rowIdx) => {
                  const wMove = gameState.moves[rowIdx * 2];
                  const bMove = gameState.moves[rowIdx * 2 + 1];
                  return (
                    <div
                      key={rowIdx}
                      className="grid grid-cols-[44px_1fr_1fr] items-center px-3 py-2 text-xs font-mono-tabular"
                    >
                      <span className="text-neutral-600">{rowIdx + 1}.</span>
                      <span className="text-white">{wMove?.notation}</span>
                      <span className="text-neutral-400">
                        {bMove?.notation || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
