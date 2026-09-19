"use server";

// Retired: this action accepted an arbitrary user ID and XP reward.
// Checkpoints now use ProgressProvider and the authenticated FastAPI endpoint.
export async function completeCheckpoint(_input: { userId: string; lessonId: string; baseXP: number }) {
  void _input;
  return { success: false, error: "Reload this page to save through the authenticated progress API." };
}
