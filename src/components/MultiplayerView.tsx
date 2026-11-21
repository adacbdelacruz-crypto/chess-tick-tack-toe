import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Flag,
  LogOut,
  Plus,
  RefreshCw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  countThreats,
  type Coord,
  type GameMove,
  type GameState,
  type PlayerColor,
  type ReservePiece,
} from '../shared/gameEngine';
import { GameBoard, type SelectionState } from './GameBoard';
import { soundEngine } from '../lib/soundEngine';
import { useAuth } from '../context/AuthContext';

interface LobbyRoomSummary {
  roomId: string;
  hostName: string;
  hostElo: number;
  createdAt: number;
}

interface RoomPlayerInfo {
  uid: string;
  displayName: string;
  elo: number;
  connected: boolean;
}

interface ActiveRoomPayload {
  id: string;
  state: GameState;
  white: RoomPlayerInfo | null;
  black: RoomPlayerInfo | null;
  rematchVotes: string[];
}

interface MultiplayerViewProps {
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export function MultiplayerView({ onOpenAuth }: MultiplayerViewProps) {
  const {
    firebaseUser,
    profile,
    soundEnabled,
    toggleSound,
    getIdToken,
    refreshProfile,
  } = useAuth();

  const wsRef = useRef<WebSocket | null>(null);
  const prevPlyRef = useRef<number>(0);

  const [wsStatus, setWsStatus] = useState<
    'disconnected' | 'connecting' | 'ready'
  >('disconnected');
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomPayload | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [eloDelta, setEloDelta] = useState<number | null>(null);

  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!firebaseUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus('disconnected');
      setActiveRoom(null);
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;

    const connect = async () => {
      if (cancelled) return;
      setWsStatus('connecting');
      const token = await getIdToken();
      if (!token || cancelled) return;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<
            string,
            unknown
          >;
          if (msg.type === 'auth:ok') {
            setWsStatus('ready');
            setRoomError(null);
            if (Array.isArray(msg.rooms)) {
              setLobbyRooms(msg.rooms as LobbyRoomSummary[]);
            }
          } else if (msg.type === 'auth:error') {
            setRoomError(String(msg.error || 'Authentication failed.'));
          } else if (msg.type === 'lobby:list') {
            setLobbyRooms((msg.rooms as LobbyRoomSummary[]) || []);
          } else if (msg.type === 'room:state') {
            const room = msg.room as ActiveRoomPayload;
            setActiveRoom(room);
            setRoomError(null);
            setSelection(null);

            const nextPly = room.state.ply;
            if (nextPly > prevPlyRef.current) {
              const last = room.state.moves[room.state.moves.length - 1];
              if (room.state.status === 'won') {
                const myColor =
                  room.white?.uid === firebaseUser.uid ? 'white' : 'black';
                if (room.state.winner === myColor) soundEngine.playVictory();
                else soundEngine.playDefeat();
              } else if (room.state.status === 'draw') {
                soundEngine.playDraw();
              } else if (last?.promoted) {
                soundEngine.playPromote();
              } else if (last?.captured) {
                soundEngine.playCapture();
              } else if (last?.kind === 'drop') {
                soundEngine.playPlace();
              } else {
                soundEngine.playMove();
              }
            }
            if (nextPly === 0 && prevPlyRef.current > 0) {
              setEloDelta(null);
            }
            prevPlyRef.current = nextPly;
          } else if (msg.type === 'room:elo') {
            setEloDelta(Number(msg.eloDelta ?? 0));
            void refreshProfile();
          } else if (msg.type === 'room:error') {
            setRoomError(String(msg.error || 'Room error.'));
            soundEngine.playInvalid();
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          setWsStatus('disconnected');
          reconnectTimer = window.setTimeout(() => void connect(), 2500);
        }
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [firebaseUser, getIdToken, refreshProfile]);

  const sendWs = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  if (!firebaseUser) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-16">
        <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-5">
          <Users className="w-8 h-8 mx-auto text-neutral-300" />
          <h1 className="font-display text-4xl font-semibold text-white">
            Ranked Online Multiplayer
          </h1>
          <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
            Sign in to host private match rooms, challenge open lobby
            opponents, and compete for global ELO ratings in real time.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-6 py-2.5 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Sign In to Play Online
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myColor: PlayerColor | undefined =
    activeRoom?.white?.uid === firebaseUser.uid
      ? 'white'
      : activeRoom?.black?.uid === firebaseUser.uid
        ? 'black'
        : undefined;

  const isMyTurn = Boolean(
    activeRoom &&
      activeRoom.white &&
      activeRoom.black &&
      activeRoom.state.status === 'active' &&
      myColor === activeRoom.state.turn
  );

  const handleSelectTray = (piece: ReservePiece) => {
    if (!isMyTurn || piece.color !== myColor) return;
    soundEngine.playSelect();
    setSelection((prev) =>
      prev?.kind === 'tray' && prev.piece.id === piece.id
        ? null
        : { kind: 'tray', piece }
    );
  };

  const handleSquareClick = (coord: Coord) => {
    if (!activeRoom || !isMyTurn || !myColor) return;
    const state = activeRoom.state;
    const cell = state.board[coord.row][coord.col];

    if (selection?.kind === 'tray') {
      if (cell && cell.color === myColor) {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const move: GameMove = {
        kind: 'drop',
        color: myColor,
        pieceId: selection.piece.id,
        pieceType: selection.piece.type,
        to: coord,
      };
      sendWs({ type: 'room:move', move });
      setSelection(null);
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
      if (cell && cell.color === myColor) {
        soundEngine.playSelect();
        setSelection({ kind: 'board', from: coord });
        return;
      }
      const movingPiece = state.board[selection.from.row][selection.from.col];
      if (!movingPiece) return;
      const move: GameMove = {
        kind: 'move',
        color: myColor,
        pieceId: movingPiece.id,
        pieceType: movingPiece.type,
        from: selection.from,
        to: coord,
      };
      sendWs({ type: 'room:move', move });
      setSelection(null);
      return;
    }

    if (cell && cell.color === myColor) {
      soundEngine.playSelect();
      setSelection({ kind: 'board', from: coord });
    }
  };

  if (activeRoom) {
    const state = activeRoom.state;
    const flipped = myColor === 'black';
    const whiteName = activeRoom.white
      ? `${activeRoom.white.displayName} (${activeRoom.white.elo})`
      : 'Waiting...';
    const blackName = activeRoom.black
      ? `${activeRoom.black.displayName} (${activeRoom.black.elo})`
      : 'Waiting for opponent...';
    const hasVotedRematch = activeRoom.rematchVotes.includes(firebaseUser.uid);
    const whiteThreats = countThreats(state.board, 'white');
    const blackThreats = countThreats(state.board, 'black');

    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Match Status */}
            <div className="w-full max-w-[460px] flex items-center justify-between gap-4 mb-3 pb-2 border-b border-neutral-800">
              <div className="text-sm font-medium text-white">
                {!activeRoom.black ? (
                  <span>Waiting for challenger in room {activeRoom.id}</span>
                ) : state.status === 'active' ? (
                  <span>
                    {isMyTurn
                      ? 'Your Turn'
                      : `${state.turn === 'white' ? 'White' : 'Black'} to act`}
                  </span>
                ) : state.status === 'won' ? (
                  <span>
                    {state.winner === myColor
                      ? 'Victory · Checkline Formed'
                      : 'Defeat · Opponent Completed Checkline'}
                  </span>
                ) : (
                  <span>Match Drawn</span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs font-mono-tabular text-neutral-400">
                {(whiteThreats > 0 || blackThreats > 0) &&
                  state.status === 'active' && (
                    <span className="text-white font-semibold">Threat</span>
                  )}
                <span>Ply {state.ply}</span>
              </div>
            </div>

            <GameBoard
              state={state}
              playerSide={myColor}
              flipped={flipped}
              selection={selection}
              onSelectTrayPiece={handleSelectTray}
              onSquareClick={handleSquareClick}
              disabled={!isMyTurn}
              topLabel={flipped ? whiteName : blackName}
              bottomLabel={flipped ? blackName : whiteName}
            />

            <div className="w-full max-w-[460px] flex flex-wrap items-center justify-between gap-2 mt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sendWs({ type: 'room:leave' });
                    setActiveRoom(null);
                    setEloDelta(null);
                    prevPlyRef.current = 0;
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Room</span>
                </button>

                {state.status === 'active' && activeRoom.black && (
                  <button
                    type="button"
                    onClick={() => sendWs({ type: 'room:resign' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Resign</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void toggleSound()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-neutral-800 text-neutral-300 hover:border-white hover:text-white transition-colors"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
              </button>
            </div>

            {state.status !== 'active' && (
              <div className="w-full max-w-[460px] mt-5 border border-white bg-neutral-950 p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-2xl font-semibold text-white">
                    {state.status === 'won'
                      ? state.winner === myColor
                        ? 'You Won'
                        : 'Opponent Won'
                      : 'Draw'}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 font-mono-tabular">
                    {eloDelta !== null
                      ? `Rating ${eloDelta >= 0 ? `+${eloDelta}` : eloDelta} ELO`
                      : 'Match archived to history'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={hasVotedRematch}
                  onClick={() => sendWs({ type: 'room:rematch' })}
                  className="px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {hasVotedRematch ? 'Waiting for Opponent...' : 'Rematch'}
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Room Code & Live Moves */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-neutral-500">Match Room Code</p>
                  <div className="font-mono-tabular text-2xl font-semibold tracking-widest text-white mt-1">
                    {activeRoom.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(activeRoom.id);
                    setCopiedCode(true);
                    window.setTimeout(() => setCopiedCode(false), 1800);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-neutral-700 text-neutral-200 hover:border-white transition-colors"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Share this room code with another signed-in player or wait for a
                challenger from the open lobby.
              </p>
              {roomError && (
                <div className="border border-neutral-700 bg-black px-3 py-2 text-xs text-neutral-200">
                  {roomError}
                </div>
              )}
            </div>

            <div className="border border-neutral-800 bg-neutral-950 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-white">
                  Live Notation
                </h2>
                <span className="text-xs font-mono-tabular text-neutral-500">
                  {state.moves.length} plies
                </span>
              </div>
              {state.moves.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center border border-dashed border-neutral-800">
                  White opens once both players are seated.
                </p>
              ) : (
                <div className="max-h-[260px] overflow-y-auto border border-neutral-800 bg-black divide-y divide-neutral-900">
                  {Array.from({
                    length: Math.ceil(state.moves.length / 2),
                  }).map((_, rowIdx) => {
                    const wMove = state.moves[rowIdx * 2];
                    const bMove = state.moves[rowIdx * 2 + 1];
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-800 pb-8">
        <div>
          <p className="text-xs text-neutral-500 mb-2">
            Real-Time Authoritative Arena · {profile?.displayName} ({profile?.elo ?? 1200} ELO)
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            Online Multiplayer Lobby
          </h1>
        </div>

        <button
          type="button"
          disabled={wsStatus !== 'ready'}
          onClick={() => sendWs({ type: 'room:create' })}
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Match Room</span>
        </button>
      </div>

      {roomError && (
        <div className="border border-neutral-700 bg-neutral-950 px-4 py-3 text-xs text-neutral-200">
          {roomError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Open Rooms */}
        <div className="lg:col-span-8 border border-neutral-800 bg-neutral-950 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold text-white">
              Open Rooms
            </h2>
            <button
              type="button"
              onClick={() => sendWs({ type: 'lobby:subscribe' })}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {lobbyRooms.length === 0 ? (
            <div className="border border-dashed border-neutral-800 py-12 px-6 text-center space-y-2">
              <p className="text-sm text-neutral-300">
                No open rooms right now.
              </p>
              <p className="text-xs text-neutral-500">
                Create a room above and share the code with a friend, or wait for
                another challenger to join.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 border border-neutral-800 bg-black">
              {lobbyRooms.map((room) => (
                <div
                  key={room.roomId}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {room.hostName}
                    </div>
                    <div className="text-xs font-mono-tabular text-neutral-500 mt-0.5">
                      {room.hostElo} ELO · Room {room.roomId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      sendWs({ type: 'room:join', roomId: room.roomId })
                    }
                    className="px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Join Match
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join by Code */}
        <div className="lg:col-span-4 border border-neutral-800 bg-neutral-950 p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-white">
            Join by Room Code
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Enter a 6-character code shared by your opponent to enter their
            board immediately.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!joinCode.trim()) return;
              sendWs({ type: 'room:join', roomId: joinCode.trim() });
            }}
            className="space-y-3"
          >
            <input
              type="text"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7M9P2"
              className="w-full px-3.5 py-2.5 bg-black border border-neutral-700 text-sm font-mono-tabular tracking-widest text-white placeholder:text-neutral-600 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={wsStatus !== 'ready' || !joinCode.trim()}
              className="w-full px-4 py-2.5 text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              Enter Room
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
