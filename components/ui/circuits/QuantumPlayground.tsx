'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { QuantumGateNode, simulateCircuit } from '@/lib/quantumSimulator';
import { generateQiskitCode } from '@/lib/qiskitGenerator';
import { ProbabilityHistogram } from './ProbabilityHistogram';
import { saveCircuit } from '@/backend/actions/circuits';

interface QuantumPlaygroundProps {
  userId: string;
  initialGates?: QuantumGateNode[];
  numWires?: number;
}

export const QuantumPlayground: React.FC<QuantumPlaygroundProps> = ({
  userId,
  initialGates = [],
  numWires = 3,
}) => {
  const [gates, setGates] = useState<QuantumGateNode[]>(initialGates);
  const [circuitTitle, setCircuitTitle] = useState('My Quantum Circuit');
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // 1. Instant Real-time Simulation calculation
  const { probabilities, stateLabels } = useMemo(() => {
    return simulateCircuit(numWires, gates);
  }, [numWires, gates]);

  // 2. Synchronous Qiskit Code Generation
  const qiskitCode = useMemo(() => {
    return generateQiskitCode(numWires, gates);
  }, [numWires, gates]);

  // 3. Save Circuit to PostgreSQL via Server Action
  const handleSave = () => {
    startTransition(async () => {
      setSaveStatus('Saving...');
      const res = await saveCircuit({
        userId,
        title: circuitTitle,
        state: gates,
        qiskitCode,
      });

      if (res.success) {
        setSaveStatus('Saved successfully!');
      } else {
        setSaveStatus('Failed to save.');
      }
      setTimeout(() => setSaveStatus(null), 3000);
    });
  };

  // Helper: Quick gate placement (wire-up target for your existing drag-and-drop listener)
  const handleAddSampleGate = (gateType: 'H' | 'X' | 'CX') => {
    const nextStep = gates.length;
    const newGate: QuantumGateNode = {
      id: crypto.randomUUID(),
      gate: gateType,
      wireIndex: 0,
      stepIndex: nextStep,
      ...(gateType === 'CX' ? { targetWireIndex: 1 } : {}),
    };
    setGates((prev) => [...prev, newGate]);
  };

  const handleClearCircuit = () => {
    setGates([]);
  };

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-md">
        <input
          type="text"
          value={circuitTitle}
          onChange={(e) => setCircuitTitle(e.target.value)}
          className="rounded-md border border-input bg-transparent px-3 py-1.5 font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAddSampleGate('H')}
            className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
          >
            + Add H Gate
          </button>
          <button
            onClick={() => handleAddSampleGate('CX')}
            className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
          >
            + Add CX Gate
          </button>
          <button
            onClick={handleClearCircuit}
            className="rounded-md border border-border/80 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Circuit'}
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="text-right text-xs font-medium text-primary transition-opacity">
          {saveStatus}
        </div>
      )}

      {/* Probability Histogram (Live Feedback) */}
      <ProbabilityHistogram probabilities={probabilities} stateLabels={stateLabels} />

      {/* Bidirectional Live Qiskit Output */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generated Qiskit Code
          </span>
          <span className="text-[11px] text-muted-foreground">Synchronized</span>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-emerald-400">
          <code>{qiskitCode}</code>
        </pre>
      </div>
    </div>
  );
};