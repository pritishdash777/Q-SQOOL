import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique().notNull(),
  image: text('image'),
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  lastActive: timestamp('last_active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const circuits = pgTable('circuits', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  state: jsonb('state').notNull(), // Stores visual gates, positions, wires
  qiskitCode: text('qiskit_code').notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  forkedFromId: text('forked_from_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  iconUrl: text('icon_url').notNull(),
  xpReward: integer('xp_reward').notNull(),
  criteriaType: text('criteria_type').notNull(), // e.g., 'CIRCUIT_CREATED', 'BELL_STATE'
  targetValue: integer('target_value').notNull(),
});

export const userAchievements = pgTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  achievementId: text('achievement_id').references(() => achievements.id).notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow(),
});

export const lessonProgress = pgTable('lesson_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  lessonId: text('lesson_id').notNull(),
  status: text('status').notNull(), // 'IN_PROGRESS', 'COMPLETED'
  score: integer('score').default(0),
  completedAt: timestamp('completed_at'),
});