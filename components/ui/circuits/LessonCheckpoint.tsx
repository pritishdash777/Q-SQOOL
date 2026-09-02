'use client';

import React, { useState, useTransition } from 'react';
import { QuantumGateNode, simulateCircuit } from '@/lib/quantumSimulator';
import { completeCheckpoint } from '@/backend/actions/progress';

interface LessonCheckpointProps {
  userId: string;
  lessonId: string;
  targetStateDescription: string;
  expectedProbabilities: Record<number, number>; // e.g. { 0: 0.5, 3: 0.5 } for Bell State
  xpReward: number;
  onSuccess?: () => void;
}

export const LessonCheckpoint: React.FC<LessonCheckpointProps> = ({
  userId,
  lessonId,
  targetStateDescription,
  expectedProbabilities,
  xpReward,
  onSuccess,
}) => {
  const [gates, setGates] = useState<QuantumGateNode[]>([]);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'idle',
    message: '',
  });

  const handleVerify = () => {
    // 1. Run simulation across 2 wires
    const { probabilities } = simulateCircuit(2, gates);

    // 2. Validate current output against target state expectations
    let isCorrect = true;
    for (const [indexStr, expectedProb] of Object.entries(expectedProbabilities)) {
      const idx = Number(indexStr);
      const actualProb = probabilities[idx] ?? 0;
      // Allow minor floating point margin of error (0.05)
      if (Math.abs(actualProb - expectedProb) > 0.05) {
        isCorrect = false;
        break;
      }
    }

    if (!isCorrect) {
      setFeedback({
        type: 'error',
        message: 'Circuit output does not match the target state yet. Try inspecting the gates and try again!',
      });
      return;
    }

    // 3. Trigger server action to award XP and register database progress
    startTransition(async () => {
      const res = await completeCheckpoint({
        userId,
        lessonId,
        baseXP: xpReward,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Challenge passed! +${res.xpGained} XP awarded.`,
        });
        if (onSuccess) onSuccess();
      } else {
        setFeedback({
          type: 'error',
          message: 'Passed locally, but failed to sync progress with the server.',
        });
      }
    });
  };

  const handleQuickAdd = (gate: 'H' | 'CX') => {
    const nextStep = gates.length;
    const newNode: QuantumGateNode = {
      id: crypto.randomUUID(),
      gate,
      wireIndex: 0,
      stepIndex: nextStep,
      ...(gate === 'CX' ? { targetWireIndex: 1 } : {}),
    };
    setGates((prev) => [...prev, newNode]);
  };

  const handleReset = () => {
    setGates([]);
    setFeedback({ type: 'idle', message: '' });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-md">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Interactive Checkpoint
        </span>
        <h4 className="mt-1 text-sm font-semibold text-foreground">
          Goal: {targetStateDescription}
        </h4>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuickAdd('H')}
          className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition"
        >
          Add H (q0)
        </button>
        <button
          onClick={() => handleQuickAdd('CX')}
          className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition"
        >
          Add CX (q0 -&gt; q1)
        </button>
        <button
          onClick={handleReset}
          className="rounded-md border border-border/80 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        Active Gates: {gates.length > 0 ? gates.map((g) => g.gate).join(' → ') : 'Empty'}
      </div>

      {feedback.message && (
        <div
          className={`rounded-md p-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={isPending}
        className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
      >
        {isPending ? 'Verifying...' : `Verify Solution & Claim +${xpReward} XP`}
      </button>
    </div>
  );
};