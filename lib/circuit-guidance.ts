import type { AIAnalysis, AILevel, AIMode, Circuit } from "./quantum-types";
import { affectedQubits, circuitDepth, orderedGates, validateCircuit } from "./circuit";

export function analyseCircuit(circuit: Circuit, mode: AIMode, level: AILevel): AIAnalysis {
  const result = (title: string, text: string, gateIds: number[] = [], after = circuit): AIAnalysis => ({ title, text, gateIds, before: circuit, after });
  const invalid = validateCircuit(circuit);
  if (invalid) return result("Circuit needs attention", invalid);
  const gates = orderedGates(circuit);
  if (mode === "Detect Errors") {
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      if (gate.type !== "M") continue;
      const next = gates.slice(i + 1).find(other => affectedQubits(other).includes(gate.qubit));
      if (next?.type === "M") return result("Repeated measurement", `q[${gate.qubit}] is measured twice without an intervening operation on that qubit. You can remove the second readout.`, [gate.id, next.id], { ...circuit, gates: circuit.gates.filter(g => g.id !== next.id) });
    }
    return result("Validation complete", gates.some(g => g.type === "M") ? "Indices and parameters are valid. Explicit measurements write q[i] to c[i]; unmeasured classical bits remain zero. This check does not prove algorithm correctness." : "Indices and parameters are valid. Qiskit Aer automatically measures all qubits at the end when no measurement is present. No extra measurement gates are required.");
  }
  const bell = gates.length >= 2 && gates[0].type === "H" && gates[1].type === "CX" && gates[0].qubit === gates[1].qubit;
  const sequence = gates.map(g => `${g.type}${g.angle !== undefined ? `(${g.angle} rad)` : ""} q${g.qubit}${g.target !== undefined ? `→q${g.target}` : ""}`).join(" → ");
  return result("Circuit walkthrough", `${gates.length} operations on ${circuit.qubits} qubits; logical depth ${circuitDepth(circuit)}. ${bell ? "Starting from zero, the first H and CX prepare a Bell pair on their two wires. Later operations may change it. " : ""}${level === "Technical" ? `Timeline: ${sequence || "identity"}. Basis strings place q0 on the right; rotations use radians. ` : "Read the gates from left to right. H mixes amplitudes; controlled gates act conditionally; measurements sample classical bits. "}Run the simulator to inspect this circuit’s sampled outcomes.`, gates.slice(0, 2).map(g => g.id));
}
