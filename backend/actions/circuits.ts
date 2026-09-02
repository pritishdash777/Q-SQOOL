'use server';

import { db } from '../db/index';
import { circuits } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

interface SaveCircuitParams {
  userId: string;
  title: string;
  state: any; // visual circuit grid state
  qiskitCode: string;
  circuitId?: string;
  isPublic?: boolean;
}

// 1. Save or update a circuit
export async function saveCircuit({
  userId,
  title,
  state,
  qiskitCode,
  circuitId,
  isPublic = false,
}: SaveCircuitParams) {
  try {
    if (circuitId) {
      // Update existing circuit
      await db
        .update(circuits)
        .set({
          title,
          state,
          qiskitCode,
          isPublic,
          updatedAt: new Date(),
        })
        .where(eq(circuits.id, circuitId));

      revalidatePath('/dashboard');
      return { success: true, id: circuitId };
    }

    // Insert new circuit
    const newId = crypto.randomUUID();
    await db.insert(circuits).values({
      id: newId,
      userId,
      title,
      state,
      qiskitCode,
      isPublic,
    });

    revalidatePath('/dashboard');
    return { success: true, id: newId };
  } catch (error) {
    console.error('Failed to save circuit:', error);
    return { success: false, error: 'Failed to save circuit' };
  }
}

// 2. Fetch all circuits belonging to a user
export async function getUserCircuits(userId: string) {
  try {
    const userCircuits = await db
      .select()
      .from(circuits)
      .where(eq(circuits.userId, userId))
      .orderBy(desc(circuits.updatedAt));

    return { success: true, data: userCircuits };
  } catch (error) {
    console.error('Failed to fetch user circuits:', error);
    return { success: false, error: 'Could not retrieve circuits' };
  }
}