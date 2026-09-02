// Base unitary transformations for common single-qubit gates
const GATES: Record<string, [number, number, number, number]> = {
  // [m00_re, m01_re, m10_re, m11_re]
  X: [0, 1, 1, 0],
  Z: [1, 0, 0, -1],
  H: [1 / Math.SQRT2, 1 / Math.SQRT2, 1 / Math.SQRT2, -1 / Math.SQRT2],
};

export interface QuantumGateNode {
  id: string;
  gate: 'H' | 'X' | 'Z' | 'CX';
  wireIndex: number;
  stepIndex: number;
  targetWireIndex?: number;
}

export interface SimulationResult {
  probabilities: number[];
  stateLabels: string[];
}

/**
 * Computes statevector probabilities for an n-qubit circuit instantly in-browser.
 */
export function simulateCircuit(numWires: number, gates: QuantumGateNode[]): SimulationResult {
  const dim = 1 << numWires; // 2^n basis states
  let state = new Float64Array(dim);
  state[0] = 1.0; // Start at ground state |0...0>

  // Sort gates left-to-right
  const sorted = [...gates].sort((a, b) => a.stepIndex - b.stepIndex);

  for (const node of sorted) {
    if (node.gate === 'H' || node.gate === 'X' || node.gate === 'Z') {
      const [u00, u01, u10, u11] = GATES[node.gate];
      const q = node.wireIndex;
      const step = 1 << q;
      const nextState = new Float64Array(dim);

      for (let i = 0; i < dim; i++) {
        if ((i & step) === 0) {
          const zeroIdx = i;
          const oneIdx = i | step;
          const a = state[zeroIdx];
          const b = state[oneIdx];

          nextState[zeroIdx] = u00 * a + u01 * b;
          nextState[oneIdx] = u10 * a + u11 * b;
        }
      }
      state = nextState;
    } else if (node.gate === 'CX' && node.targetWireIndex !== undefined) {
      // CNOT: Invert target wire amplitude if control wire bit is 1
      const ctrlMask = 1 << node.wireIndex;
      const targetMask = 1 << node.targetWireIndex;
      const nextState = new Float64Array(state);

      for (let i = 0; i < dim; i++) {
        if ((i & ctrlMask) !== 0) {
          const flipped = i ^ targetMask;
          if (i < flipped) {
            const temp = nextState[i];
            nextState[i] = nextState[flipped];
            nextState[flipped] = temp;
          }
        }
      }
      state = nextState;
    }
  }

  // Calculate probabilities (|amplitude|^2) and generate binary labels (|00>, |01>, etc.)
  const probabilities: number[] = [];
  const stateLabels: string[] = [];

  for (let i = 0; i < dim; i++) {
    const amp = state[i];
    probabilities.push(Math.round(amp * amp * 1000) / 1000);
    // Format as n-bit binary string (e.g. "01")
    stateLabels.push(`|${i.toString(2).padStart(numWires, '0')}>`);
  }

  return { probabilities, stateLabels };
}