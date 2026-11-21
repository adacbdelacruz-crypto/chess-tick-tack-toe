import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
} from 'lucide-react';
import {
  applyMove,
  createInitialGameState,
  type GameState,
  type MoveRecord,
} from '../shared/gameEngine';
import { GameBoard } from './GameBoard';
import { useAuth } from '../context/AuthContext';

interface SavedMatchRow {
  id: number;
  opponentName: string;
  mode: string;
  difficulty: string | null;
  playerColor: string;
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  eloDelta: number;
  movesJson: string;
  durationSeconds: number;
  createdAt: string;
}

interface HistoryViewProps {
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export function HistoryView({ onOpenAuth }: HistoryViewProps) {
  const { firebaseUser, profile, getIdToken, updateHandle } = useAuth();
  const [matches, setMatches] = useState<SavedMatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<SavedMatchRow | null>(
    null
  );
  const [replayPly, setReplayPly] = useState(0);

  const loadHistory = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/matches', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        matches?: SavedMatchRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load match history.');
      }
      const list = data.matches || [];
      setMatches(list);
      if (list.length > 0 && !selectedMatch) {
        setSelectedMatch(list[0]);
        setReplayPly(0);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load match history.'
      );
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, getIdToken, selectedMatch]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const parsedMoves = useMemo((): MoveRecord[] => {
    if (!selectedMatch) return [];
    try {
      const parsed = JSON.parse(selectedMatch.movesJson);
      return Array.isArray(parsed) ? (parsed as MoveRecord[]) : [];
    } catch {
      return [];
    }
  }, [selectedMatch]);

  const replayState = useMemo((): GameState => {
    let state = createInitialGameState();
    const target = Math.min(replayPly, parsedMoves.length);
    for (let i = 0; i < target; i++) {
      const m = parsedMoves[i];
      if (!m) break;
      const pieceId =
        m.kind === 'drop'
          ? state.trays[m.color].find((p) => p.type === m.pieceType)?.id || ''
          : (m.from && state.board[m.from.row]?.[m.from.col]?.id) || '';
      if (!pieceId) break;

      const applied =
        m.kind === 'drop'
          ? applyMove(state, {
              kind: 'drop',
              color: m.color,
              pieceId,
              pieceType: m.pieceType as 'rook' | 'bishop' | 'knight' | 'pawn',
              to: m.to,
            })
          : m.from
            ? applyMove(state, {
                kind: 'move',
                color: m.color,
                pieceId,
                pieceType: m.pieceType,
                from: m.from,
                to: m.to,
              })
            : null;
      if (applied) {
        state = applied.nextState;
      }
    }
    return state;
  }, [parsedMoves, replayPly]);

  if (!firebaseUser) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-16">
        <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-5">
          <History className="w-8 h-8 mx-auto text-neutral-300" />
          <h1 className="font-display text-4xl font-semibold text-white">
            Match History &amp; Replay Archive
          </h1>
          <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
            Sign in to save every game automatically and review your moves
            step-by-step on the interactive replay board.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-6 py-2.5 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Sign In to View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 space-y-10">
      {/* Profile & Career Summary */}
      {profile && (
        <div className="border border-neutral-800 bg-neutral-950 p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 space-y-2">
            <p className="text-xs text-neutral-500">Player Record</p>
            {editingName ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNameError(null);
                  try {
                    await updateHandle(nameInput);
                    setEditingName(false);
                  } catch (err: unknown) {
                    setNameError(
                      err instanceof Error
                        ? err.message
                        : 'Failed to update handle.'
                    );
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  maxLength={32}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-3 py-1.5 bg-black border border-neutral-700 text-sm text-white focus:outline-none focus:border-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-black"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white">
                  {profile.displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(profile.displayName);
                    setEditingName(true);
                  }}
                  className="text-xs text-neutral-400 underline underline-offset-4 hover:text-white transition-colors"
                >
                  Edit Handle
                </button>
              </div>
            )}
            {nameError && (
              <p className="text-xs text-neutral-300">{nameError}</p>
            )}
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t lg:border-t-0 lg:border-l border-neutral-800 pt-4 lg:pt-0 lg:pl-6">
            <div>
              <div className="text-xs text-neutral-500">ELO Rating</div>
              <div className="font-mono-tabular text-2xl font-semibold text-white mt-1">
                {profile.elo}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Wins / Losses</div>
              <div className="font-mono-tabular text-2xl font-semibold text-white mt-1">
                {profile.wins} / {profile.losses}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Draws</div>
              <div className="font-mono-tabular text-2xl font-semibold text-white mt-1">
                {profile.draws}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">AI Mastery</div>
              <div className="font-mono-tabular text-xs text-neutral-300 mt-2 space-y-0.5">
                <div>
                  E {profile.aiWinsEasy} · I {profile.aiWinsIntermediate}
                </div>
                <div>
                  H {profile.aiWinsHard} · L {profile.aiWinsLegendary}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-200">
          {error}
        </div>
      )}

      {/* Match List + Interactive Replay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950">
          <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-white">
              Recorded Matches
            </h2>
            <span className="text-xs font-mono-tabular text-neutral-500">
              {matches.length} archived
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-neutral-400">
              Loading match archive...
            </div>
          ) : matches.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-500">
              No archived matches yet. Play against the AI or an online
              opponent to record your first game.
            </div>
          ) : (
            <div className="divide-y divide-neutral-900 max-h-[580px] overflow-y-auto">
              {matches.map((m) => {
                const active = selectedMatch?.id === m.id;
                const resultLabel =
                  m.result === 'win'
                    ? 'Victory'
                    : m.result === 'loss'
                      ? 'Defeat'
                      : 'Draw';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMatch(m);
                      setReplayPly(0);
                    }}
                    className={`w-full text-left px-6 py-4 flex items-center justify-between gap-4 transition-colors ${
                      active
                        ? 'bg-white text-black'
                        : 'text-white hover:bg-neutral-900/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        vs {m.opponentName}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          active ? 'text-neutral-700' : 'text-neutral-500'
                        }`}
                      >
                        {resultLabel} · Played {m.playerColor} · {m.moveCount}{' '}
                        plies
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono-tabular text-xs">
                      <div className="font-semibold">
                        {m.eloDelta > 0
                          ? `+${m.eloDelta}`
                          : m.eloDelta === 0
                            ? '0'
                            : m.eloDelta}{' '}
                        ELO
                      </div>
                      <div
                        className={
                          active ? 'text-neutral-600' : 'text-neutral-500'
                        }
                      >
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Replay Inspector */}
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-white">
              Board Replay
            </h2>
            {selectedMatch && (
              <span className="text-xs font-mono-tabular text-neutral-400">
                Ply {replayPly} / {parsedMoves.length}
              </span>
            )}
          </div>

          {selectedMatch ? (
            <>
              <GameBoard
                state={replayState}
                disabled
                selection={null}
                onSelectTrayPiece={() => {}}
                onSquareClick={() => {}}
                topLabel="Black"
                bottomLabel="White"
              />

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplayPly(0)}
                  disabled={replayPly === 0}
                  aria-label="Jump to start"
                  className="p-2.5 border border-neutral-700 text-white hover:border-white disabled:opacity-40"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplayPly((p) => Math.max(0, p - 1))}
                  disabled={replayPly === 0}
                  aria-label="Previous move"
                  className="p-2.5 border border-neutral-700 text-white hover:border-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReplayPly((p) => Math.min(parsedMoves.length, p + 1))
                  }
                  disabled={replayPly >= parsedMoves.length}
                  aria-label="Next move"
                  className="p-2.5 border border-neutral-700 text-white hover:border-white disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplayPly(parsedMoves.length)}
                  disabled={replayPly >= parsedMoves.length}
                  aria-label="Jump to end"
                  className="p-2.5 border border-neutral-700 text-white hover:border-white disabled:opacity-40"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-neutral-500">
              Select a recorded match to inspect its move sequence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
