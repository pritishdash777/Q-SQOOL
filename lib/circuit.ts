import type { Circuit, CircuitGate } from "./quantum-types";

export const MAX_GATES = 256;
export const MAX_COLUMN = 255;
export const gateNames = new Set(["X", "Y", "Z", "H", "S", "T", "RX", "RY", "RZ", "CX", "CZ", "M"]);
export const affectedQubits = (gate: CircuitGate) => gate.type === "CX" || gate.type === "CZ" ? [gate.qubit, gate.target!] : [gate.qubit];
export const orderedGates = (circuit: Circuit) => [...circuit.gates].sort((a, b) => a.column - b.column || a.id - b.id);

export function validateCircuit(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return "A circuit object is required.";
  const circuit = value as Circuit;
  if (!Number.isInteger(circuit.qubits) || circuit.qubits < 1 || circuit.qubits > 5) return "Use between 1 and 5 qubits.";
  if (!Array.isArray(circuit.gates) || circuit.gates.length > MAX_GATES) return `Use at most ${MAX_GATES} operations.`;
  const ids = new Set<number>();
  for (const gate of circuit.gates) {
    if (!gate || !Number.isSafeInteger(gate.id) || ids.has(gate.id)) return "Every gate needs a unique integer ID.";
    ids.add(gate.id);
    if (!gateNames.has(gate.type)) return "Unsupported gate type.";
    if (!Number.isInteger(gate.column) || gate.column < 0 || gate.column > MAX_COLUMN) return `Timeline columns must be between 0 and ${MAX_COLUMN}.`;
    if (!Number.isInteger(gate.qubit) || gate.qubit < 0 || gate.qubit >= circuit.qubits) return "A gate references a missing qubit.";
    const controlled = gate.type === "CX" || gate.type === "CZ";
    if (controlled && (!Number.isInteger(gate.target) || gate.target! < 0 || gate.target! >= circuit.qubits || gate.target === gate.qubit)) return "Choose different valid control and target qubits.";
    if (!controlled && gate.target !== undefined) return "Only CX and CZ accept a target qubit.";
    const rotation = ["RX", "RY", "RZ"].includes(gate.type);
    if (rotation && !Number.isFinite(gate.angle)) return "Rotation angles must be finite numbers in radians.";
    if (!rotation && gate.angle !== undefined) return "Only RX, RY and RZ accept an angle.";
  }
}

// Unit-cost logical layers, including explicit measurements; no implicit readout or barriers.
export function circuitDepth(circuit: Circuit): number {
  const layers = Array(circuit.qubits).fill(0);
  for (const gate of orderedGates(circuit)) {
    const wires = affectedQubits(gate);
    const layer = 1 + Math.max(...wires.map(q => layers[q]));
    for (const q of wires) layers[q] = layer;
  }
  return Math.max(0, ...layers);
}

export const circuitFingerprint = (circuit: Circuit) => JSON.stringify(circuit);
