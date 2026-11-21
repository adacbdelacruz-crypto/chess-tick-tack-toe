import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  elo: integer('elo').notNull().default(1200),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  aiWinsEasy: integer('ai_wins_easy').notNull().default(0),
  aiWinsIntermediate: integer('ai_wins_intermediate').notNull().default(0),
  aiWinsHard: integer('ai_wins_hard').notNull().default(0),
  aiWinsLegendary: integer('ai_wins_legendary').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  opponentName: text('opponent_name').notNull(),
  opponentUid: text('opponent_uid'),
  mode: text('mode').notNull(),
  difficulty: text('difficulty'),
  playerColor: text('player_color').notNull(),
  result: text('result').notNull(),
  moveCount: integer('move_count').notNull(),
  eloDelta: integer('elo_delta').notNull().default(0),
  movesJson: text('moves_json').notNull(),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  player: one(users, {
    fields: [matches.userId],
    references: [users.id],
  }),
}));

export type DbUser = typeof users.$inferSelect;
export type DbMatch = typeof matches.$inferSelect;
