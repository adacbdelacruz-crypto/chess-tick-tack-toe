import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { matches, users, type DbMatch, type DbUser } from './schema.ts';
import type { DifficultyLevel, GameMode, PlayerColor } from '../shared/gameEngine.ts';

export type MatchResult = 'win' | 'loss' | 'draw';

export interface RecordMatchInput {
  uid: string;
  opponentName: string;
  opponentUid?: string | null;
  opponentElo?: number;
  mode: GameMode;
  difficulty: DifficultyLevel | null;
  playerColor: PlayerColor;
  result: MatchResult;
  moveCount: number;
  movesJson: string;
  durationSeconds: number;
}

const AI_RATINGS: Record<DifficultyLevel, number> = {
  easy: 900,
  intermediate: 1200,
  hard: 1500,
  legendary: 1850,
};

export function calculateEloDelta(
  playerElo: number,
  opponentElo: number,
  result: MatchResult,
  kFactor = 28
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round(kFactor * (actual - expected));
}

export async function recordMatchAndUpdateStats(
  input: RecordMatchInput
): Promise<{ match: DbMatch; user: DbUser; eloDelta: number }> {
  try {
    return await db.transaction(async (tx) => {
      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.uid, input.uid))
        .limit(1);

      const currentUser = existingUsers[0];
      if (!currentUser) {
        throw new Error('Player account not found.');
      }

      let eloDelta = 0;
      if (input.mode === 'ai' && input.difficulty) {
        eloDelta = calculateEloDelta(
          currentUser.elo,
          AI_RATINGS[input.difficulty],
          input.result,
          24
        );
      } else if (input.mode === 'multiplayer') {
        eloDelta = calculateEloDelta(
          currentUser.elo,
          input.opponentElo ?? 1200,
          input.result,
          32
        );
      }

      const nextElo = Math.max(100, currentUser.elo + eloDelta);

      const inserted = await tx
        .insert(matches)
        .values({
          userId: currentUser.id,
          opponentName: input.opponentName.slice(0, 64),
          opponentUid: input.opponentUid ?? null,
          mode: input.mode,
          difficulty: input.difficulty,
          playerColor: input.playerColor,
          result: input.result,
          moveCount: Math.max(1, Math.min(input.moveCount, 500)),
          eloDelta,
          movesJson: input.movesJson.slice(0, 32000),
          durationSeconds: Math.max(0, Math.min(input.durationSeconds, 86400)),
        })
        .returning();

      const updatedUsers = await tx
        .update(users)
        .set({
          elo: nextElo,
          wins:
            input.mode !== 'local' && input.result === 'win'
              ? currentUser.wins + 1
              : currentUser.wins,
          losses:
            input.mode !== 'local' && input.result === 'loss'
              ? currentUser.losses + 1
              : currentUser.losses,
          draws:
            input.mode !== 'local' && input.result === 'draw'
              ? currentUser.draws + 1
              : currentUser.draws,
          aiWinsEasy:
            input.mode === 'ai' &&
            input.difficulty === 'easy' &&
            input.result === 'win'
              ? currentUser.aiWinsEasy + 1
              : currentUser.aiWinsEasy,
          aiWinsIntermediate:
            input.mode === 'ai' &&
            input.difficulty === 'intermediate' &&
            input.result === 'win'
              ? currentUser.aiWinsIntermediate + 1
              : currentUser.aiWinsIntermediate,
          aiWinsHard:
            input.mode === 'ai' &&
            input.difficulty === 'hard' &&
            input.result === 'win'
              ? currentUser.aiWinsHard + 1
              : currentUser.aiWinsHard,
          aiWinsLegendary:
            input.mode === 'ai' &&
            input.difficulty === 'legendary' &&
            input.result === 'win'
              ? currentUser.aiWinsLegendary + 1
              : currentUser.aiWinsLegendary,
          updatedAt: new Date(),
        })
        .where(eq(users.id, currentUser.id))
        .returning();

      return {
        match: inserted[0],
        user: updatedUsers[0],
        eloDelta,
      };
    });
  } catch (error) {
    console.error('Database error in recordMatchAndUpdateStats:', error);
    throw new Error('Failed to record match result.', { cause: error });
  }
}

export async function getUserMatchHistory(
  uid: string,
  limitCount = 30
): Promise<DbMatch[]> {
  try {
    const rows = await db
      .select({
        match: matches,
      })
      .from(matches)
      .innerJoin(users, eq(matches.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(matches.createdAt))
      .limit(Math.min(Math.max(limitCount, 1), 100));

    return rows.map((r) => r.match);
  } catch (error) {
    console.error('Database error in getUserMatchHistory:', error);
    throw new Error('Failed to load match history.', { cause: error });
  }
}
