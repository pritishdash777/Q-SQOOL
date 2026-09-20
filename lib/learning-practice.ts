export type PracticeGate = { type: "H" | "X" | "Z" | "CX"; qubit: 0 | 1 };
export const missions = [
  { title: "Split the possibilities", goal: "Starting in |00⟩, create (|00⟩ + |01⟩)/√2. Only q0 should change.", target: [Math.SQRT1_2, Math.SQRT1_2, 0, 0], hint: "A Hadamard mixes the two basis amplitudes of one qubit.", gates: ["H", "X", "Z", "CX"] },
  { title: "Make phase visible", goal: "Reach |01⟩ using only H and Z gates. A phase change needs interference to become visible.", target: [0, 1, 0, 0], hint: "Try changing the phase between two basis changes.", gates: ["H", "Z"] },
  { title: "Build a Bell pair", goal: "Prepare (|00⟩ + |11⟩)/√2. Both outcomes must have the same phase.", target: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], hint: "First make one qubit a superposition; then let it control the other.", gates: ["H", "X", "Z", "CX"] },
];
export function practiceState(gates: PracticeGate[]) {
  let state = [1, 0, 0, 0];
  for (const gate of gates) {
    const next = [...state], mask = 1 << gate.qubit;
    for (let i = 0; i < 4; i++) {
      if (gate.type === "CX") { if (i & mask) next[i ^ (1 << (1 - gate.qubit))] = state[i]; }
      else if (!(i & mask)) {
        const a = state[i], b = state[i | mask];
        if (gate.type === "H") { next[i] = (a + b) * Math.SQRT1_2; next[i | mask] = (a - b) * Math.SQRT1_2; }
        if (gate.type === "X") { next[i] = b; next[i | mask] = a; }
        if (gate.type === "Z") next[i | mask] = -b;
      }
    }
    state = next;
  }
  return state;
}
export function missionFidelity(state: number[], target: number[]) {
  return Math.min(1, state.reduce((sum, value, i) => sum + value * target[i], 0) ** 2);
}
