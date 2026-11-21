import { asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users, type DbUser } from './schema.ts';

export interface PublicLeaderboardEntry {
  id: number;
  uid: string;
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  aiWinsEasy: number;
  aiWinsIntermediate: number;
  aiWinsHard: number;
  aiWinsLegendary: number;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  suggestedName?: string
): Promise<DbUser> {
  const safeName = (suggestedName || email.split('@')[0] || 'Player')
    .trim()
    .slice(0, 32);
  const displayName = safeName.length >= 2 ? safeName : 'Player';

  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize player profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string): Promise<DbUser | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database error in getUserByUid:', error);
    throw new Error('Failed to load player profile.', { cause: error });
  }
}

export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<DbUser | null> {
  const cleaned = displayName.trim().slice(0, 32);
  if (cleaned.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  try {
    const rows = await db
      .update(users)
      .set({
        displayName: cleaned,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database error in updateDisplayName:', error);
    throw new Error('Failed to update player handle.', { cause: error });
  }
}

export async function getLeaderboard(
  limitCount = 50
): Promise<PublicLeaderboardEntry[]> {
  try {
    return await db
      .select({
        id: users.id,
        uid: users.uid,
        displayName: users.displayName,
        elo: users.elo,
        wins: users.wins,
        losses: users.losses,
        draws: users.draws,
        aiWinsEasy: users.aiWinsEasy,
        aiWinsIntermediate: users.aiWinsIntermediate,
        aiWinsHard: users.aiWinsHard,
        aiWinsLegendary: users.aiWinsLegendary,
      })
      .from(users)
      .orderBy(desc(users.elo), desc(users.wins), asc(users.losses))
      .limit(Math.min(Math.max(limitCount, 1), 100));
  } catch (error) {
    console.error('Database error in getLeaderboard:', error);
    throw new Error('Failed to load global leaderboard.', { cause: error });
  }
}
