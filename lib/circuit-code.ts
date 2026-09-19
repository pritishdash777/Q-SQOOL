import type { Circuit, CircuitGate, GateName, SDK } from "./quantum-types";
import { orderedGates, validateCircuit } from "./circuit";

export function generateCode(circuit: Circuit, sdk: SDK): string {
  const error = validateCircuit(circuit);
  if (error) throw new Error(error);
  const gates = orderedGates(circuit);
  if (sdk === "Qiskit") return ["from qiskit import QuantumCircuit", "", `qc = QuantumCircuit(${circuit.qubits}, ${circuit.qubits})`, ...gates.map(g => g.type === "M" ? `qc.measure(${g.qubit}, ${g.qubit})` : `qc.${g.type.toLowerCase()}(${g.angle !== undefined ? `${g.angle}, ` : ""}${g.qubit}${g.target !== undefined ? `, ${g.target}` : ""})`)].join("\n");
  if (sdk === "Cirq") return ["import cirq", "", `q = cirq.LineQubit.range(${circuit.qubits})`, "circuit = cirq.Circuit(", ...gates.map(g => `  ${g.type === "M" ? `cirq.measure(q[${g.qubit}], key="m${g.id}")` : g.angle !== undefined ? `cirq.${g.type.toLowerCase()}(${g.angle})(q[${g.qubit}])` : `cirq.${g.type === "CX" ? "CNOT" : g.type}(q[${g.qubit}]${g.target !== undefined ? `, q[${g.target}]` : ""})`},`), ")"].join("\n");
  return ["OPENQASM 3;", 'include "stdgates.inc";', `qubit[${circuit.qubits}] q;`, `bit[${circuit.qubits}] c;`, "", ...gates.map(g => g.type === "M" ? `c[${g.qubit}] = measure q[${g.qubit}];` : `${g.type.toLowerCase()}${g.angle !== undefined ? `(${g.angle})` : ""} q[${g.qubit}]${g.target !== undefined ? `, q[${g.target}]` : ""};`)].join("\n");
}

// Deliberately bounded grammar: no eval, arbitrary Python, loops or classical remapping.
export function parseCode(code: string, sdk: SDK): { circuit?: Circuit; warning?: string } {
  if (code.length > 100000) return { warning: "Code exceeds the 100 KB import limit." };
  let qubits = 0, classical: number | undefined, wrapper = 0;
  const gates: CircuitGate[] = [];
  const number = "([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)";
  const add = (type: string, qubit: string, target?: string, angle?: string) => gates.push({ id: gates.length + 1, column: gates.length, type: type.toUpperCase().replace("CNOT", "CX") as GateName, qubit: Number(qubit), ...(target === undefined ? {} : { target: Number(target) }), ...(angle === undefined ? {} : { angle: Number(angle) }) });
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(sdk === "OpenQASM" ? /\/\/.*$/ : /#.*$/, "").trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;
    const fail = (reason = "Unsupported or incomplete statement") => ({ warning: `Line ${i + 1}: ${reason}. The last valid circuit is unchanged.` });
    if (sdk === "Qiskit") {
      if (line === "from qiskit import QuantumCircuit") continue;
      if ((m = line.match(/^qc\s*=\s*QuantumCircuit\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)$/))) {
        if (qubits || gates.length) return fail("Use one circuit declaration before all gates");
        qubits = Number(m[1]); classical = Number(m[2] || 0); continue;
      }
      if (!qubits) return fail("Declare qc before adding gates");
      if ((m = line.match(/^qc\.(x|y|z|h|s|t)\(\s*(\d+)\s*\)$/))) add(m[1], m[2]);
      else if ((m = line.match(/^qc\.(cx|cz)\(\s*(\d+)\s*,\s*(\d+)\s*\)$/))) add(m[1], m[2], m[3]);
      else if ((m = line.match(new RegExp(`^qc\\.(rx|ry|rz)\\(\\s*${number}\\s*,\\s*(\\d+)\\s*\\)$`)))) add(m[1], m[3], undefined, m[2]);
      else if ((m = line.match(/^qc\.measure\(\s*(\d+)\s*,\s*(\d+)\s*\)$/))) {
        if (m[1] !== m[2] || Number(m[2]) >= (classical || 0)) return fail("Measurements require q[i] → c[i] with a declared classical register");
        add("M", m[1]);
      } else return fail();
    } else if (sdk === "Cirq") {
      if (line === "import cirq") continue;
      if ((m = line.match(/^q\s*=\s*cirq\.LineQubit\.range\(\s*(\d+)\s*\)$/))) {
        if (qubits || gates.length) return fail("Use one qubit declaration");
        qubits = Number(m[1]); continue;
      }
      if (line === "circuit = cirq.Circuit(") { if (!qubits || wrapper) return fail(); wrapper = 1; continue; }
      if (line === ")") { if (wrapper !== 1) return fail(); wrapper = 2; continue; }
      if (wrapper !== 1 || !line.endsWith(",")) return fail("Use comma-terminated operations inside cirq.Circuit");
      const op = line.slice(0, -1);
      if ((m = op.match(/^cirq\.(X|Y|Z|H|S|T)\(q\[(\d+)\]\)$/))) add(m[1], m[2]);
      else if ((m = op.match(/^cirq\.(CNOT|CZ)\(q\[(\d+)\],\s*q\[(\d+)\]\)$/))) add(m[1], m[2], m[3]);
      else if ((m = op.match(new RegExp(`^cirq\\.(rx|ry|rz)\\(${number}\\)\\(q\\[(\\d+)\\]\\)$`)))) add(m[1], m[3], undefined, m[2]);
      else if ((m = op.match(/^cirq\.measure\(q\[(\d+)\](?:,\s*key="[a-zA-Z0-9_-]+")?\)$/))) add("M", m[1]);
      else return fail();
    } else {
      if (line === "OPENQASM 3;" || line === 'include "stdgates.inc";') continue;
      if ((m = line.match(/^qubit\[(\d+)\] q;$/))) { if (qubits || gates.length) return fail("Use one qubit declaration"); qubits = Number(m[1]); continue; }
      if ((m = line.match(/^bit\[(\d+)\] c;$/))) { if (classical !== undefined || gates.length) return fail(); classical = Number(m[1]); continue; }
      if (!qubits) return fail("Declare q before adding gates");
      if ((m = line.match(/^(x|y|z|h|s|t)\s+q\[(\d+)\];$/))) add(m[1], m[2]);
      else if ((m = line.match(/^(cx|cz)\s+q\[(\d+)\],\s*q\[(\d+)\];$/))) add(m[1], m[2], m[3]);
      else if ((m = line.match(new RegExp(`^(rx|ry|rz)\\(${number}\\)\\s+q\\[(\\d+)\\];$`)))) add(m[1], m[3], undefined, m[2]);
      else if ((m = line.match(/^c\[(\d+)\]\s*=\s*measure q\[(\d+)\];$/))) {
        if (m[1] !== m[2] || Number(m[1]) >= (classical || 0)) return fail("Measurements require q[i] → c[i]");
        add("M", m[2]);
      } else return fail();
    }
  }
  if (sdk === "Cirq" && wrapper !== 2) return { warning: "Close the cirq.Circuit(...) constructor before applying." };
  const circuit = { qubits, gates };
  const warning = validateCircuit(circuit);
  return warning ? { warning } : { circuit };
}
