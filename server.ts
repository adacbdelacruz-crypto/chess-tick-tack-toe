import http from 'http';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  getLeaderboard,
  getOrCreateUser,
  updateDisplayName,
} from './src/db/users.ts';
import {
  getUserMatchHistory,
  recordMatchAndUpdateStats,
} from './src/db/matches.ts';
import {
  applyMove,
  createInitialGameState,
  opponentColor,
  type DifficultyLevel,
  type GameMode,
  type GameMove,
  type GameState,
  type PlayerColor,
} from './src/shared/gameEngine.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const entries = await getLeaderboard(50);
    res.json({ leaderboard: entries });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to load leaderboard';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@player.local`;
    const name = req.user!.name;
    const user = await getOrCreateUser(uid, email, name);
    res.json({
      user: {
        id: user.id,
        uid: user.uid,
        displayName: user.displayName,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        aiWinsEasy: user.aiWinsEasy,
        aiWinsIntermediate: user.aiWinsIntermediate,
        aiWinsHard: user.aiWinsHard,
        aiWinsLegendary: user.aiWinsLegendary,
      },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to load player profile';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { displayName } = req.body as { displayName?: unknown };
    if (typeof displayName !== 'string' || displayName.trim().length < 2) {
      return res
        .status(400)
        .json({ error: 'Display name must be between 2 and 32 characters.' });
    }
    const updated = await updateDisplayName(req.user!.uid, displayName);
    if (!updated) {
      return res.status(404).json({ error: 'Player profile not found.' });
    }
    res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        displayName: updated.displayName,
        elo: updated.elo,
        wins: updated.wins,
        losses: updated.losses,
        draws: updated.draws,
        aiWinsEasy: updated.aiWinsEasy,
        aiWinsIntermediate: updated.aiWinsIntermediate,
        aiWinsHard: updated.aiWinsHard,
        aiWinsLegendary: updated.aiWinsLegendary,
      },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to update display name';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/matches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const history = await getUserMatchHistory(req.user!.uid, 30);
    res.json({ matches: history });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to load match history';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/matches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@player.local`;
    await getOrCreateUser(uid, email, req.user!.name);

    const body = req.body as {
      opponentName?: unknown;
      mode?: unknown;
      difficulty?: unknown;
      playerColor?: unknown;
      result?: unknown;
      moveCount?: unknown;
      moves?: unknown;
      durationSeconds?: unknown;
    };

    const allowedModes: GameMode[] = ['ai', 'local'];
    if (
      typeof body.mode !== 'string' ||
      !allowedModes.includes(body.mode as GameMode)
    ) {
      return res.status(400).json({ error: 'Invalid match mode.' });
    }

    const allowedDiffs: DifficultyLevel[] = [
      'easy',
      'intermediate',
      'hard',
      'legendary',
    ];
    let difficulty: DifficultyLevel | null = null;
    if (body.mode === 'ai') {
      if (
        typeof body.difficulty !== 'string' ||
        !allowedDiffs.includes(body.difficulty as DifficultyLevel)
      ) {
        return res.status(400).json({ error: 'Invalid AI difficulty tier.' });
      }
      difficulty = body.difficulty as DifficultyLevel;
    }

    if (body.playerColor !== 'white' && body.playerColor !== 'black') {
      return res.status(400).json({ error: 'Invalid player color.' });
    }

    if (
      body.result !== 'win' &&
      body.result !== 'loss' &&
      body.result !== 'draw'
    ) {
      return res.status(400).json({ error: 'Invalid match result.' });
    }

    if (typeof body.opponentName !== 'string' || !body.opponentName.trim()) {
      return res.status(400).json({ error: 'Opponent name is required.' });
    }

    const moveCount =
      typeof body.moveCount === 'number' && Number.isFinite(body.moveCount)
        ? Math.max(1, Math.min(Math.round(body.moveCount), 500))
        : 1;
    const durationSeconds =
      typeof body.durationSeconds === 'number' &&
      Number.isFinite(body.durationSeconds)
        ? Math.max(0, Math.min(Math.round(body.durationSeconds), 86400))
        : 0;

    const movesArray = Array.isArray(body.moves) ? body.moves.slice(0, 200) : [];
    const movesJson = JSON.stringify(movesArray);

    const saved = await recordMatchAndUpdateStats({
      uid,
      opponentName: body.opponentName.trim(),
      opponentUid: null,
      mode: body.mode as GameMode,
      difficulty,
      playerColor: body.playerColor,
      result: body.result,
      moveCount,
      movesJson,
      durationSeconds,
    });

    res.json({
      match: saved.match,
      eloDelta: saved.eloDelta,
      user: {
        id: saved.user.id,
        uid: saved.user.uid,
        displayName: saved.user.displayName,
        elo: saved.user.elo,
        wins: saved.user.wins,
        losses: saved.user.losses,
        draws: saved.user.draws,
        aiWinsEasy: saved.user.aiWinsEasy,
        aiWinsIntermediate: saved.user.aiWinsIntermediate,
        aiWinsHard: saved.user.aiWinsHard,
        aiWinsLegendary: saved.user.aiWinsLegendary,
      },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to save match';
    res.status(500).json({ error: msg });
  }
});

// --- Real-Time Authoritative WebSocket Multiplayer ---

interface ConnectedClient {
  ws: WebSocket;
  uid: string;
  displayName: string;
  elo: number;
  roomId: string | null;
}

interface RoomPlayer {
  uid: string;
  displayName: string;
  elo: number;
  connected: boolean;
}

interface MultiplayerRoom {
  id: string;
  state: GameState;
  white: RoomPlayer | null;
  black: RoomPlayer | null;
  startedAt: number;
  createdAt: number;
  recorded: boolean;
  rematchVotes: Set<string>;
}

const clients = new Map<WebSocket, ConnectedClient>();
const rooms = new Map<string, MultiplayerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getLobbySnapshot() {
  const list: Array<{
    roomId: string;
    hostName: string;
    hostElo: number;
    createdAt: number;
  }> = [];
  for (const room of rooms.values()) {
    if (room.white && !room.black && room.state.status === 'active') {
      list.push({
        roomId: room.id,
        hostName: room.white.displayName,
        hostElo: room.white.elo,
        createdAt: room.createdAt,
      });
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function broadcastLobby() {
  const lobby = getLobbySnapshot();
  for (const client of clients.values()) {
    sendJson(client.ws, { type: 'lobby:list', rooms: lobby });
  }
}

function broadcastRoom(room: MultiplayerRoom) {
  const payload = {
    type: 'room:state',
    room: {
      id: room.id,
      state: room.state,
      white: room.white,
      black: room.black,
      rematchVotes: Array.from(room.rematchVotes),
    },
  };
  for (const client of clients.values()) {
    if (client.roomId === room.id) {
      sendJson(client.ws, payload);
    }
  }
}

async function finalizeMultiplayerMatch(
  room: MultiplayerRoom,
  winner: PlayerColor | null
) {
  if (room.recorded || !room.white || !room.black) return;
  room.recorded = true;

  const durationSeconds = Math.max(
    1,
    Math.round((Date.now() - room.startedAt) / 1000)
  );
  const movesJson = JSON.stringify(room.state.moves);
  const whiteResult =
    winner === null ? 'draw' : winner === 'white' ? 'win' : 'loss';
  const blackResult =
    winner === null ? 'draw' : winner === 'black' ? 'win' : 'loss';

  const whitePrevElo = room.white.elo;
  const blackPrevElo = room.black.elo;

  try {
    const [wSaved, bSaved] = await Promise.all([
      recordMatchAndUpdateStats({
        uid: room.white.uid,
        opponentName: room.black.displayName,
        opponentUid: room.black.uid,
        opponentElo: blackPrevElo,
        mode: 'multiplayer',
        difficulty: null,
        playerColor: 'white',
        result: whiteResult,
        moveCount: Math.max(1, room.state.ply),
        movesJson,
        durationSeconds,
      }),
      recordMatchAndUpdateStats({
        uid: room.black.uid,
        opponentName: room.white.displayName,
        opponentUid: room.white.uid,
        opponentElo: whitePrevElo,
        mode: 'multiplayer',
        difficulty: null,
        playerColor: 'black',
        result: blackResult,
        moveCount: Math.max(1, room.state.ply),
        movesJson,
        durationSeconds,
      }),
    ]);

    room.white.elo = wSaved.user.elo;
    room.black.elo = bSaved.user.elo;

    for (const client of clients.values()) {
      if (client.uid === room.white.uid) {
        client.elo = wSaved.user.elo;
        sendJson(client.ws, {
          type: 'room:elo',
          elo: wSaved.user.elo,
          eloDelta: wSaved.eloDelta,
        });
      } else if (client.uid === room.black.uid) {
        client.elo = bSaved.user.elo;
        sendJson(client.ws, {
          type: 'room:elo',
          elo: bSaved.user.elo,
          eloDelta: bSaved.eloDelta,
        });
      }
    }
  } catch (err) {
    console.error('Failed to persist multiplayer match:', err);
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return sendJson(ws, { type: 'room:error', error: 'Malformed message.' });
    }

    if (msg.type === 'auth') {
      if (typeof msg.token !== 'string') {
        return sendJson(ws, {
          type: 'auth:error',
          error: 'Authentication token required.',
        });
      }
      try {
        const decoded = await adminAuth.verifyIdToken(msg.token);
        const email = decoded.email || `${decoded.uid}@player.local`;
        const dbUser = await getOrCreateUser(decoded.uid, email, decoded.name);
        const client: ConnectedClient = {
          ws,
          uid: dbUser.uid,
          displayName: dbUser.displayName,
          elo: dbUser.elo,
          roomId: null,
        };
        clients.set(ws, client);
        sendJson(ws, {
          type: 'auth:ok',
          uid: dbUser.uid,
          displayName: dbUser.displayName,
          elo: dbUser.elo,
          rooms: getLobbySnapshot(),
        });
      } catch {
        sendJson(ws, {
          type: 'auth:error',
          error: 'Invalid or expired authentication token.',
        });
      }
      return;
    }

    const client = clients.get(ws);
    if (!client) {
      return sendJson(ws, {
        type: 'room:error',
        error: 'Please sign in before using multiplayer.',
      });
    }

    if (msg.type === 'lobby:subscribe') {
      return sendJson(ws, { type: 'lobby:list', rooms: getLobbySnapshot() });
    }

    if (msg.type === 'room:create') {
      if (client.roomId) {
        const prev = rooms.get(client.roomId);
        if (prev && prev.white?.uid === client.uid && !prev.black) {
          rooms.delete(prev.id);
        }
      }
      const roomId = generateRoomCode();
      const room: MultiplayerRoom = {
        id: roomId,
        state: createInitialGameState(),
        white: {
          uid: client.uid,
          displayName: client.displayName,
          elo: client.elo,
          connected: true,
        },
        black: null,
        startedAt: Date.now(),
        createdAt: Date.now(),
        recorded: false,
        rematchVotes: new Set(),
      };
      rooms.set(roomId, room);
      client.roomId = roomId;
      broadcastRoom(room);
      broadcastLobby();
      return;
    }

    if (msg.type === 'room:join') {
      const code =
        typeof msg.roomId === 'string' ? msg.roomId.trim().toUpperCase() : '';
      const room = rooms.get(code);
      if (!room) {
        return sendJson(ws, {
          type: 'room:error',
          error: 'Room not found or already closed.',
        });
      }

      if (room.white?.uid === client.uid) {
        room.white.connected = true;
        client.roomId = room.id;
        broadcastRoom(room);
        return;
      }

      if (room.black?.uid === client.uid) {
        room.black.connected = true;
        client.roomId = room.id;
        broadcastRoom(room);
        return;
      }

      if (room.black) {
        return sendJson(ws, {
          type: 'room:error',
          error: 'This room already has two players.',
        });
      }

      room.black = {
        uid: client.uid,
        displayName: client.displayName,
        elo: client.elo,
        connected: true,
      };
      room.startedAt = Date.now();
      client.roomId = room.id;
      broadcastRoom(room);
      broadcastLobby();
      return;
    }

    if (msg.type === 'room:leave') {
      if (client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
          if (room.white?.uid === client.uid && !room.black) {
            rooms.delete(room.id);
          } else if (room.state.status === 'active' && room.white && room.black) {
            const leaverColor: PlayerColor =
              room.white.uid === client.uid ? 'white' : 'black';
            const winner = opponentColor(leaverColor);
            room.state.status = 'won';
            room.state.winner = winner;
            await finalizeMultiplayerMatch(room, winner);
            broadcastRoom(room);
          }
        }
        client.roomId = null;
        broadcastLobby();
      }
      return;
    }

    if (msg.type === 'room:move') {
      if (!client.roomId) return;
      const room = rooms.get(client.roomId);
      if (!room || !room.white || !room.black) {
        return sendJson(ws, {
          type: 'room:error',
          error: 'Waiting for opponent to join.',
        });
      }

      const playerColor: PlayerColor | null =
        room.white.uid === client.uid
          ? 'white'
          : room.black.uid === client.uid
            ? 'black'
            : null;
      if (!playerColor || room.state.turn !== playerColor) {
        return sendJson(ws, {
          type: 'room:error',
          error: 'Not your turn.',
        });
      }

      const move = msg.move as GameMove | undefined;
      if (!move || move.color !== playerColor) {
        return sendJson(ws, { type: 'room:error', error: 'Invalid move.' });
      }

      const applied = applyMove(room.state, move);
      if (!applied) {
        return sendJson(ws, { type: 'room:error', error: 'Illegal move.' });
      }

      room.state = applied.nextState;
      broadcastRoom(room);

      if (room.state.status === 'won' || room.state.status === 'draw') {
        await finalizeMultiplayerMatch(room, room.state.winner);
        broadcastRoom(room);
      }
      return;
    }

    if (msg.type === 'room:resign') {
      if (!client.roomId) return;
      const room = rooms.get(client.roomId);
      if (!room || !room.white || !room.black || room.state.status !== 'active') {
        return;
      }
      const playerColor: PlayerColor | null =
        room.white.uid === client.uid
          ? 'white'
          : room.black.uid === client.uid
            ? 'black'
            : null;
      if (!playerColor) return;

      const winner = opponentColor(playerColor);
      room.state.status = 'won';
      room.state.winner = winner;
      await finalizeMultiplayerMatch(room, winner);
      broadcastRoom(room);
      return;
    }

    if (msg.type === 'room:rematch') {
      if (!client.roomId) return;
      const room = rooms.get(client.roomId);
      if (!room || !room.white || !room.black || room.state.status === 'active') {
        return;
      }
      room.rematchVotes.add(client.uid);
      if (room.rematchVotes.has(room.white.uid) && room.rematchVotes.has(room.black.uid)) {
        const prevWhite = room.white;
        room.white = room.black;
        room.black = prevWhite;
        room.state = createInitialGameState();
        room.startedAt = Date.now();
        room.recorded = false;
        room.rematchVotes.clear();
      }
      broadcastRoom(room);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (!client) return;
    if (client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) {
        if (room.white?.uid === client.uid && !room.black) {
          rooms.delete(room.id);
          broadcastLobby();
        } else {
          if (room.white?.uid === client.uid) room.white.connected = false;
          if (room.black?.uid === client.uid) room.black.connected = false;
          broadcastRoom(room);
        }
      }
    }
    clients.delete(ws);
  });
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Checkline server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
