'use server';

import { db } from '../db';
import { users, lessonProgress, userAchievements, achievements } from '../db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

interface CompleteCheckpointParams {
  userId: string;
  lessonId: string;
  baseXP: number;
}

export async function completeCheckpoint({ userId, lessonId, baseXP }: CompleteCheckpointParams) {
  try {
    // 1. Record completed lesson progress
    await db.insert(lessonProgress).values({
      id: crypto.randomUUID(),
      userId,
      lessonId,
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    // 2. Fetch current user data
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!currentUser) {
      throw new Error('User not found');
    }

    // 3. Compute updated XP and calculate level progression (1000 XP per level)
    const newXP = currentUser.xp + baseXP;
    const newLevel = Math.floor(newXP / 1000) + 1;

    await db
      .update(users)
      .set({
        xp: newXP,
        level: newLevel,
        lastActive: new Date(),
      })
      .where(eq(users.id, userId));

    // 4. Evaluate specific achievement unlocking (e.g. First Bell State / Entanglement)
    if (lessonId === 'intro-to-entanglement') {
      const [badge] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.name, 'First Entanglement'));

      if (badge) {
        await db.insert(userAchievements).values({
          id: crypto.randomUUID(),
          userId,
          achievementId: badge.id,
        });
      }
    }

    revalidatePath('/dashboard');
    return { success: true, xpGained: baseXP, newLevel };
  } catch (error) {
    console.error('Failed to complete checkpoint:', error);
    return { success: false, error: 'Could not update user progress' };
  }
}